import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { ZodError } from "zod";
import {
  customerCreatedEventSchema,
  CustomerCreatedEvent,
} from "../shared/events/customer-created.event";
import { CustomerWelcomeEmailSender } from "./customer-welcome-email.sender";

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection["createConfirmChannel"]>>;

@Injectable()
export class CustomerCreatedEmailConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CustomerCreatedEmailConsumer.name);
  private connection?: AmqpConnection;
  private channel?: AmqpChannel;
  private reconnectTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  private readonly rabbitUrl: string;
  private readonly reconnectDelayMs: number;

  private readonly mainExchange: string;
  private readonly mainQueue: string;
  private readonly mainRoutingKey: string;

  private readonly retryExchange: string;
  private readonly retryQueue: string;
  private readonly retryRoutingKey: string;

  private readonly deadLetterExchange: string;
  private readonly deadLetterQueue: string;
  private readonly deadLetterRoutingKey: string;

  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly emailSender: CustomerWelcomeEmailSender,
  ) {
    this.rabbitUrl = this.config.getOrThrow<string>("RABBITMQ_URL");
    this.reconnectDelayMs = this.config.getOrThrow<number>(
      "RABBITMQ_RECONNECT_DELAY_MS",
    );

    this.mainExchange = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMERS_EXCHANGE",
    );
    this.mainQueue = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMER_CREATED_QUEUE",
    );
    this.mainRoutingKey = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMER_CREATED_ROUTING_KEY",
    );

    this.retryExchange = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMER_CREATED_RETRY_EXCHANGE",
    );
    this.retryQueue = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMER_CREATED_RETRY_QUEUE",
    );
    this.retryRoutingKey = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMER_CREATED_RETRY_ROUTING_KEY",
    );

    this.deadLetterExchange = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMER_CREATED_DLQ_EXCHANGE",
    );
    this.deadLetterQueue = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMER_CREATED_DLQ_QUEUE",
    );
    this.deadLetterRoutingKey = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMER_CREATED_DLQ_ROUTING_KEY",
    );

    this.maxRetries = this.config.getOrThrow<number>(
      "RABBITMQ_CUSTOMER_CREATED_MAX_RETRIES",
    );
    this.retryDelayMs = this.config.getOrThrow<number>(
      "RABBITMQ_CUSTOMER_CREATED_RETRY_DELAY_MS",
    );
  }

  async onModuleInit(): Promise<void> {
    await this.start();
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    await this.channel?.close();
    await this.connection?.close();
  }

  private async start(): Promise<void> {
    this.connection = await amqp.connect(this.rabbitUrl);
    this.connection.on("close", () => {
      this.logger.warn("RabbitMQ connection closed");
      this.scheduleReconnect();
    });
    this.connection.on("error", (error) => {
      this.logger.error(
        "RabbitMQ connection error",
        error instanceof Error ? error.stack : undefined,
      );
      this.scheduleReconnect();
    });

    this.channel = await this.connection.createConfirmChannel();
    this.channel.on("close", () => {
      this.logger.warn("RabbitMQ channel closed");
      this.scheduleReconnect();
    });
    this.channel.on("error", (error) => {
      this.logger.error(
        "RabbitMQ channel error",
        error instanceof Error ? error.stack : undefined,
      );
      this.scheduleReconnect();
    });

    await this.setupCustomerCreatedMessaging();
    await this.channel.prefetch(5);

    await this.channel.consume(this.mainQueue, async (message) => {
      if (!message) {
        return;
      }

      try {
        await this.handleMessage(message);
      } catch (error) {
        this.logger.error(
          "Failed to settle customer.created message",
          error instanceof Error ? error.stack : undefined,
        );
        this.channel?.nack(message, false, true);
      }
    });

    this.logger.log(
      `Listening to ${this.mainQueue} for ${this.mainRoutingKey}`,
    );
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown || this.reconnectTimer) {
      return;
    }

    this.connection = undefined;
    this.channel = undefined;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.reconnect();
    }, this.reconnectDelayMs);
  }

  private async reconnect(): Promise<void> {
    try {
      await this.start();
    } catch (error) {
      this.logger.error(
        "Failed to reconnect RabbitMQ consumer",
        error instanceof Error ? error.stack : undefined,
      );
      this.scheduleReconnect();
    }
  }

  private async setupCustomerCreatedMessaging(): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not initialized");
    }

    await this.channel.assertExchange(this.mainExchange, "topic", {
      durable: true,
    });
    await this.channel.assertExchange(this.retryExchange, "topic", {
      durable: true,
    });
    await this.channel.assertExchange(this.deadLetterExchange, "topic", {
      durable: true,
    });

    await this.channel.assertQueue(this.mainQueue, {
      durable: true,
    });
    await this.channel.assertQueue(this.retryQueue, {
      durable: true,
      arguments: {
        "x-message-ttl": this.retryDelayMs,
        "x-dead-letter-exchange": this.mainExchange,
        "x-dead-letter-routing-key": this.mainRoutingKey,
      },
    });
    await this.channel.assertQueue(this.deadLetterQueue, {
      durable: true,
    });

    await this.channel.bindQueue(
      this.mainQueue,
      this.mainExchange,
      this.mainRoutingKey,
    );

    await this.channel.bindQueue(
      this.retryQueue,
      this.retryExchange,
      this.retryRoutingKey,
    );

    await this.channel.bindQueue(
      this.deadLetterQueue,
      this.deadLetterExchange,
      this.deadLetterRoutingKey,
    );
  }

  private async handleMessage(message: amqp.ConsumeMessage): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not initialized");
    }

    try {
      const event = this.parseEvent(message);
      await this.emailSender.send(event);
      this.channel.ack(message);
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
        this.logger.error(
          "Invalid customer.created payload. Sending message to DLQ.",
          error instanceof Error ? error.stack : undefined,
        );
        await this.publishToDeadLetter(
          message,
          this.getRetryCount(message),
          error,
        );
        this.channel.ack(message);
        return;
      }

      await this.retryOrDeadLetter(message, error);
    }
  }

  private parseEvent(message: amqp.ConsumeMessage): CustomerCreatedEvent {
    const payload = JSON.parse(message.content.toString("utf8")) as unknown;
    return customerCreatedEventSchema.parse(payload);
  }

  private async retryOrDeadLetter(
    message: amqp.ConsumeMessage,
    error: unknown,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not initialized");
    }

    const retryCount = this.getRetryCount(message);

    this.logger.error(
      "Failed to process customer.created event",
      error instanceof Error ? error.stack : undefined,
    );

    if (retryCount >= this.maxRetries) {
      await this.publishToDeadLetter(message, retryCount, error);
    } else {
      await this.publishToRetry(message, retryCount);
    }

    this.channel.ack(message);
  }

  private getRetryCount(message: amqp.ConsumeMessage): number {
    const value = message.properties.headers?.["x-retry-count"];
    const retryCount = Number(value ?? 0);

    if (!Number.isFinite(retryCount) || retryCount < 0) {
      return 0;
    }

    return Math.floor(retryCount);
  }

  private async publishToRetry(
    message: amqp.ConsumeMessage,
    retryCount: number,
  ): Promise<void> {
    await this.publishConfirmed(
      this.retryExchange,
      this.retryRoutingKey,
      message,
      {
        ...message.properties.headers,
        "x-retry-count": retryCount + 1,
        "x-original-exchange": this.mainExchange,
        "x-original-routing-key": this.mainRoutingKey,
      },
    );
  }

  private async publishToDeadLetter(
    message: amqp.ConsumeMessage,
    retryCount: number,
    error: unknown,
  ): Promise<void> {
    await this.publishConfirmed(
      this.deadLetterExchange,
      this.deadLetterRoutingKey,
      message,
      {
        ...message.properties.headers,
        "x-retry-count": retryCount,
        "x-error-message":
          error instanceof Error ? error.message : String(error),
        "x-failed-at": new Date().toISOString(),
      },
    );
  }

  private async publishConfirmed(
    exchange: string,
    routingKey: string,
    message: amqp.ConsumeMessage,
    headers: Record<string, unknown>,
  ): Promise<void> {
    const channel = this.channel;

    if (!channel) {
      throw new Error("RabbitMQ channel is not initialized");
    }

    await new Promise<void>((resolve, reject) => {
      channel.publish(
        exchange,
        routingKey,
        message.content,
        {
          contentType: message.properties.contentType ?? "application/json",
          contentEncoding: message.properties.contentEncoding,
          correlationId: message.properties.correlationId,
          messageId: message.properties.messageId,
          persistent: true,
          deliveryMode: 2,
          headers,
        },
        (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        },
      );
    });
  }
}
