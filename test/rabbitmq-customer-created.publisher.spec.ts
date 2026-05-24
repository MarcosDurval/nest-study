import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { Message } from "amqplib";
import { RabbitMqCustomerCreatedPublisher } from "../src/customers/infrastructure/messaging/rabbitmq-customer-created.publisher";

jest.mock("amqplib", () => ({
  connect: jest.fn(),
}));

describe("RabbitMqCustomerCreatedPublisher", () => {
  let channel: {
    assertExchange: jest.Mock;
    publish: jest.Mock;
    on: jest.Mock;
    off: jest.Mock;
    close: jest.Mock;
  };
  let connection: {
    createConfirmChannel: jest.Mock;
    on: jest.Mock;
    close: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    channel = {
      assertExchange: jest.fn().mockResolvedValue({}),
      publish: jest.fn(
        (_exchange, _routingKey, _content, _options, callback) => {
          callback?.(null, {});
          return true;
        },
      ),
      on: jest.fn(),
      off: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    connection = {
      createConfirmChannel: jest.fn().mockResolvedValue(channel),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    jest.mocked(amqp.connect).mockResolvedValue(connection as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("publishes customer.created with broker confirmation", async () => {
    const publisher = makePublisher();

    await publisher.publish(validEvent(), { messageId: "outbox-id" });

    expect(connection.createConfirmChannel).toHaveBeenCalledTimes(1);
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
    expect(channel.publish).toHaveBeenCalledWith(
      "customers.exchange",
      "customer.created",
      Buffer.from(JSON.stringify(validEvent())),
      expect.objectContaining({
        contentType: "application/json",
        deliveryMode: 2,
        mandatory: true,
        messageId: "outbox-id",
      }),
      expect.any(Function),
    );
  });

  it("rejects unroutable mandatory messages", async () => {
    let returnHandler: ((message: Message) => void) | undefined;
    channel.on.mockImplementation((event, handler) => {
      if (event === "return") {
        returnHandler = handler;
      }

      return channel;
    });
    channel.publish.mockImplementation(
      (_exchange, _routingKey, _content, _options, callback) => {
        returnHandler?.({
          properties: { messageId: "outbox-id" },
        } as Message);
        callback?.(null, {});
        return true;
      },
    );
    const publisher = makePublisher();

    await expect(
      publisher.publish(validEvent(), { messageId: "outbox-id" }),
    ).rejects.toThrow("unroutable message outbox-id");
  });

  function makePublisher(): RabbitMqCustomerCreatedPublisher {
    const values: Record<string, string> = {
      RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
      RABBITMQ_CUSTOMERS_EXCHANGE: "customers.exchange",
      RABBITMQ_CUSTOMER_CREATED_ROUTING_KEY: "customer.created",
    };
    const config = {
      getOrThrow: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new RabbitMqCustomerCreatedPublisher(config);
  }

  function validEvent() {
    return {
      customerId: "customer-id",
      name: "Ana Silva",
      email: "ana@example.com",
      createdAt: "2026-05-18T12:00:00.000Z",
    };
  }
});
