-- Migration: 20261106111700_resilient_direct_checkout_snapshot.sql
-- Description: Make offer snapshot comparison resilient to JSON formatting, extra metadata and numeric scale in settle_verified_payment.

CREATE OR REPLACE FUNCTION public.settle_verified_payment(p_transaction_id uuid, p_capture_id text, p_amount numeric, p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.payment_transactions%ROWTYPE; result jsonb; issued record; card public.gift_cards%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted payment verification required'; END IF;
 SELECT * INTO t FROM public.payment_transactions WHERE id=p_transaction_id FOR UPDATE;
 result:=public.credit_verified_wallet_payment(p_transaction_id,p_capture_id,p_amount,p_currency);
 IF t.gift_card_id IS NULL THEN RETURN result; END IF;
 IF t.checkout_result IS NOT NULL THEN RETURN t.checkout_result || result; END IF;
 -- Never buy from a historical top-up or an incompletely persisted checkout.
 IF t.status='paid' OR t.offer_snapshot IS NULL THEN RAISE EXCEPTION 'Checkout binding is missing'; END IF;
 BEGIN
  IF t.checkout_cancelled THEN RAISE EXCEPTION 'Checkout cancelled'; END IF;
  SELECT * INTO card FROM public.gift_cards WHERE id=t.gift_card_id FOR UPDATE;
  IF NOT FOUND OR NOT card.is_active THEN
   RAISE EXCEPTION 'Card not found or inactive';
  END IF;
  IF round(card.price, 2) IS DISTINCT FROM round((t.offer_snapshot->>'price')::numeric, 2)
     OR upper(card.currency) IS DISTINCT FROM upper(t.offer_snapshot->>'currency')
     OR card.company_id IS DISTINCT FROM (t.offer_snapshot->>'company_id')::uuid THEN
   RAISE EXCEPTION 'Offer changed during payment';
  END IF;
  SELECT * INTO issued FROM public.issue_gift_card_coupon(t.gift_card_id,t.user_id,t.amount_major);
  result:=result || jsonb_build_object('purchaseStatus','issued','couponId',issued.coupon_id,'orderId',issued.order_id);
 EXCEPTION WHEN OTHERS THEN
  -- The failed purchase subtransaction rolls back; the verified credit remains recoverable by the customer.
  result:=result || jsonb_build_object('purchaseStatus','wallet_credited',
   'message','Payment received, but the coupon is no longer available on the same terms. The full payment is in your wallet.');
 END;
 SELECT result || jsonb_build_object('balance',wallet_balance) INTO result FROM public.profiles WHERE id=t.user_id;
 UPDATE public.payment_transactions SET checkout_result=result WHERE id=t.id;
 RETURN result;
END;
$$;
