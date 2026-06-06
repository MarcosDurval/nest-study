import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { MetricsRegistry } from "../observability/metrics.registry";
import { createObservabilityHttpServer } from "../observability/observability-http-server";
import { EmailModule } from "./email.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(EmailModule);
  const config = app.get(ConfigService);
  const metricsRegistry = app.get(MetricsRegistry);
  const observabilityPort = config.getOrThrow<number>("OBSERVABILITY_PORT");
  const observabilityServer = createObservabilityHttpServer(metricsRegistry);

  observabilityServer.listen(observabilityPort, () => {
    Logger.log(
      `Observability HTTP server listening on port ${observabilityPort}`,
      "EmailService",
    );
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    Logger.log(`Received ${signal}. Shutting down.`, "EmailService");
    await new Promise<void>((resolve, reject) => {
      observabilityServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await app.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  Logger.log("Email service started", "EmailService");
}

void bootstrap();
