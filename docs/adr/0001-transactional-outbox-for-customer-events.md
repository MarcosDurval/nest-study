# Transactional outbox for customer events

We record `customer.created` in an `outbox_events` table in the same database transaction that creates the customer. In the Docker topology, Debezium Server captures inserts in that outbox table from the PostgreSQL WAL and publishes the event payload to RabbitMQ. The NestJS polling publisher remains available behind `OUTBOX_PUBLISHER_ENABLED=true` for local or fallback runs without CDC.

This avoids losing integration events when the API persists a customer but crashes before RabbitMQ receives the message. The trade-off is accepting eventual publication, operating the CDC process and replication slot, and requiring consumers to tolerate duplicate deliveries.
