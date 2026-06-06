import { Global, Module } from "@nestjs/common";
import { CustomerMetrics } from "./customer.metrics";
import { EmailMetrics } from "./email.metrics";
import { HealthController } from "./health.controller";
import { MetricsController } from "./metrics.controller";
import { MetricsRegistry } from "./metrics.registry";
import { OutboxMetrics } from "./outbox.metrics";

@Global()
@Module({
  controllers: [HealthController, MetricsController],
  providers: [MetricsRegistry, CustomerMetrics, OutboxMetrics, EmailMetrics],
  exports: [MetricsRegistry, CustomerMetrics, OutboxMetrics, EmailMetrics],
})
export class ObservabilityModule {}
