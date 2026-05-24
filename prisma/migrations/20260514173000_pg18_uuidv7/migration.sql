ALTER TABLE "Address" DROP CONSTRAINT "Address_customerId_fkey";

ALTER TABLE "Customer"
ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
ALTER COLUMN "id" SET DEFAULT uuidv7();

ALTER TABLE "Address"
ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
ALTER COLUMN "id" SET DEFAULT uuidv7(),
ALTER COLUMN "customerId" TYPE UUID USING "customerId"::uuid;

ALTER TABLE "Address"
ADD CONSTRAINT "Address_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
