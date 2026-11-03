-- Data-preserving authorization repair. Apply after the existing application migrations.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.is_admin()') IS NULL OR to_regprocedure('public.is_account_active(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Install the application security migrations before this repair';
 END IF;
END $$;

-- One reviewed authorization model; old permissive policies cannot OR around these rules.
DO $$ DECLARE t text; p record;
BEGIN
 FOREACH t IN ARRAY ARRAY['companies','gift_cards','profiles'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
  END LOOP;
 END LOOP;
END $$;
CREATE POLICY company_read ON public.companies FOR SELECT TO authenticated
 USING(public.is_account_active(auth.uid()) AND (public.is_admin() OR owner_id=auth.uid() OR status='approved'));
CREATE POLICY company_public_branding ON public.companies FOR SELECT TO anon USING(status='approved');
CREATE POLICY company_insert ON public.companies FOR INSERT TO authenticated
 WITH CHECK(public.is_account_active(auth.uid()) AND (public.is_admin() OR (owner_id=auth.uid() AND status='pending')));
CREATE POLICY company_update ON public.companies FOR UPDATE TO authenticated
 USING(public.is_account_active(auth.uid()) AND (public.is_admin() OR owner_id=auth.uid()))
 WITH CHECK(public.is_account_active(auth.uid()) AND (public.is_admin() OR owner_id=auth.uid()));
CREATE POLICY company_delete ON public.companies FOR DELETE TO authenticated
 USING(public.is_account_active(auth.uid()) AND public.is_admin());
REVOKE SELECT ON public.companies FROM PUBLIC,anon,authenticated;
-- Column grants survive table-level revocation; remove historic grants too.
DO $$ DECLARE col text; BEGIN
 FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' LOOP
  EXECUTE format('REVOKE SELECT(%I) ON public.companies FROM PUBLIC,anon,authenticated',col);
 END LOOP;
END $$;
GRANT SELECT(id,name,prefix,created_at,status,owner_id) ON public.companies TO anon,authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='redemption_destination') THEN
  GRANT SELECT(redemption_destination) ON public.companies TO authenticated;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.protect_company_controls()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') OR public.is_admin() THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.owner_id IS DISTINCT FROM auth.uid() OR (to_jsonb(NEW)->>'redemption_destination') IS NOT NULL THEN
   RAISE EXCEPTION 'Company ownership and destination require authorization';
  END IF;
  NEW.status:='pending'; NEW.coupon_limit:=100;
 ELSE
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.coupon_limit IS DISTINCT FROM OLD.coupon_limit
   OR (to_jsonb(NEW)->'redemption_destination') IS DISTINCT FROM (to_jsonb(OLD)->'redemption_destination') THEN
   RAISE EXCEPTION 'Company ownership, limits and destination are controlled by administrators';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status='rejected' AND NEW.status='pending') THEN
   RAISE EXCEPTION 'Approval status is controlled by administrators';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_company_controls ON public.companies;
CREATE TRIGGER protect_company_controls BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.protect_company_controls();
REVOKE ALL ON FUNCTION public.protect_company_controls() FROM PUBLIC,anon,authenticated;

CREATE POLICY card_read ON public.gift_cards FOR SELECT TO authenticated USING(
 public.is_account_active(auth.uid()) AND (public.is_admin() OR EXISTS(
  SELECT 1 FROM public.companies c WHERE c.id=company_id AND (c.owner_id=auth.uid() OR
   (c.status='approved' AND is_active AND (expiry_date IS NULL OR expiry_date>now()))))));
CREATE POLICY card_insert ON public.gift_cards FOR INSERT TO authenticated WITH CHECK(
 public.is_account_active(auth.uid()) AND (public.is_admin() OR EXISTS(
  SELECT 1 FROM public.companies c WHERE c.id=company_id AND c.owner_id=auth.uid() AND c.status='approved')));
CREATE POLICY card_update ON public.gift_cards FOR UPDATE TO authenticated USING(
 public.is_account_active(auth.uid()) AND (public.is_admin() OR EXISTS(
  SELECT 1 FROM public.companies c WHERE c.id=company_id AND c.owner_id=auth.uid() AND c.status='approved')))
 WITH CHECK(public.is_account_active(auth.uid()) AND (public.is_admin() OR EXISTS(
  SELECT 1 FROM public.companies c WHERE c.id=company_id AND c.owner_id=auth.uid() AND c.status='approved')));
