import { CustomerMetrics } from "../src/observability/customer.metrics";
import { EmailMetrics } from "../src/observability/email.metrics";
import { MetricsRegistry } from "../src/observability/metrics.registry";
import { handleObservabilityHttpRequest } from "../src/observability/observability-http-server";
import { OutboxMetrics } from "../src/observability/outbox.metrics";

describe("handleObservabilityHttpRequest", () => {
  it("serves health and metrics without a Nest HTTP app", async () => {
    const metricsRegistry = new MetricsRegistry();
    new CustomerMetrics(metricsRegistry);
    new OutboxMetrics(metricsRegistry);
    new EmailMetrics(metricsRegistry);

    const healthResponse = await handleObservabilityHttpRequest(
      metricsRegistry,
      {
        method: "GET",
        url: "/health",
      },
    );

    expect(healthResponse.statusCode).toBe(200);
    expect(JSON.parse(healthResponse.body)).toEqual({ status: "ok" });

    const metricsResponse = await handleObservabilityHttpRequest(
      metricsRegistry,
      {
        method: "GET",
        url: "/metrics",
      },
    );

    expect(metricsResponse.statusCode).toBe(200);
    expect(metricsResponse.headers["Content-Type"]).toContain("text/plain");
    expect(metricsResponse.body).toContain(
      "# HELP customers_welcome_email_dlq_total",
    );
  });
});
