# Transactional outbox for customer events

We record `customer.created` in an `outbox_events` table in the same database transaction that creates the customer, then publish pending outbox events to RabbitMQ with publisher confirmations. This avoids losing integration events when the API persists a customer but crashes before RabbitMQ receives the message; the trade-off is accepting eventual publication and requiring consumers to tolerate duplicate deliveries.
