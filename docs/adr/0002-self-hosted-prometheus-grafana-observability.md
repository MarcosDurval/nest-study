# Self-hosted Prometheus and Grafana observability

We will add first-phase observability with self-hosted Prometheus and Grafana in Docker Compose, using application metrics plus RabbitMQ queue metrics to track customer creation, outbox publication, welcome email delivery, retries, and DLQ state. This keeps the study environment free of initial SaaS costs while making dashboards, datasources, and alert rules reproducible from versioned project files.

