import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../src/database/prisma.service";
import { CustomerCreatedOutboxPublisher } from "../src/customers/infrastructure/outbox/customer-created-outbox.publisher";
import { CustomerCreatedPublisher } from "../src/customers/application/ports/customer-created-publisher";
import { OutboxMetrics } from "../src/observability/outbox.metrics";

describe("CustomerCreatedOutboxPublisher", () => {
  let prisma: {
    $transaction: jest.Mock;
    outboxEvent: {
      update: jest.Mock;
      groupBy: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let transaction: {
    $queryRaw: jest.Mock;
    outboxEvent: {
      updateMany: jest.Mock;
    };
  };
  let publisher: jest.Mocked<CustomerCreatedPublisher>;
  let outboxMetrics: jest.Mocked<OutboxMetrics>;

  beforeEach(() => {
    transaction = {
      $queryRaw: jest.fn(),
      outboxEvent: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
      outboxEvent: {
        update: jest.fn().mockResolvedValue({}),
        groupBy: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    publisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    outboxMetrics = {
      recordPublication: jest.fn(),
      observePublicationDuration: jest.fn(),
      setOutboxEventCount: jest.fn(),
      setOldestPendingAgeSeconds: jest.fn(),
    } as unknown as jest.Mocked<OutboxMetrics>;
  });

  it("publishes pending customer.created events and marks them as published", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "event-id",
        eventType: "customer.created",
        attempts: 0,
        payload: {
          customerId: "customer-id",
          name: "Ana Silva",
          email: "ana@example.com",
          createdAt: "2026-05-18T12:00:00.000Z",
        } satisfies Prisma.JsonObject,
      },
    ]);
    const service = makeService();

    await service.publishPending();

    expect(transaction.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["event-id"] } },
      data: {
        status: "processing",
        lockedAt: expect.any(Date),
      },
    });
    expect(publisher.publish).toHaveBeenCalledWith(
      {
        customerId: "customer-id",
        name: "Ana Silva",
        email: "ana@example.com",
        createdAt: "2026-05-18T12:00:00.000Z",
      },
      { messageId: "event-id" },
    );
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: "event-id" },
      data: {
        status: "published",
        publishedAt: expect.any(Date),
        lockedAt: null,
        lastError: null,
      },
    });
    expect(outboxMetrics.recordPublication).toHaveBeenCalledWith(
      "customer.created",
      "success",
      "none",
    );
    expect(outboxMetrics.observePublicationDuration).toHaveBeenCalledWith(
      "customer.created",
      "success",
      expect.any(Number),
    );
  });

  it("marks a failed publish attempt as pending while attempts remain", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "event-id",
        eventType: "customer.created",
        attempts: 1,
        payload: {
          customerId: "customer-id",
          name: "Ana Silva",
          email: "ana@example.com",
          createdAt: "2026-05-18T12:00:00.000Z",
        } satisfies Prisma.JsonObject,
      },
    ]);
    publisher.publish.mockRejectedValueOnce(new Error("RabbitMQ unavailable"));
    const service = makeService({ OUTBOX_MAX_ATTEMPTS: 3 });

    await service.publishPending();

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: "event-id" },
      data: {
        attempts: 2,
        status: "pending",
        lockedAt: null,
        lastError: "RabbitMQ unavailable",
        nextAttemptAt: expect.any(Date),
      },
    });
    expect(outboxMetrics.recordPublication).toHaveBeenCalledWith(
      "customer.created",
      "failure",
      "publish_failed",
    );
    expect(outboxMetrics.observePublicationDuration).toHaveBeenCalledWith(
      "customer.created",
      "failure",
      expect.any(Number),
    );
  });

  it("marks a failed publish attempt as failed when attempts are exhausted", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "event-id",
        eventType: "customer.created",
        attempts: 2,
        payload: {
          customerId: "customer-id",
          name: "Ana Silva",
          email: "ana@example.com",
          createdAt: "2026-05-18T12:00:00.000Z",
        } satisfies Prisma.JsonObject,
      },
    ]);
    publisher.publish.mockRejectedValueOnce(new Error("RabbitMQ unavailable"));
    const service = makeService({ OUTBOX_MAX_ATTEMPTS: 3 });

    await service.publishPending();

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: "event-id" },
      data: {
        attempts: 3,
        status: "failed",
        lockedAt: null,
        lastError: "RabbitMQ unavailable",
        nextAttemptAt: expect.any(Date),
      },
    });
    expect(outboxMetrics.recordPublication).toHaveBeenCalledWith(
      "customer.created",
      "failure",
      "publish_failed",
    );
  });

  it("records unsupported event type failures", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "event-id",
        eventType: "customer.updated",
        attempts: 0,
        payload: {} satisfies Prisma.JsonObject,
      },
    ]);
    const service = makeService();

    await service.publishPending();

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "event-id" },
        data: expect.objectContaining({
          attempts: 1,
          status: "pending",
        }),
      }),
    );
    expect(outboxMetrics.recordPublication).toHaveBeenCalledWith(
      "customer.updated",
      "failure",
      "unsupported_event_type",
    );
  });

  it("records invalid payload failures", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "event-id",
        eventType: "customer.created",
        attempts: 0,
        payload: {
          customerId: "customer-id",
        } satisfies Prisma.JsonObject,
      },
    ]);
    const service = makeService();

    await service.publishPending();

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(outboxMetrics.recordPublication).toHaveBeenCalledWith(
      "customer.created",
      "failure",
      "invalid_payload",
    );
  });

  it("refreshes outbox backlog gauges after a publish cycle", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-18T12:00:00.000Z"));
    transaction.$queryRaw.mockResolvedValue([]);
    prisma.outboxEvent.groupBy.mockResolvedValue([
      { status: "pending", _count: { _all: 2 } },
      { status: "failed", _count: { _all: 1 } },
    ]);
    prisma.outboxEvent.findFirst.mockResolvedValue({
      createdAt: new Date("2026-05-18T11:58:00.000Z"),
    });
    const service = makeService();

    await service.publishPending();

    expect(prisma.outboxEvent.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      _count: { _all: true },
    });
    expect(prisma.outboxEvent.findFirst).toHaveBeenCalledWith({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    expect(outboxMetrics.setOutboxEventCount).toHaveBeenCalledWith(
      "pending",
      2,
    );
    expect(outboxMetrics.setOutboxEventCount).toHaveBeenCalledWith(
      "processing",
      0,
    );
    expect(outboxMetrics.setOutboxEventCount).toHaveBeenCalledWith(
      "published",
      0,
    );
    expect(outboxMetrics.setOutboxEventCount).toHaveBeenCalledWith("failed", 1);
    expect(outboxMetrics.setOldestPendingAgeSeconds).toHaveBeenCalledWith(120);

    jest.useRealTimers();
  });

  function makeService(
    overrides: Record<string, string | number | boolean> = {},
  ): CustomerCreatedOutboxPublisher {
    const values: Record<string, string | number | boolean> = {
      OUTBOX_PUBLISH_INTERVAL_MS: 5000,
      OUTBOX_PUBLISH_BATCH_SIZE: 10,
      OUTBOX_RETRY_DELAY_MS: 5000,
      OUTBOX_MAX_ATTEMPTS: 10,
      OUTBOX_PROCESSING_TIMEOUT_MS: 60000,
      ...overrides,
    };
    const config = {
      getOrThrow: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new (CustomerCreatedOutboxPublisher as unknown as new (
      prisma: PrismaService,
      config: ConfigService,
      publisher: CustomerCreatedPublisher,
      outboxMetrics: OutboxMetrics,
    ) => CustomerCreatedOutboxPublisher)(
      prisma as unknown as PrismaService,
      config,
      publisher,
      outboxMetrics,
    );
  }
});
