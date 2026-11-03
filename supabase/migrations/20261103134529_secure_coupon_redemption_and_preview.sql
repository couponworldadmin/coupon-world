BEGIN;

-- Private receipts bind retries to both the authenticated actor and exact operation.
CREATE TABLE public.coupon_redemption_requests (
  actor_id uuid NOT NULL,
  request_id uuid NOT NULL,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id),
  requested_amount numeric,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id, request_id)
);
ALTER TABLE public.coupon_redemption_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coupon_redemption_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_coupon_once(p_coupon_id uuid, p_amount numeric, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 c public.coupons%ROWTYPE;
 receipt public.coupon_redemption_requests%ROWTYPE;
 recipient_country text;
 recipient_locked boolean;
 amount_to_redeem numeric;
 balance_after numeric;
 result_json jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_request_id IS NULL THEN
   RAISE EXCEPTION 'Authenticated account and request ID required' USING ERRCODE='42501';
 END IF;
 PERFORM public.assert_account_access(auth.uid());
 PERFORM pg_advisory_xact_lock(hashtextextended('cv:'||auth.uid()::text||':'||p_request_id::text,0));
 SELECT * INTO c FROM public.coupons WHERE id=p_coupon_id FOR UPDATE;
 IF NOT FOUND OR (c.issued_to IS DISTINCT FROM auth.uid() AND NOT public.is_admin() AND NOT EXISTS (
   SELECT 1 FROM public.companies co WHERE co.id=c.company_id AND co.owner_id=auth.uid() AND co.status='approved'
 )) THEN RAISE EXCEPTION 'Coupon not found or unauthorized' USING ERRCODE='42501'; END IF;
 IF c.redemption_destination IS DISTINCT FROM 'couponvault' THEN
   RAISE EXCEPTION 'Coupon destination is not CouponVault';
 END IF;
 SELECT * INTO receipt FROM public.coupon_redemption_requests
 WHERE actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN
   IF receipt.coupon_id IS DISTINCT FROM p_coupon_id OR receipt.requested_amount IS DISTINCT FROM p_amount THEN
     RAISE EXCEPTION 'Request ID was already used for a different redemption';
   END IF;
   RETURN receipt.result || jsonb_build_object('idempotent',true);
 END IF;
 -- Retain retries of successful requests created by the former full-redemption RPC.
 IF p_amount IS NULL AND EXISTS(SELECT 1 FROM public.coupon_redemptions cr
   WHERE cr.coupon_id=c.id AND cr.wallet_transaction_id=p_request_id::text
     AND cr.game_id='couponvault' AND cr.game_user_id=auth.uid()::text AND cr.status='SUCCESS') THEN
   RETURN jsonb_build_object('idempotent',true,'remaining_balance',0,'status','redeemed');
 END IF;
 SELECT country_code,is_locked INTO recipient_country,recipient_locked FROM public.profiles WHERE id=c.issued_to FOR SHARE;
 IF NOT FOUND OR recipient_locked IS DISTINCT FROM false OR c.country_code IS NULL
   OR public.currency_for_country(recipient_country) IS NULL OR c.country_code IS DISTINCT FROM recipient_country THEN
   RAISE EXCEPTION 'Recipient account or coupon country is unavailable';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.companies co WHERE co.id=c.company_id AND co.status='approved') THEN
   RAISE EXCEPTION 'Issuing company is not approved';
 END IF;
 IF c.is_used OR lower(c.status) IS DISTINCT FROM 'active' OR (c.expiry_date IS NOT NULL AND c.expiry_date<=now()) THEN
   RAISE EXCEPTION 'Coupon is not active';
 END IF;
 IF c.remaining_balance IS NULL OR NOT(c.remaining_balance>0 AND c.remaining_balance<=1000000)
   OR c.remaining_balance<>round(c.remaining_balance,2) THEN RAISE EXCEPTION 'Invalid coupon balance'; END IF;
 amount_to_redeem:=coalesce(p_amount,c.remaining_balance);
 IF NOT(amount_to_redeem>0 AND amount_to_redeem<=1000000) OR amount_to_redeem<>round(amount_to_redeem,2) THEN
   RAISE EXCEPTION 'Invalid redemption amount';
 END IF;
 IF amount_to_redeem>c.remaining_balance THEN RAISE EXCEPTION 'Insufficient coupon balance'; END IF;
 balance_after:=c.remaining_balance-amount_to_redeem;
 UPDATE public.coupons SET remaining_balance=balance_after,is_used=(balance_after=0),
   status=CASE WHEN balance_after=0 THEN 'redeemed' ELSE 'active' END,
   redeemed_at=CASE WHEN balance_after=0 THEN now() ELSE redeemed_at END WHERE id=c.id;
 INSERT INTO public.redemptions(coupon_id,amount,remaining_balance_after) VALUES(c.id,amount_to_redeem,balance_after);
 INSERT INTO public.coupon_redemptions(coupon_id,game_user_id,game_id,wallet_transaction_id,ip_address,device,status)
 VALUES(c.id,auth.uid()::text,'couponvault','cv:'||auth.uid()::text||':'||p_request_id::text,'0.0.0.0','web','SUCCESS');
 result_json:=jsonb_build_object('idempotent',false,'remaining_balance',balance_after,
   'redeemed_amount',amount_to_redeem,'status',CASE WHEN balance_after=0 THEN 'redeemed' ELSE 'active' END);
 INSERT INTO public.coupon_redemption_requests(actor_id,request_id,coupon_id,requested_amount,result)
 VALUES(auth.uid(),p_request_id,c.id,p_amount,result_json);
 RETURN result_json;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_coupon_once(uuid,numeric,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.redeem_coupon_once(uuid,numeric,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_coupon_cv(p_coupon_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT public.redeem_coupon_once(p_coupon_id,NULL,p_request_id);
$$;
REVOKE ALL ON FUNCTION public.redeem_coupon_cv(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.redeem_coupon_cv(uuid,uuid) TO authenticated;

-- Do not leave a non-idempotent fallback reachable, even through accidental regrants.
CREATE OR REPLACE FUNCTION public.redeem_coupon_amount(p_coupon_id uuid,p_amount numeric)
RETURNS TABLE(remaining_balance numeric,status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Legacy redemption is disabled. Use redeem_coupon_once with a request ID'; END;
$$;
REVOKE ALL ON FUNCTION public.redeem_coupon_amount(uuid,numeric) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.validate_coupon_by_id(p_coupon_id uuid)
 RETURNS TABLE(coupon_id uuid, company_name text, coupon_code text, is_used boolean, issued_at timestamp with time zone, remaining_balance numeric, expiry_date timestamp with time zone, status text, country_code text, redemption_destination text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN

  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
  PERFORM public.assert_account_access(auth.uid());
  RETURN QUERY
  SELECT
    c.id,
    co.name::text,
    c.code::text,
    c.is_used,
    c.created_at,
    c.remaining_balance,
    c.expiry_date,
    c.status,
    c.country_code::text,
    c.redemption_destination
  FROM public.coupons c
  JOIN public.companies co ON co.id = c.company_id
  WHERE c.id = p_coupon_id AND (c.issued_to=auth.uid() OR public.is_admin() OR
    (co.owner_id=auth.uid() AND co.status='approved'));
END;
$function$
;
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text)
 RETURNS TABLE(coupon_id uuid, company_name text, coupon_code text, is_used boolean, issued_at timestamp with time zone, remaining_balance numeric, expiry_date timestamp with time zone, status text, country_code text, redemption_destination text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN

  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
  PERFORM public.assert_account_access(auth.uid());
  RETURN QUERY
  SELECT
    c.id,
    co.name::text,
    c.code::text,
    c.is_used,
    c.created_at,
    c.remaining_balance,
    c.expiry_date,
    c.status,
    c.country_code::text,
    c.redemption_destination
  FROM public.coupons c
  JOIN public.companies co ON co.id = c.company_id
  WHERE upper(trim(c.code)) = upper(trim(p_code)) AND (c.issued_to=auth.uid() OR public.is_admin() OR
    (co.owner_id=auth.uid() AND co.status='approved'));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid coupon code';
  END IF;
END;
$function$
;
REVOKE ALL ON FUNCTION public.validate_coupon(text),public.validate_coupon_by_id(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text),public.validate_coupon_by_id(uuid) TO authenticated;

-- Public scan projection deliberately excludes redemption secrets and monetary values.
CREATE OR REPLACE FUNCTION public.get_coupon_preview(p_reference text)
RETURNS TABLE(coupon_id uuid,company_name text,is_used boolean,expiry_date timestamptz,status text,redemption_destination text,can_redeem boolean)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,co.name::text,c.is_used,c.expiry_date,c.status,c.redemption_destination,
   coalesce(co.status='approved' AND c.redemption_destination='couponvault' AND NOT c.is_used
     AND lower(c.status)='active' AND (c.expiry_date IS NULL OR c.expiry_date>now()) AND c.remaining_balance>0,false)
 FROM public.coupons c JOIN public.companies co ON co.id=c.company_id
 WHERE length(trim(p_reference)) BETWEEN 1 AND 160
   AND (c.id::text=lower(trim(p_reference)) OR upper(trim(c.code))=upper(trim(p_reference)))
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_coupon_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coupon_preview(text) TO anon,authenticated;
-- Browser roles never need schema creation or whole-table truncation.
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM PUBLIC,anon,authenticated;
COMMIT;