CREATE POLICY card_delete ON public.gift_cards FOR DELETE TO authenticated USING(
 public.is_account_active(auth.uid()) AND (public.is_admin() OR EXISTS(
  SELECT 1 FROM public.companies c WHERE c.id=company_id AND c.owner_id=auth.uid() AND c.status='approved')));
REVOKE ALL ON public.gift_cards FROM anon;

-- Do not allow campaign reassignment or merchant-written redemption scopes.
CREATE OR REPLACE FUNCTION public.protect_campaign_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE expected text; privileged boolean:=current_user IN ('postgres','supabase_admin','service_role') OR public.is_admin();
BEGIN
 IF TG_OP='UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
  RAISE EXCEPTION 'Campaign company cannot be changed';
 END IF;
 IF NOT (to_jsonb(NEW) ? 'redemption_destination') THEN RETURN NEW; END IF;
 SELECT c.redemption_destination INTO expected FROM public.companies c WHERE c.id=NEW.company_id;
 IF TG_OP='INSERT' THEN
  IF (to_jsonb(NEW)->>'redemption_destination') IS NOT NULL AND (to_jsonb(NEW)->>'redemption_destination') IS DISTINCT FROM expected THEN
   RAISE EXCEPTION 'Campaign destination must match its company';
  END IF;
  NEW:=jsonb_populate_record(NEW,jsonb_build_object('redemption_destination',expected));
 ELSIF (to_jsonb(NEW)->'redemption_destination') IS DISTINCT FROM (to_jsonb(OLD)->'redemption_destination') THEN
  IF NOT privileged OR (to_jsonb(OLD)->>'redemption_destination') IS NOT NULL OR (to_jsonb(NEW)->>'redemption_destination') IS DISTINCT FROM expected THEN
   RAISE EXCEPTION 'Campaign destination requires administrator classification and cannot change once assigned';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_campaign_scope() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS protect_campaign_scope ON public.gift_cards;
CREATE TRIGGER protect_campaign_scope BEFORE INSERT OR UPDATE ON public.gift_cards FOR EACH ROW EXECUTE FUNCTION public.protect_campaign_scope();

CREATE POLICY profile_read ON public.profiles FOR SELECT TO authenticated
 USING(public.is_account_active(auth.uid()) AND (id=auth.uid() OR public.is_admin()));
CREATE POLICY profile_update ON public.profiles FOR UPDATE TO authenticated
 USING(id=auth.uid() AND public.is_account_active(auth.uid()))
 WITH CHECK(id=auth.uid() AND public.is_account_active(auth.uid()));
REVOKE INSERT,UPDATE,DELETE ON public.profiles FROM anon,authenticated;
-- Grant only present preference columns; never wallet, role, lock or identity columns.
DO $$ DECLARE col text; BEGIN
 FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' LOOP
  EXECUTE format('REVOKE UPDATE(%I),INSERT(%I) ON public.profiles FROM PUBLIC,anon,authenticated',col,col);
 END LOOP;
 FOREACH col IN ARRAY ARRAY['paypal_email','country','country_code','currency','timezone','phone_country_code'] LOOP
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name=col) THEN
   EXECUTE format('GRANT UPDATE(%I) ON public.profiles TO authenticated',col);
  END IF;
 END LOOP;
END $$;

-- All money and issued-coupon writes must pass an authorized transactional RPC or trusted server.
DO $$ DECLARE t text; f record; col text; BEGIN
 FOREACH t IN ARRAY ARRAY['payment_transactions','payment_credits','coupons','orders','deposits','redemptions','wallet_transfers','settlements'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL THEN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON public.%I FROM PUBLIC,anon,authenticated',t);
   FOR col IN SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=t LOOP
    EXECUTE format('REVOKE INSERT(%I),UPDATE(%I) ON public.%I FROM PUBLIC,anon,authenticated',col,col,t);
   END LOOP;
  END IF;
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=ANY(ARRAY['settle_verified_payment','credit_verified_wallet_payment','add_funds_secure',
   'redeem_application_coupon','redeem_game_coupon','verify_game_coupon','abandon_coupon_checkout']) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
