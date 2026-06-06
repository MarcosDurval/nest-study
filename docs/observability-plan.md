# Observability implementation plan

This plan adds first-phase, no-initial-cost observability for the Customers project using self-hosted Prometheus and Grafana.

## Goals

- Measure successful and failed **Customer Creation**.
- Measure outbox publication success, failure, backlog, and stuck events.
- Measure **Welcome Email Delivery** success, failed attempts, retries, and DLQ outcomes.
- Measure RabbitMQ queue depth for the main, retry, and DLQ queues.
- Provide a versioned Grafana dashboard and Grafana-only alerts.
- Keep metrics free of customer identifiers and sensitive data.

## Non-goals

- No SaaS observability provider.
- No distributed tracing in this phase.
- No centralized logs in this phase.
- No Discord, Telegram, email, or external alert contact point in this phase.
- No domain entities or value objects should depend on Prometheus.

## Architecture

- Use `prom-client` directly in the NestJS processes.
- Add a technical `src/observability` module for metrics registry, metric definitions, `/metrics`, and `/health`.
- Expose API metrics on the existing API HTTP server.
- Expose `email-service` metrics and health on a small HTTP server owned by the worker process.
- Let Prometheus scrape:
  - `api:/metrics`
  - `email-service:/metrics`
  - RabbitMQ Prometheus endpoint
- Let Grafana read Prometheus as the datasource.
- Provision Grafana datasource, dashboard, and alert rules from files in the repository.

## Metrics

### API: Customer Creation

- `customers_customer_creation_total`
  - type: counter
  - labels: `outcome`, `reason`
  - examples:
    - `outcome="success", reason="none"`
    - `outcome="failure", reason="validation_error"`
    - `outcome="failure", reason="conflict"`
    - `outcome="failure", reason="domain_error"`
    - `outcome="failure", reason="unexpected_error"`

- `customers_customer_creation_duration_seconds`
  - type: histogram
  - labels: `outcome`

### API: Outbox Publication

- `customers_outbox_publication_total`
  - type: counter
  - labels: `event_type`, `outcome`, `reason`
  - examples:
    - `event_type="customer.created", outcome="success", reason="none"`
    - `event_type="customer.created", outcome="failure", reason="publish_failed"`
    - `event_type="customer.created", outcome="failure", reason="unsupported_event_type"`
    - `event_type="customer.created", outcome="failure", reason="invalid_payload"`

- `customers_outbox_publication_duration_seconds`
  - type: histogram
  - labels: `event_type`, `outcome`

- `customers_outbox_events`
  - type: gauge
  - labels: `status`
  - statuses: `pending`, `processing`, `published`, `failed`

- `customers_outbox_oldest_pending_age_seconds`
  - type: gauge
  - no labels

### Email Service: Welcome Email Delivery

- `customers_welcome_email_delivery_total`
  - type: counter
  - labels: `outcome`, `reason`
  - examples:
    - `outcome="success", reason="none"`
    - `outcome="failure", reason="send_failed"`
    - `outcome="failure", reason="invalid_payload"`

- `customers_welcome_email_delivery_duration_seconds`
  - type: histogram
  - labels: `outcome`

- `customers_welcome_email_retry_total`
  - type: counter
  - labels: `reason`

- `customers_welcome_email_dlq_total`
  - type: counter
  - labels: `reason`
  - reasons: `invalid_payload`, `retries_exhausted`

### RabbitMQ

Use RabbitMQ Prometheus metrics for queue depth and consumers.

Important queues:

- `email.customer-created`
- `email.customer-created.retry`
- `email.customer-created.dlq`

## Label rules

Allowed labels:

- `operation`
- `outcome`
- `reason`
- `event_type`
- `queue`
- `service`

Forbidden labels:

- `customerId`
- `email`
- `cpf`
- `name`
- full error message
- stack trace
- message id
- outbox event id

## Grafana dashboard

Create one dashboard: `Customers Observability`.

Sections:

1. Customer Creation
   - total creations
   - successful creation rate
   - failures by reason
   - creation duration

2. Outbox Publication
   - published events
   - failed publication attempts
   - outbox events by status
   - oldest pending outbox age

3. Welcome Email Delivery
   - successful email deliveries
   - failed delivery attempts
   - retries
   - DLQ by reason
   - delivery duration

