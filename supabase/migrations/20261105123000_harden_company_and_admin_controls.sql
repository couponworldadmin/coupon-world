-- Migration: 20261105123000_harden_company_and_admin_controls.sql
-- Description: Synchronize live production database hardening into version-controlled migrations:
-- 1. Explicitly protect company is_approved and balance columns against unauthorized alteration.
-- 2. Enforce explicit search_path on admin_get_withdrawals and restrict EXECUTE to authenticated admins.
-- 3. Revoke direct write grants on companies and withdrawals from anon role.

-- 1. Harden protect_company_controls trigger function
CREATE OR REPLACE FUNCTION public.protect_company_controls()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') OR public.is_admin() THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.owner_id IS DISTINCT FROM auth.uid() OR (to_jsonb(NEW)->>'redemption_destination') IS NOT NULL THEN
   RAISE EXCEPTION 'Company ownership and destination require authorization';
  END IF;
  NEW.status:='pending'; 
  NEW.coupon_limit:=100;
  NEW.is_approved:=false;
  NEW.balance:=0;
 ELSE
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.coupon_limit IS DISTINCT FROM OLD.coupon_limit
   OR (to_jsonb(NEW)->'redemption_destination') IS DISTINCT FROM (to_jsonb(OLD)->'redemption_destination') THEN
   RAISE EXCEPTION 'Company ownership, limits and destination are controlled by administrators';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status='rejected' AND NEW.status='pending') THEN
   RAISE EXCEPTION 'Approval status is controlled by administrators';
  END IF;
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
   RAISE EXCEPTION 'Approval flag is controlled by administrators';
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
   RAISE EXCEPTION 'Company balance is controlled by system transactions';
  END IF;
 END IF;
 RETURN NEW;
END $function$;

-- 2. Harden admin_get_withdrawals search_path and execution grants
CREATE OR REPLACE FUNCTION public.admin_get_withdrawals()
 RETURNS TABLE(id text, user_id text, email text, country text, country_code text, currency text, amount numeric, routing_number text, account_number text, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    w.id::text,
    w.user_id::text,
    COALESCE(u.email, p.email, '')::text AS email,
    COALESCE(p.country, u.raw_user_meta_data->>'country', 'United States')::text AS country,
    COALESCE(p.country_code, u.raw_user_meta_data->>'country_code', 'US')::text AS country_code,
    COALESCE(p.currency, u.raw_user_meta_data->>'currency', 'USD')::text AS currency,
    w.amount,
    w.routing_number,
    w.account_number,
    w.status,
    w.created_at
  FROM public.withdrawals w
  LEFT JOIN auth.users u ON w.user_id::text = u.id::text
  LEFT JOIN public.profiles p ON w.user_id::text = p.id::text
  ORDER BY w.created_at DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_get_withdrawals() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_withdrawals() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_withdrawals() TO authenticated;

-- 3. Revoke direct write privileges from anon on companies and withdrawals
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.companies FROM anon;
GRANT SELECT ON public.companies TO anon;

REVOKE INSERT, UPDATE, DELETE ON public.withdrawals FROM anon;
REVOKE UPDATE, DELETE ON public.withdrawals FROM authenticated;
