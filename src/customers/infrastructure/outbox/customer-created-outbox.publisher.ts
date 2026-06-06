import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { PrismaService } from "../../../database/prisma.service";
import { OutboxMetrics } from "../../../observability/outbox.metrics";
import {
  CUSTOMER_CREATED_EVENT_TYPE,
  customerCreatedEventSchema,
} from "../../../shared/events/customer-created.event";
import {
  CUSTOMER_CREATED_PUBLISHER,
  CustomerCreatedPublisher,
} from "../../application/ports/customer-created-publisher";

type ClaimedOutboxEvent = {
  id: string;
  eventType: string;
  payload: Prisma.JsonValue;
  attempts: number;
};

const OUTBOX_EVENT_STATUSES = [
  "pending",
  "processing",
  "published",
  "failed",
] as const;

type OutboxEventStatus = (typeof OUTBOX_EVENT_STATUSES)[number];
type OutboxPublicationFailureReason =
  | "publish_failed"
  | "unsupported_event_type"
  | "invalid_payload";

class UnsupportedOutboxEventTypeError extends Error {
  constructor(eventType: string) {
    super(`Unsupported outbox event type: ${eventType}`);
    this.name = "UnsupportedOutboxEventTypeError";
  }
}

@Injectable()
export class CustomerCreatedOutboxPublisher
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CustomerCreatedOutboxPublisher.name);
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly retryDelayMs: number;
  private readonly maxAttempts: number;
  private readonly processingTimeoutMs: number;
  private timer?: NodeJS.Timeout;
  private isRunning = false;
  private isShuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(CUSTOMER_CREATED_PUBLISHER)
    private readonly publisher: CustomerCreatedPublisher,
    private readonly outboxMetrics: OutboxMetrics,
  ) {
    this.intervalMs = this.config.getOrThrow<number>(
      "OUTBOX_PUBLISH_INTERVAL_MS",
    );
    this.batchSize = this.config.getOrThrow<number>(
      "OUTBOX_PUBLISH_BATCH_SIZE",
    );
    this.retryDelayMs = this.config.getOrThrow<number>("OUTBOX_RETRY_DELAY_MS");
    this.maxAttempts = this.config.getOrThrow<number>("OUTBOX_MAX_ATTEMPTS");
    this.processingTimeoutMs = this.config.getOrThrow<number>(
      "OUTBOX_PROCESSING_TIMEOUT_MS",
    );
  }

  onModuleInit(): void {
    this.scheduleNextRun(0);
  }

  onModuleDestroy(): void {
    this.isShuttingDown = true;

    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  async publishPending(): Promise<void> {
    try {
      const events = await this.claimPendingEvents();

      for (const event of events) {
        await this.publishEvent(event);
      }
    } finally {
      await this.refreshOutboxBacklogMetrics();
    }
  }

  private scheduleNextRun(delayMs = this.intervalMs): void {
    if (this.isShuttingDown) {
      return;
    }

    this.timer = setTimeout(() => {
      void this.run();
    }, delayMs);
  }

  private async run(): Promise<void> {
    if (this.isRunning) {
      this.scheduleNextRun();
      return;
    }

    this.isRunning = true;

    try {
      await this.publishPending();
    } catch (error) {
      this.logger.error(
        "Failed to publish outbox events",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.isRunning = false;
      this.scheduleNextRun();
    }
  }

  private async claimPendingEvents(): Promise<ClaimedOutboxEvent[]> {
    return this.prisma.$transaction(async (transaction) => {
      const events = await transaction.$queryRaw<ClaimedOutboxEvent[]>`
        SELECT
          id::text AS "id",
          event_type AS "eventType",
          payload,
          attempts
        FROM outbox_events
        WHERE
          (
            status = 'pending'
            AND next_attempt_at <= now()
          )
          OR
          (
            status = 'processing'
            AND locked_at < now() - (${this.processingTimeoutMs} * interval '1 millisecond')
          )
        ORDER BY created_at
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (events.length === 0) {
        return [];
      }

      await transaction.outboxEvent.updateMany({
        where: {
          id: { in: events.map((event) => event.id) },
        },
        data: {
          status: "processing",
          lockedAt: new Date(),
        },
      });

      return events;
    });
  }

  private async publishEvent(event: ClaimedOutboxEvent): Promise<void> {
    const startedAt = process.hrtime.bigint();

    try {
      if (event.eventType !== CUSTOMER_CREATED_EVENT_TYPE) {
        throw new UnsupportedOutboxEventTypeError(event.eventType);
      }

      const payload = customerCreatedEventSchema.parse(event.payload);
      await this.publisher.publish(payload, { messageId: event.id });
      await this.markPublished(event.id);

      this.outboxMetrics.recordPublication(event.eventType, "success", "none");
      this.outboxMetrics.observePublicationDuration(
        event.eventType,
        "success",
        this.durationSecondsSince(startedAt),
      );
    } catch (error) {
      await this.markFailedAttempt(event, error);
      this.outboxMetrics.recordPublication(
        event.eventType,
        "failure",
        this.getPublicationFailureReason(error),
      );
      this.outboxMetrics.observePublicationDuration(
        event.eventType,
        "failure",
        this.durationSecondsSince(startedAt),
      );
    }
  }

  private async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: "published",
        publishedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
  }

  private async markFailedAttempt(
    event: ClaimedOutboxEvent,
    error: unknown,
  ): Promise<void> {
    const attempts = event.attempts + 1;
    const shouldRetry = attempts < this.maxAttempts;

    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        attempts,
        status: shouldRetry ? "pending" : "failed",
        lockedAt: null,
        lastError: error instanceof Error ? error.message : String(error),
        nextAttemptAt: new Date(Date.now() + this.retryDelayMs),
      },
    });
  }

  private async refreshOutboxBacklogMetrics(): Promise<void> {
    try {
      const counts = await this.prisma.outboxEvent.groupBy({
        by: ["status"],
        _count: { _all: true },
      });
      const countsByStatus = new Map<string, number>(
        counts.map((count) => [count.status, count._count._all]),
      );

      for (const status of OUTBOX_EVENT_STATUSES) {
        this.outboxMetrics.setOutboxEventCount(
          status,
          countsByStatus.get(status) ?? 0,
        );
      }

      const oldestPending = await this.prisma.outboxEvent.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });

      this.outboxMetrics.setOldestPendingAgeSeconds(
        oldestPending
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - oldestPending.createdAt.getTime()) / 1000,
              ),
            )
          : 0,
      );
    } catch (error) {
      this.logger.error(
        "Failed to refresh outbox metrics",
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private getPublicationFailureReason(
    error: unknown,
  ): OutboxPublicationFailureReason {
    if (error instanceof UnsupportedOutboxEventTypeError) {
      return "unsupported_event_type";
    }

    if (error instanceof ZodError) {
      return "invalid_payload";
    }

    return "publish_failed";
  }

  private durationSecondsSince(startedAt: bigint): number {
    return Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
  }
}
