import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../src/database/prisma.service";
import { CustomerCreatedOutboxPublisher } from "../src/customers/infrastructure/outbox/customer-created-outbox.publisher";
import { CustomerCreatedPublisher } from "../src/customers/application/ports/customer-created-publisher";

describe("CustomerCreatedOutboxPublisher", () => {
  let prisma: {
    $transaction: jest.Mock;
    outboxEvent: {
      update: jest.Mock;
    };
  };
  let transaction: {
    $queryRaw: jest.Mock;
    outboxEvent: {
      updateMany: jest.Mock;
    };
  };
  let publisher: jest.Mocked<CustomerCreatedPublisher>;

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
      },
    };
    publisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
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

    return new CustomerCreatedOutboxPublisher(
      prisma as unknown as PrismaService,
      config,
      publisher,
    );
  }
});
