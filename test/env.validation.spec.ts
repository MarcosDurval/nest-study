import { validateApiEnv, validateEmailEnv } from "../src/config/env.validation";

describe("env validation", () => {
  it("parses API environment variables", () => {
    const env = validateApiEnv({
      NODE_ENV: "development",
      PORT: "3000",
      DATABASE_URL:
        "postgresql://customers:customers@localhost:5432/customers_db?schema=public",
      RABBITMQ_URL: "amqp://guest:guest@localhost:5672",
      RABBITMQ_CUSTOMERS_EXCHANGE: "customers.exchange",
      RABBITMQ_CUSTOMER_CREATED_ROUTING_KEY: "customer.created",
      OUTBOX_PUBLISH_INTERVAL_MS: "5000",
      OUTBOX_PUBLISH_BATCH_SIZE: "10",
      OUTBOX_RETRY_DELAY_MS: "5000",
      OUTBOX_MAX_ATTEMPTS: "10",
      OUTBOX_PROCESSING_TIMEOUT_MS: "60000",
    });

    expect(env.PORT).toBe(3000);
    expect(env.OUTBOX_PUBLISH_BATCH_SIZE).toBe(10);
  });

  it("parses email service numeric and boolean variables", () => {
    const env = validateEmailEnv({
      NODE_ENV: "production",
      RABBITMQ_URL: "amqp://guest:guest@rabbitmq:5672",
      RABBITMQ_RECONNECT_DELAY_MS: "5000",
      RABBITMQ_CUSTOMERS_EXCHANGE: "customers.exchange",
      RABBITMQ_CUSTOMER_CREATED_ROUTING_KEY: "customer.created",
      RABBITMQ_CUSTOMER_CREATED_QUEUE: "email.customer-created",
      RABBITMQ_CUSTOMER_CREATED_RETRY_EXCHANGE: "customers.retry.exchange",
      RABBITMQ_CUSTOMER_CREATED_RETRY_ROUTING_KEY: "customer.created.retry",
      RABBITMQ_CUSTOMER_CREATED_RETRY_QUEUE: "email.customer-created.retry",
      RABBITMQ_CUSTOMER_CREATED_DLQ_EXCHANGE: "customers.dlx",
      RABBITMQ_CUSTOMER_CREATED_DLQ_ROUTING_KEY: "customer.created.dlq",
      RABBITMQ_CUSTOMER_CREATED_DLQ_QUEUE: "email.customer-created.dlq",
      RABBITMQ_CUSTOMER_CREATED_MAX_RETRIES: "3",
      RABBITMQ_CUSTOMER_CREATED_RETRY_DELAY_MS: "10000",
      SMTP_HOST: "mailhog",
      SMTP_PORT: "1025",
      SMTP_SECURE: "false",
      SMTP_FROM: "Customers App <no-reply@customers.local>",
      OBSERVABILITY_PORT: "3001",
      EMAIL_FAILURE_SIMULATION_ENABLED: "true",
      EMAIL_FAILURE_SIMULATION_RATE: "0.5",
    });

    expect(env.RABBITMQ_CUSTOMER_CREATED_MAX_RETRIES).toBe(3);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.OBSERVABILITY_PORT).toBe(3001);
    expect(env.EMAIL_FAILURE_SIMULATION_ENABLED).toBe(true);
    expect(env.EMAIL_FAILURE_SIMULATION_RATE).toBe(0.5);
  });

  it("defaults email failure simulation when variables are omitted", () => {
    const env = validateEmailEnv({
      NODE_ENV: "production",
      RABBITMQ_URL: "amqp://guest:guest@rabbitmq:5672",
      RABBITMQ_RECONNECT_DELAY_MS: "5000",
      RABBITMQ_CUSTOMERS_EXCHANGE: "customers.exchange",
      RABBITMQ_CUSTOMER_CREATED_ROUTING_KEY: "customer.created",
      RABBITMQ_CUSTOMER_CREATED_QUEUE: "email.customer-created",
      RABBITMQ_CUSTOMER_CREATED_RETRY_EXCHANGE: "customers.retry.exchange",
      RABBITMQ_CUSTOMER_CREATED_RETRY_ROUTING_KEY: "customer.created.retry",
      RABBITMQ_CUSTOMER_CREATED_RETRY_QUEUE: "email.customer-created.retry",
      RABBITMQ_CUSTOMER_CREATED_DLQ_EXCHANGE: "customers.dlx",
      RABBITMQ_CUSTOMER_CREATED_DLQ_ROUTING_KEY: "customer.created.dlq",
      RABBITMQ_CUSTOMER_CREATED_DLQ_QUEUE: "email.customer-created.dlq",
      RABBITMQ_CUSTOMER_CREATED_MAX_RETRIES: "3",
      RABBITMQ_CUSTOMER_CREATED_RETRY_DELAY_MS: "10000",
      SMTP_HOST: "mailhog",
      SMTP_PORT: "1025",
      SMTP_SECURE: "false",
      SMTP_FROM: "Customers App <no-reply@customers.local>",
    });

    expect(env.EMAIL_FAILURE_SIMULATION_ENABLED).toBe(false);
    expect(env.EMAIL_FAILURE_SIMULATION_RATE).toBe(0);
  });

  it("fails when required environment variables are missing", () => {
    expect(() => validateApiEnv({ NODE_ENV: "development" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("fails when the email failure simulation rate is outside 0 and 1", () => {
    expect(() =>
      validateEmailEnv({
        NODE_ENV: "production",
        RABBITMQ_URL: "amqp://guest:guest@rabbitmq:5672",
        RABBITMQ_RECONNECT_DELAY_MS: "5000",
        RABBITMQ_CUSTOMERS_EXCHANGE: "customers.exchange",
        RABBITMQ_CUSTOMER_CREATED_ROUTING_KEY: "customer.created",
        RABBITMQ_CUSTOMER_CREATED_QUEUE: "email.customer-created",
        RABBITMQ_CUSTOMER_CREATED_RETRY_EXCHANGE: "customers.retry.exchange",
        RABBITMQ_CUSTOMER_CREATED_RETRY_ROUTING_KEY: "customer.created.retry",
        RABBITMQ_CUSTOMER_CREATED_RETRY_QUEUE: "email.customer-created.retry",
        RABBITMQ_CUSTOMER_CREATED_DLQ_EXCHANGE: "customers.dlx",
        RABBITMQ_CUSTOMER_CREATED_DLQ_ROUTING_KEY: "customer.created.dlq",
        RABBITMQ_CUSTOMER_CREATED_DLQ_QUEUE: "email.customer-created.dlq",
        RABBITMQ_CUSTOMER_CREATED_MAX_RETRIES: "3",
        RABBITMQ_CUSTOMER_CREATED_RETRY_DELAY_MS: "10000",
        SMTP_HOST: "mailhog",
        SMTP_PORT: "1025",
        SMTP_SECURE: "false",
        SMTP_FROM: "Customers App <no-reply@customers.local>",
        EMAIL_FAILURE_SIMULATION_ENABLED: "true",
        EMAIL_FAILURE_SIMULATION_RATE: "1.5",
      }),
    ).toThrow(/EMAIL_FAILURE_SIMULATION_RATE/);
  });
});
