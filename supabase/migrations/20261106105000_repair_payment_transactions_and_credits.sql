-- Migration: 20261106105000_repair_payment_transactions_and_credits.sql
-- Description: Align payment_transactions and payment_credits schema with payment processing and settlement procedures.

BEGIN;

-- 1. Adjust existing columns on payment_transactions
ALTER TABLE public.payment_transactions ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE public.payment_transactions ALTER COLUMN payment_gateway DROP NOT NULL;
ALTER TABLE public.payment_transactions ALTER COLUMN currency TYPE text;
ALTER TABLE public.payment_transactions ALTER COLUMN currency SET DEFAULT 'INR';

-- 2. Add missing columns expected by server and stored procedures
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS gateway text;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS gateway_order_id text;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS gateway_payment_id text;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS amount_major numeric;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS wallet_amount numeric;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS exchange_rate numeric;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS amount_usd numeric;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS amount_local numeric;

-- 3. Compatibility trigger for legacy and modern column names
CREATE OR REPLACE FUNCTION public.sync_payment_transaction_compat()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.gateway IS NOT NULL AND NEW.payment_gateway IS NULL THEN
    NEW.payment_gateway := upper(NEW.gateway);
  ELSIF NEW.payment_gateway IS NOT NULL AND NEW.gateway IS NULL THEN
    NEW.gateway := lower(NEW.payment_gateway);
  END IF;

  IF NEW.amount_major IS NOT NULL AND NEW.amount IS NULL THEN
    NEW.amount := NEW.amount_major;
  ELSIF NEW.amount IS NOT NULL AND NEW.amount_major IS NULL THEN
    NEW.amount_major := NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payment_transaction_compat ON public.payment_transactions;
CREATE TRIGGER trg_sync_payment_transaction_compat
  BEFORE INSERT OR UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_transaction_compat();

-- 4. Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS payment_order_once ON public.payment_transactions(gateway, gateway_order_id) WHERE gateway_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_order ON public.payment_transactions(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_idempotency_key ON public.payment_transactions(idempotency_key);

-- 5. Create payment_credits table
CREATE TABLE IF NOT EXISTS public.payment_credits (
  transaction_id uuid PRIMARY KEY REFERENCES public.payment_transactions(id) ON DELETE RESTRICT,
  gateway text NOT NULL,
  capture_id text NOT NULL,
  amount_usd numeric,
  currency text,
  wallet_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gateway, capture_id)
);
ALTER TABLE public.payment_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_credits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_credits TO service_role;

-- 6. Ensure currency column on deposits table
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS currency text;

COMMIT;
