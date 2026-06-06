import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { ConsumeMessage } from "amqplib";
import { CustomerCreatedEmailConsumer } from "../src/email/customer-created-email.consumer";
import { CustomerWelcomeEmailSender } from "../src/email/customer-welcome-email.sender";
import { EmailMetrics } from "../src/observability/email.metrics";

jest.mock("amqplib", () => ({
  connect: jest.fn(),
}));

describe("CustomerCreatedEmailConsumer", () => {
  let channel: jest.Mocked<amqp.ConfirmChannel>;
  let connection: jest.Mocked<amqp.ChannelModel>;
  let consumeHandler: ((message: ConsumeMessage | null) => unknown) | undefined;
  let emailSender: jest.Mocked<CustomerWelcomeEmailSender>;
  let emailMetrics: jest.Mocked<EmailMetrics>;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "warn").mockImplementation();

    consumeHandler = undefined;
    channel = {
      assertExchange: jest.fn().mockResolvedValue({}),
      assertQueue: jest.fn().mockResolvedValue({}),
      bindQueue: jest.fn().mockResolvedValue({}),
      prefetch: jest.fn().mockResolvedValue({}),
      consume: jest.fn(async (_queue, handler) => {
        consumeHandler = handler;
        return { consumerTag: "consumer" };
      }),
      publish: jest.fn(
        (_exchange, _routingKey, _content, _options, callback) => {
          callback?.(null, {});
          return true;
        },
      ),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    } as unknown as jest.Mocked<amqp.ConfirmChannel>;

    connection = {
      createConfirmChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    } as unknown as jest.Mocked<amqp.ChannelModel>;

    jest.mocked(amqp.connect).mockResolvedValue(connection);

    emailSender = {
      send: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CustomerWelcomeEmailSender>;
    emailMetrics = {
      recordDelivery: jest.fn(),
      observeDeliveryDuration: jest.fn(),
      recordRetry: jest.fn(),
      recordDlq: jest.fn(),
    } as unknown as jest.Mocked<EmailMetrics>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("declares the main, retry and dead-letter topology before consuming", async () => {
    const consumer = makeConsumer();

    await consumer.onModuleInit();

    expect(connection.on).toHaveBeenCalledWith("close", expect.any(Function));
    expect(connection.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith("close", expect.any(Function));
    expect(channel.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(channel.assertExchange).toHaveBeenCalledWith(
      "customers.exchange",
      "topic",
      {
        durable: true,
      },
    );
    expect(channel.assertExchange).toHaveBeenCalledWith(
      "customers.retry.exchange",
      "topic",
      { durable: true },
    );
    expect(channel.assertExchange).toHaveBeenCalledWith(
      "customers.dlx",
      "topic",
      {
        durable: true,
      },
    );
    expect(channel.assertQueue).toHaveBeenCalledWith("email.customer-created", {
      durable: true,
    });
    expect(channel.assertQueue).toHaveBeenCalledWith(
      "email.customer-created.retry",
      {
        durable: true,
        arguments: {
          "x-message-ttl": 10000,
          "x-dead-letter-exchange": "customers.exchange",
          "x-dead-letter-routing-key": "customer.created",
        },
      },
    );
    expect(channel.assertQueue).toHaveBeenCalledWith(
      "email.customer-created.dlq",
      {
        durable: true,
      },
    );
    expect(channel.consume).toHaveBeenCalledWith(
      "email.customer-created",
      expect.any(Function),
    );
  });

  it("acks successfully processed messages", async () => {
    const consumer = makeConsumer();
    await consumer.onModuleInit();

    const message = makeMessage(validEvent());
    await handle(message);

    expect(emailSender.send).toHaveBeenCalledWith(validEvent());
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.publish).not.toHaveBeenCalled();
    expect(emailMetrics.recordDelivery).toHaveBeenCalledWith("success", "none");
    expect(emailMetrics.observeDeliveryDuration).toHaveBeenCalledWith(
      "success",
      expect.any(Number),
    );
  });

  it("publishes transient failures to the retry exchange", async () => {
    emailSender.send.mockRejectedValueOnce(new Error("SMTP unavailable"));
    const consumer = makeConsumer();
    await consumer.onModuleInit();

    const message = makeMessage(validEvent());
    await handle(message);

    expect(channel.publish).toHaveBeenCalledWith(
      "customers.retry.exchange",
      "customer.created.retry",
      message.content,
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-retry-count": 1,
          "x-original-exchange": "customers.exchange",
          "x-original-routing-key": "customer.created",
        }),
      }),
      expect.any(Function),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(emailMetrics.recordDelivery).toHaveBeenCalledWith(
      "failure",
      "send_failed",
    );
    expect(emailMetrics.observeDeliveryDuration).toHaveBeenCalledWith(
      "failure",
      expect.any(Number),
    );
    expect(emailMetrics.recordRetry).toHaveBeenCalledWith("send_failed");
  });

  it("publishes exhausted failures to the DLQ", async () => {
    emailSender.send.mockRejectedValueOnce(new Error("SMTP unavailable"));
    const consumer = makeConsumer();
    await consumer.onModuleInit();

    const message = makeMessage(validEvent(), { "x-retry-count": 3 });
    await handle(message);

    expect(channel.publish).toHaveBeenCalledWith(
      "customers.dlx",
      "customer.created.dlq",
      message.content,
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-retry-count": 3,
          "x-error-message": "SMTP unavailable",
        }),
      }),
      expect.any(Function),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(emailMetrics.recordDelivery).toHaveBeenCalledWith(
      "failure",
      "send_failed",
    );
    expect(emailMetrics.recordDlq).toHaveBeenCalledWith("retries_exhausted");
  });

  it("publishes invalid payloads to the DLQ without sending email", async () => {
    const consumer = makeConsumer();
    await consumer.onModuleInit();

    const message = makeMessage("{");
    await handle(message);

    expect(emailSender.send).not.toHaveBeenCalled();
    expect(channel.publish).toHaveBeenCalledWith(
      "customers.dlx",
      "customer.created.dlq",
      message.content,
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-retry-count": 0,
        }),
      }),
      expect.any(Function),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(emailMetrics.recordDelivery).toHaveBeenCalledWith(
      "failure",
      "invalid_payload",
    );
    expect(emailMetrics.observeDeliveryDuration).toHaveBeenCalledWith(
      "failure",
      expect.any(Number),
    );
    expect(emailMetrics.recordDlq).toHaveBeenCalledWith("invalid_payload");
  });

  function makeConsumer(
    overrides: Record<string, string | number | boolean> = {},
  ): CustomerCreatedEmailConsumer {
    const values: Record<string, string | number | boolean> = {
      RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
      RABBITMQ_RECONNECT_DELAY_MS: 5000,
      RABBITMQ_CUSTOMERS_EXCHANGE: "customers.exchange",
      RABBITMQ_CUSTOMER_CREATED_QUEUE: "email.customer-created",
      RABBITMQ_CUSTOMER_CREATED_ROUTING_KEY: "customer.created",
      RABBITMQ_CUSTOMER_CREATED_RETRY_EXCHANGE: "customers.retry.exchange",
      RABBITMQ_CUSTOMER_CREATED_RETRY_QUEUE: "email.customer-created.retry",
      RABBITMQ_CUSTOMER_CREATED_RETRY_ROUTING_KEY: "customer.created.retry",
      RABBITMQ_CUSTOMER_CREATED_DLQ_EXCHANGE: "customers.dlx",
      RABBITMQ_CUSTOMER_CREATED_DLQ_QUEUE: "email.customer-created.dlq",
      RABBITMQ_CUSTOMER_CREATED_DLQ_ROUTING_KEY: "customer.created.dlq",
      RABBITMQ_CUSTOMER_CREATED_MAX_RETRIES: 3,
      RABBITMQ_CUSTOMER_CREATED_RETRY_DELAY_MS: 10000,
      ...overrides,
    };

    const config = {
      getOrThrow: jest.fn((key: string) => {
        const value = values[key];

        if (value === undefined) {
          throw new Error(`Missing env var ${key}`);
        }

        return value;
      }),
    } as unknown as ConfigService;

    return new (CustomerCreatedEmailConsumer as unknown as new (
      config: ConfigService,
      emailSender: CustomerWelcomeEmailSender,
      emailMetrics: EmailMetrics,
    ) => CustomerCreatedEmailConsumer)(config, emailSender, emailMetrics);
  }

  async function handle(message: ConsumeMessage): Promise<void> {
    if (!consumeHandler) {
      throw new Error("Consumer was not started");
    }

    await consumeHandler(message);
  }

  function makeMessage(
    body: unknown,
    headers: Record<string, unknown> = {},
  ): ConsumeMessage {
    return {
      content: Buffer.from(
        typeof body === "string" ? body : JSON.stringify(body),
      ),
      fields: {} as ConsumeMessage["fields"],
      properties: {
        contentType: "application/json",
        headers,
      } as ConsumeMessage["properties"],
    };
  }

  function validEvent() {
    return {
      customerId: "customer-id",
      name: "Ana Silva",
      email: "ana@example.com",
      createdAt: "2026-05-17T12:00:00.000Z",
    };
  }
});
