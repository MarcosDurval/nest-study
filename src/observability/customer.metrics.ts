import { Injectable } from "@nestjs/common";
import { Counter, Histogram } from "prom-client";
import { MetricsRegistry } from "./metrics.registry";

type CustomerCreationOutcome = "success" | "failure";
type CustomerCreationTotalLabel = "outcome" | "reason";

@Injectable()
export class CustomerMetrics {
  private readonly creationTotal: Counter<CustomerCreationTotalLabel>;
  private readonly creationDuration: Histogram<"outcome">;

  constructor(metricsRegistry: MetricsRegistry) {
    this.creationTotal = new Counter<CustomerCreationTotalLabel>({
      name: "customers_customer_creation_total",
      help: "Total number of Customer Creation attempts.",
      labelNames: ["outcome", "reason"],
      registers: [metricsRegistry.registry],
    });

    this.creationDuration = new Histogram<"outcome">({
      name: "customers_customer_creation_duration_seconds",
      help: "Customer Creation duration in seconds.",
      labelNames: ["outcome"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [metricsRegistry.registry],
    });
  }

  recordCreation(outcome: CustomerCreationOutcome, reason: string): void {
    this.creationTotal.inc({ outcome, reason });
  }

  observeCreationDuration(
    outcome: CustomerCreationOutcome,
    durationSeconds: number,
  ): void {
    this.creationDuration.observe({ outcome }, durationSeconds);
  }
}
