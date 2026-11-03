SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('companies','gift_cards','profiles','coupons','orders','withdrawals','payment_transactions','payment_credits');
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT p.oid::regprocedure signature,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') anonymous_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') customer_execute
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef ORDER BY signature::text;
SELECT t.table_name,has_table_privilege('authenticated',format('public.%I',t.table_name),'INSERT') customer_insert,
 has_table_privilege('authenticated',format('public.%I',t.table_name),'UPDATE') customer_update
 FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_name IN ('coupons','orders','deposits','payment_transactions','payment_credits');
SELECT b.id,b.public FROM storage.buckets b WHERE b.id IN ('kyc','merchant-documents');
