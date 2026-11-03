-- Require an authenticated customer or trusted server before listing companies.
-- Preserve full details for the owning merchant/admin and explicit public fields for others.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_companies()
RETURNS SETOF public.companies
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.companies%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
 END IF;
 IF auth.uid() IS NOT NULL THEN PERFORM public.assert_account_access(auth.uid()); END IF;
 FOR c IN SELECT * FROM public.companies ORDER BY created_at DESC LOOP
  IF public.is_admin() OR c.owner_id=auth.uid() THEN
   RETURN NEXT c;
  ELSIF c.status='approved' THEN
   RETURN NEXT jsonb_populate_record(NULL::public.companies,jsonb_build_object(
    'id',c.id,'name',c.name,'prefix',c.prefix,'status',c.status,'created_at',c.created_at));
  END IF;
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.get_companies() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_companies() TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
