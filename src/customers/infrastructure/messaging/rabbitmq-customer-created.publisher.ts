import { randomUUID } from "crypto";
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import {
  CustomerCreatedPublisher,
  CustomerCreatedPublishOptions,
} from "../../application/ports/customer-created-publisher";
import { CustomerCreatedEvent } from "../../../shared/events/customer-created.event";

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection["createConfirmChannel"]>>;

@Injectable()
export class RabbitMqCustomerCreatedPublisher
  implements CustomerCreatedPublisher, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqCustomerCreatedPublisher.name);
  private connection?: AmqpConnection;
  private channel?: AmqpChannel;
  private isShuttingDown = false;

  constructor(private readonly config: ConfigService) {}

  async publish(
    event: CustomerCreatedEvent,
    options: CustomerCreatedPublishOptions = {},
  ): Promise<void> {
    const channel = await this.getChannel();
    const exchange = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMERS_EXCHANGE",
    );
    const routingKey = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMER_CREATED_ROUTING_KEY",
    );

    await this.publishConfirmed(channel, exchange, routingKey, event, options);
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    await this.channel?.close();
    await this.connection?.close();
  }

  private async getChannel(): Promise<AmqpChannel> {
    if (this.channel) {
      return this.channel;
    }

    const url = this.config.getOrThrow<string>("RABBITMQ_URL");
    const exchange = this.config.getOrThrow<string>(
      "RABBITMQ_CUSTOMERS_EXCHANGE",
    );

    this.connection = await amqp.connect(url);
    this.connection.on("close", () => {
      this.logger.warn("RabbitMQ connection closed");
      this.resetConnection();
    });
    this.connection.on("error", (error) => {
      this.logger.error(
        "RabbitMQ connection error",
        error instanceof Error ? error.stack : undefined,
      );
      this.resetConnection();
    });

    this.channel = await this.connection.createConfirmChannel();
    this.channel.on("close", () => {
      this.logger.warn("RabbitMQ channel closed");
      this.channel = undefined;
    });
    this.channel.on("error", (error) => {
      this.logger.error(
        "RabbitMQ channel error",
        error instanceof Error ? error.stack : undefined,
      );
      this.channel = undefined;
    });

    await this.channel.assertExchange(exchange, "topic", { durable: true });

    return this.channel;
  }

  private async publishConfirmed(
    channel: AmqpChannel,
    exchange: string,
    routingKey: string,
    event: CustomerCreatedEvent,
    options: CustomerCreatedPublishOptions,
  ): Promise<void> {
    const messageId = options.messageId ?? randomUUID();
    let returned = false;

    await new Promise<void>((resolve, reject) => {
      const onReturn = (message: amqp.Message) => {
        if (message.properties.messageId === messageId) {
          returned = true;
        }
      };

      channel.on("return", onReturn);
      channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(event)),
        {
          contentType: "application/json",
          deliveryMode: 2,
          mandatory: true,
          messageId,
        },
        (error) => {
          setImmediate(() => {
            channel.off("return", onReturn);

            if (error) {
              reject(error);
              return;
            }

            if (returned) {
              reject(
                new Error(
                  `RabbitMQ returned unroutable message ${messageId} for ${exchange}:${routingKey}`,
                ),
              );
              return;
            }

            resolve();
          });
        },
      );
    });
  }

  private resetConnection(): void {
    this.channel = undefined;

    if (!this.isShuttingDown) {
      this.connection = undefined;
    }
  }
}
