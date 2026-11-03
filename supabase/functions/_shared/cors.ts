const origins = new Set(['https://coupon-frontend-e8b3.onrender.com', ...(Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('ALLOWED_ORIGIN') ?? 'https://couponvault.app')
  .split(',').map((origin: string) => origin.trim()).filter(Boolean)]);
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  return {
    ...(origin && origins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin',
  };
}
