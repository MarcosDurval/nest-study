import { z } from "zod";

const requiredString = z.string().trim().min(1);
const positiveInteger = z.coerce.number().int().positive();
const nonNegativeInteger = z.coerce.number().int().min(0);
const probabilityRate = z.coerce.number().min(0).max(1);

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return value;
}, z.boolean());

const nodeEnv = z.enum(["development", "test", "production"]);
const failureSimulationEnabled = booleanFromEnv.default(false);
const failureSimulationRate = probabilityRate.default(0);

const rabbitPublisherEnv = {
  RABBITMQ_URL: requiredString,
  RABBITMQ_CUSTOMERS_EXCHANGE: requiredString,
  RABBITMQ_CUSTOMER_CREATED_ROUTING_KEY: requiredString,
};

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  PORT: positiveInteger,
  DATABASE_URL: requiredString,
  ...rabbitPublisherEnv,
  OUTBOX_PUBLISH_INTERVAL_MS: positiveInteger,
  OUTBOX_PUBLISH_BATCH_SIZE: positiveInteger,
  OUTBOX_RETRY_DELAY_MS: positiveInteger,
  OUTBOX_MAX_ATTEMPTS: positiveInteger,
  OUTBOX_PROCESSING_TIMEOUT_MS: positiveInteger,
});

export const emailEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  ...rabbitPublisherEnv,
  RABBITMQ_RECONNECT_DELAY_MS: positiveInteger,
  RABBITMQ_CUSTOMER_CREATED_QUEUE: requiredString,
  RABBITMQ_CUSTOMER_CREATED_RETRY_EXCHANGE: requiredString,
  RABBITMQ_CUSTOMER_CREATED_RETRY_ROUTING_KEY: requiredString,
  RABBITMQ_CUSTOMER_CREATED_RETRY_QUEUE: requiredString,
  RABBITMQ_CUSTOMER_CREATED_DLQ_EXCHANGE: requiredString,
  RABBITMQ_CUSTOMER_CREATED_DLQ_ROUTING_KEY: requiredString,
  RABBITMQ_CUSTOMER_CREATED_DLQ_QUEUE: requiredString,
  RABBITMQ_CUSTOMER_CREATED_MAX_RETRIES: nonNegativeInteger,
  RABBITMQ_CUSTOMER_CREATED_RETRY_DELAY_MS: positiveInteger,
  SMTP_HOST: requiredString,
  SMTP_PORT: positiveInteger,
  SMTP_SECURE: booleanFromEnv,
  SMTP_FROM: requiredString,
  EMAIL_FAILURE_SIMULATION_ENABLED: failureSimulationEnabled,
  EMAIL_FAILURE_SIMULATION_RATE: failureSimulationRate,
});

export type ApiEnvironmentVariables = z.infer<typeof apiEnvSchema>;
export type EmailEnvironmentVariables = z.infer<typeof emailEnvSchema>;

export function validateApiEnv(
  config: Record<string, unknown>,
): ApiEnvironmentVariables {
  return validateEnv(apiEnvSchema, config);
}

export function validateEmailEnv(
  config: Record<string, unknown>,
): EmailEnvironmentVariables {
  return validateEnv(emailEnvSchema, config);
}

function validateEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  config: Record<string, unknown>,
): z.infer<TSchema> {
  const parsed = schema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "env";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(`Invalid environment variables: ${details}`);
  }

  return parsed.data;
}
