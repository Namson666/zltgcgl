-- Add persisted bank account for labor payment records.
-- The frontend and exports already expose this field; this migration makes the data contract real.
ALTER TABLE "payment_records" ADD COLUMN "bankAccount" TEXT;
