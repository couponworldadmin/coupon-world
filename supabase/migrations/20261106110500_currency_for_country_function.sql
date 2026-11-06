-- Migration: 20261106110500_currency_for_country_function.sql
-- Description: Define currency_for_country helper used by payment settlement and wallet credit verification procedures.

CREATE OR REPLACE FUNCTION public.currency_for_country(p_country text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE upper(trim(COALESCE(p_country, 'IN'))) 
   WHEN 'IN' THEN 'INR' 
   WHEN 'US' THEN 'USD' 
   WHEN 'GB' THEN 'GBP' 
   WHEN 'AE' THEN 'AED' 
   WHEN 'AU' THEN 'AUD' 
   ELSE 'INR'
 END;
$$;

REVOKE ALL ON FUNCTION public.currency_for_country(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.currency_for_country(text) TO anon, authenticated, service_role;
