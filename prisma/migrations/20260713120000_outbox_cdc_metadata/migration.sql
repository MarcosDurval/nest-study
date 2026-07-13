ALTER TABLE "outbox_events"
ADD COLUMN "aggregate_type" TEXT NOT NULL DEFAULT 'customer',
ADD COLUMN "aggregate_id" TEXT NOT NULL DEFAULT '';

CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");
