import { Injectable } from "@nestjs/common";
import { Counter, Histogram } from "prom-client";
import { MetricsRegistry } from "./metrics.registry";

type WelcomeEmailDeliveryOutcome = "success" | "failure";
type WelcomeEmailDeliveryLabel = "outcome" | "reason";

@Injectable()
export class EmailMetrics {
  private readonly deliveryTotal: Counter<WelcomeEmailDeliveryLabel>;
  private readonly deliveryDuration: Histogram<"outcome">;
  private readonly retryTotal: Counter<"reason">;
  private readonly dlqTotal: Counter<"reason">;

  constructor(metricsRegistry: MetricsRegistry) {
    this.deliveryTotal = new Counter<WelcomeEmailDeliveryLabel>({
      name: "customers_welcome_email_delivery_total",
      help: "Total number of Welcome Email Delivery attempts.",
      labelNames: ["outcome", "reason"],
      registers: [metricsRegistry.registry],
    });

    this.deliveryDuration = new Histogram<"outcome">({
      name: "customers_welcome_email_delivery_duration_seconds",
      help: "Welcome Email Delivery duration in seconds.",
      labelNames: ["outcome"],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [metricsRegistry.registry],
    });

    this.retryTotal = new Counter<"reason">({
      name: "customers_welcome_email_retry_total",
      help: "Total number of Welcome Email Delivery retries.",
      labelNames: ["reason"],
      registers: [metricsRegistry.registry],
    });

    this.dlqTotal = new Counter<"reason">({
      name: "customers_welcome_email_dlq_total",
      help: "Total number of Welcome Email Delivery messages sent to DLQ.",
      labelNames: ["reason"],
      registers: [metricsRegistry.registry],
    });
  }

  recordDelivery(outcome: WelcomeEmailDeliveryOutcome, reason: string): void {
    this.deliveryTotal.inc({ outcome, reason });
  }

  observeDeliveryDuration(
    outcome: WelcomeEmailDeliveryOutcome,
    durationSeconds: number,
  ): void {
    this.deliveryDuration.observe({ outcome }, durationSeconds);
  }

  recordRetry(reason: string): void {
    this.retryTotal.inc({ reason });
  }

  recordDlq(reason: string): void {
    this.dlqTotal.inc({ reason });
  }
}
