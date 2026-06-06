import { Test } from "@nestjs/testing";
import { HealthController } from "../src/observability/health.controller";
import { MetricsController } from "../src/observability/metrics.controller";
import { MetricsRegistry } from "../src/observability/metrics.registry";
import { ObservabilityModule } from "../src/observability/observability.module";

describe("ObservabilityModule", () => {
  let healthController: HealthController;
  let metricsController: MetricsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ObservabilityModule],
    }).compile();

    healthController = moduleRef.get(HealthController);
    metricsController = moduleRef.get(MetricsController);
  });

  it("exposes a health endpoint", async () => {
    expect(healthController.health()).toEqual({ status: "ok" });
  });

  it("exposes Prometheus metrics", async () => {
    const response = {
      type: jest.fn().mockReturnThis(),
    };
    const body = await metricsController.metrics(response);

    expect(response.type).toHaveBeenCalledWith(
      expect.stringContaining("text/plain"),
    );
    expect(body).toContain("# HELP customers_customer_creation_total");
    expect(body).toContain("# HELP customers_outbox_publication_total");
    expect(body).toContain("# HELP customers_welcome_email_delivery_total");
  });

  it("uses a custom Prometheus registry", async () => {
    const metricsRegistry = new MetricsRegistry();

    expect(await metricsRegistry.metrics()).toContain("# HELP process_cpu");
  });
});
