import { Injectable } from "@nestjs/common";
import { Counter, Gauge, Histogram } from "prom-client";
import { MetricsRegistry } from "./metrics.registry";

type OutboxPublicationOutcome = "success" | "failure";
type OutboxPublicationTotalLabel = "event_type" | "outcome" | "reason";
type OutboxPublicationDurationLabel = "event_type" | "outcome";
type OutboxEventStatus = "pending" | "processing" | "published" | "failed";

@Injectable()
export class OutboxMetrics {
  private readonly publicationTotal: Counter<OutboxPublicationTotalLabel>;
  private readonly publicationDuration: Histogram<OutboxPublicationDurationLabel>;
  private readonly outboxEvents: Gauge<"status">;
  private readonly oldestPendingAge: Gauge;

  constructor(metricsRegistry: MetricsRegistry) {
    this.publicationTotal = new Counter<OutboxPublicationTotalLabel>({
      name: "customers_outbox_publication_total",
      help: "Total number of outbox publication attempts.",
      labelNames: ["event_type", "outcome", "reason"],
      registers: [metricsRegistry.registry],
    });

    this.publicationDuration = new Histogram<OutboxPublicationDurationLabel>({
      name: "customers_outbox_publication_duration_seconds",
      help: "Outbox publication duration in seconds.",
      labelNames: ["event_type", "outcome"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [metricsRegistry.registry],
    });

    this.outboxEvents = new Gauge<"status">({
      name: "customers_outbox_events",
      help: "Current number of outbox events by status.",
      labelNames: ["status"],
      registers: [metricsRegistry.registry],
    });

    this.oldestPendingAge = new Gauge({
      name: "customers_outbox_oldest_pending_age_seconds",
      help: "Age in seconds of the oldest pending outbox event.",
      registers: [metricsRegistry.registry],
    });
  }

  recordPublication(
    eventType: string,
    outcome: OutboxPublicationOutcome,
    reason: string,
  ): void {
    this.publicationTotal.inc({
      event_type: eventType,
      outcome,
      reason,
    });
  }

  observePublicationDuration(
    eventType: string,
    outcome: OutboxPublicationOutcome,
    durationSeconds: number,
  ): void {
    this.publicationDuration.observe(
      { event_type: eventType, outcome },
      durationSeconds,
    );
  }

  setOutboxEventCount(status: OutboxEventStatus, count: number): void {
    this.outboxEvents.set({ status }, count);
  }

  setOldestPendingAgeSeconds(ageSeconds: number): void {
    this.oldestPendingAge.set(ageSeconds);
  }
}
