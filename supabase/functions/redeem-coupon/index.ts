import { clients, failure, json } from '../_shared/payment.ts';
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json(req, {});
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);
  try {
    const { userClient } = await clients(req);
    const { coupon_code, amount, request_id } = await req.json();
    if (typeof coupon_code !== 'string' || !coupon_code.trim()) throw new Error('Coupon code is required.');
    if (typeof request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request_id)) throw new Error('A stable UUID request_id is required.');
    const { data: rows, error: lookupError } = await userClient.rpc('validate_coupon', { p_code: coupon_code.trim() });
    if (lookupError || !rows?.[0]) throw new Error('Coupon not found or unauthorized.');
    const coupon = rows[0];
    const redeemAmount = amount ?? null;
    if (redeemAmount !== null && (typeof redeemAmount !== 'number' || !Number.isFinite(redeemAmount) || redeemAmount <= 0)) throw new Error('Invalid amount.');
    const { data, error } = await userClient.rpc('redeem_coupon_once', { p_coupon_id: coupon.coupon_id, p_amount: redeemAmount, p_request_id: request_id });
    if (error || !data) throw new Error(error?.message ?? 'Redemption was not confirmed.');
    return json(req, { success: true, ...data });
  } catch (error) { return failure(req, error); }
});
