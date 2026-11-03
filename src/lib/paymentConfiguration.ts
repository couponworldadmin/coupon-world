// Public client identifiers are configuration, never a substitute for server verification.
export function validPaypalClientId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id=value.trim();
  return id.length > 20 && /^[A-Za-z0-9_-]+$/.test(id) && !/^(test|sb|replace_with|placeholder)/i.test(id) ? id : null;
}
export const paypalClientId=validPaypalClientId(import.meta.env.VITE_PAYPAL_CLIENT_ID);
export const paypalConfigured=paypalClientId !== null;
