import { existsSync, readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..");

describe("observability stack configuration", () => {
  it("defines Prometheus, Grafana and RabbitMQ metrics in Docker Compose", () => {
    const compose = readProjectFile("docker-compose.yml");
    const envExample = readProjectFile(".env.example");

    expect(compose).toContain("prometheus:");
    expect(compose).toContain("prom/prometheus:");
    expect(compose).toContain("grafana:");
    expect(compose).toContain("grafana/grafana:");
    expect(compose).toContain(
      "rabbitmq-plugins enable --offline rabbitmq_prometheus",
    );
    expect(compose).toContain('"${RABBITMQ_PROMETHEUS_PORT}:15692"');
    expect(compose).toContain('"${PROMETHEUS_PORT}:9090"');
    expect(compose).toContain('"${GRAFANA_PORT}:3000"');

    expect(envExample).toContain("RABBITMQ_PROMETHEUS_PORT=15692");
    expect(envExample).toContain("PROMETHEUS_PORT=9090");
    expect(envExample).toContain("GRAFANA_PORT=3002");
  });

  it("provisions Prometheus scrape jobs for API, email service and RabbitMQ", () => {
    const prometheus = readProjectFile("docker/prometheus/prometheus.yml");

    expect(prometheus).toContain('job_name: "api"');
    expect(prometheus).toContain('"api:3000"');
    expect(prometheus).toContain('job_name: "email-service"');
    expect(prometheus).toContain('"email-service:3001"');
    expect(prometheus).toContain('job_name: "rabbitmq"');
    expect(prometheus).toContain('metrics_path: "/metrics/per-object"');
    expect(prometheus).toContain('"rabbitmq:15692"');
  });

  it("provisions Grafana datasource, dashboard and alert rules", () => {
    expectProjectFile("docker/grafana/provisioning/datasources/prometheus.yml");
    expectProjectFile("docker/grafana/provisioning/dashboards/dashboards.yml");
    expectProjectFile("docker/grafana/provisioning/alerting/alerts.yml");

    const dashboard = JSON.parse(
      readProjectFile("docker/grafana/dashboards/customers-observability.json"),
    ) as {
      title: string;
      panels: Array<{ title?: string }>;
    };
    const panelTitles = dashboard.panels.map((panel) => panel.title);

    expect(dashboard.title).toBe("Customers Observability");
    expect(panelTitles).toContain("Customer Creation Total");
    expect(panelTitles).toContain("Outbox Events by Status");
    expect(panelTitles).toContain("Welcome Email Delivery Total");
    expect(panelTitles).toContain("RabbitMQ Queue Depth");

    const alerts = readProjectFile(
      "docker/grafana/provisioning/alerting/alerts.yml",
    );

    expect(alerts).toContain("Email DLQ is not empty");
    expect(alerts).toContain("Outbox has failed events");
    expect(alerts).toContain("API scrape is down");
    expect(alerts).toContain("Email service scrape is down");
  });

  function expectProjectFile(path: string): void {
    expect(existsSync(join(root, path))).toBe(true);
  }

  function readProjectFile(path: string): string {
    return readFileSync(join(root, path), "utf8");
  }
});