4. RabbitMQ Queues
   - main queue depth
   - retry queue depth
   - DLQ depth
   - consumers, when available

## Grafana alerts

First-phase alerts are visible only inside Grafana.

- DLQ is not empty for 1 minute.
- Outbox has any `failed` event for 1 minute.
- Oldest pending outbox event is older than 2 minutes.
- Prometheus cannot scrape the API for 1 minute.
- Prometheus cannot scrape the email service for 1 minute.
- Email failures exceed successes over a 5 minute window.

No external contact point is configured in this phase.

## Implementation phases

### Phase 1: Observability module

Files likely involved:

- `src/observability/observability.module.ts`
- `src/observability/metrics.controller.ts`
- `src/observability/health.controller.ts`
- `src/observability/metrics.registry.ts`
- `src/observability/customer.metrics.ts`
- `src/observability/outbox.metrics.ts`
- `src/observability/email.metrics.ts`

Tasks:

- Add `prom-client`.
- Create a shared metrics registry.
- Add `/metrics`.
- Add `/health`.
- Register the module in the API.
- Start a small HTTP metrics server for `email-service`.

### Phase 2: Customer creation metrics

Files likely involved:

- `src/customers/presentation/graphql/customers.resolver.ts`
- `test/customers.resolver.spec.ts` or a new focused metrics spec

Tasks:

- Count successful `createCustomer` calls.
- Count validation, conflict, domain, and unexpected failures.
- Observe mutation duration.

### Phase 3: Outbox metrics

Files likely involved:

- `src/customers/infrastructure/outbox/customer-created-outbox.publisher.ts`
- `test/customer-created-outbox.publisher.spec.ts`

Tasks:

- Count successful publications.
- Count failed publication attempts by reason.
- Observe publication duration.
- Refresh outbox backlog gauges by status.
- Refresh oldest pending event age.

### Phase 4: Email worker metrics

Files likely involved:

- `src/email/customer-created-email.consumer.ts`
- `src/email/customer-welcome-email.sender.ts`
- `test/customer-created-email.consumer.spec.ts`
- `test/customer-welcome-email.sender.spec.ts`

Tasks:

- Count successful welcome email deliveries.
- Count failed delivery attempts.
- Count retry publications.
- Count DLQ publications by reason.
- Observe delivery duration.

### Phase 5: Docker Compose observability stack

Files likely involved:

- `docker-compose.yml`
- `.env.example`
- `docker/prometheus/prometheus.yml`
- `docker/grafana/provisioning/datasources/prometheus.yml`
- `docker/grafana/provisioning/dashboards/dashboards.yml`
- `docker/grafana/dashboards/customers-observability.json`

Tasks:

- Add Prometheus service.
- Add Grafana service.
- Enable RabbitMQ Prometheus metrics.
- Add scrape jobs for API, email service, and RabbitMQ.
- Expose Grafana on a host port.
- Avoid exposing worker metrics publicly unless needed for local study.

### Phase 6: Grafana provisioning

Tasks:

- Provision Prometheus datasource.
- Provision `Customers Observability` dashboard.
- Provision alert rules.
- Keep external contact points out of scope.

### Phase 7: Documentation

Files likely involved:

- `README.md`
- `docs/observability-plan.md`

Tasks:

- Document how to start the stack.
- Document Grafana URL and default credentials.
- Document metrics endpoints.
- Document that `/metrics` must not be publicly exposed outside local study environments.
- Document how to generate failures using the existing chaos compose file.

## Testing strategy

- Unit tests for metric increments in customer creation paths.
- Unit tests for outbox publication success/failure metrics.
- Unit tests for email success, retry, invalid payload, and DLQ metrics.
- Endpoint tests for `/metrics` and `/health`.
- Manual smoke test with Docker Compose:
  - create customers
  - observe creation metrics
  - enable failure simulation
  - observe retries and DLQ behavior
  - inspect Grafana dashboard and alerts

## Open implementation notes

- Prefer low-cardinality labels even when debugging is tempting.
- Keep domain code free of observability concerns.
- Do not put secrets for alert contact points in this first phase.
- Treat retries as normal flow; alert on DLQ, stuck backlog, failed outbox events, or missing scrapes.

