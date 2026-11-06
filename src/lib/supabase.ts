import { normalizeCardBackground } from './cardBackgrounds';
// src/lib/supabase.ts
import { createClient, FunctionsHttpError } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder.supabase.co";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "placeholder-anon-key";

export const isSupabaseConfigured =
  !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.warn(
    "[CouponWorld] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.\n" +
    "Copy .env.example to .env and add your Supabase credentials."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  global: { headers: {} },
  db: { schema: 'public' },
});

/**
 * Race a promise against a timeout so it never hangs forever.
 * Rejects with a TimeoutError after `ms` milliseconds.
 */
class TimeoutError extends Error {
  constructor(ms: number) { super(`Request timed out after ${ms}ms`); this.name = 'TimeoutError'; }
}
const hasTimedOut = false;

async function withTimeout<T>(promise: PromiseLike<T>, ms = 15000): Promise<T> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured, failing fast.");
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([Promise.resolve(promise), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    })]);
  } finally { clearTimeout(timer!); }
}

// ---- Interfaces --------------------------------------------------

export type RedemptionDestination = 'gaming' | 'lottery' | 'couponvault';

export interface Company {
  id: string;
  name: string;
  prefix: string;
  coupon_limit: number;
  created_at: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  gstin?: string;
  pan?: string;
  address?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  document_url?: string;
  owner_id?: string;
  logo_url?: string;
  country_code?: string | null;
  redemption_destination?: RedemptionDestination | null;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  routing_number: string;
  account_number: string;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface UserDeposit {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  reference_id?: string;
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
}

export interface GiftCard {
  id: string;
  company_id: string;
  company_name?: string;
  country_code?: string | null;
  currency?: string | null;
  title: string;
  description: string;
  value: number;
  price: number;
  expiry_date: string;
  banner_image: string;
  terms: string;
  issue_limit?: number | null;
  created_at: string;
  issued_count?: number;
  is_active?: boolean;
  redemption_destination?: RedemptionDestination | null;
}

export interface Coupon {
  id: string;
  company_id: string;
  company_name?: string;
  company_address?: string;
  company_prefix?: string;
  company_status?: string;
  company_logo_url?: string;
  gift_card_id?: string;
  card_title?: string;
  card_description?: string;
  card_banner?: string;
  card_value?: number;
  card_price?: number;
  card_terms?: string;
  code: string;
  is_used: boolean;
  issued_to: string | null;
  created_at: string;
  remaining_balance: number;
  expiry_date: string;
  status: 'active' | 'redeemed' | 'expired';
  redeemed_at?: string;
  country_code?: string | null;
  amount?: number;
  redemption_destination?: RedemptionDestination | null;
}

export interface RedemptionTransaction {
  id: string;
  coupon_id: string;
  coupon_code?: string;
  company_name?: string;
  amount: number;
  remaining_balance_after: number;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  company_id: string;
  coupon_id: string | null;
  gift_card_id?: string;
  status: "pending" | "paid" | "failed";
  amount: number;
  payment_details?: any;
  created_at: string;
  company?: { name: string; prefix: string };
  coupon?: { code: string; amount?: number; country_code?: string; expiry_date?: string; is_used: boolean; remaining_balance: number; status: string } | null;
}

export interface CouponPreview {
  coupon_id: string;
  company_name: string;
  is_used: boolean;
  expiry_date: string | null;
  status: string;
  redemption_destination?: RedemptionDestination | null;
  can_redeem: boolean;
}

export interface CouponValidation {
  company_name: string;
  coupon_code: string;
  is_used: boolean;
  issued_at: string;
  remaining_balance: number;
  expiry_date: string;
  status: string;
  coupon_id: string;
  redemption_destination?: RedemptionDestination | null;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  role: string;
}

export interface AdminPurchasedCoupon {
  coupon_id: string;
  coupon_code: string;
  company_name: string;
  is_used: boolean;
  purchased_at: string;
  user_id: string;
  user_email: string;
  redeemed_at?: string;
  remaining_balance: number;
  status: string;
  price?: number;
  value?: number;
  country_code?: string | null;
  currency?: string;
}

export interface Settlement {
  id: string;
  company_id: string;
  period_month: string;
  currency?: string | null;
  total_redemptions: number;
  amount_due: number;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at?: string;
  company?: { name: string; prefix: string };
}

export interface CompanyStats {
  company: Company;
  issued: number;
  remaining: number;
}

// ---- Company / Onboarding API ------------------------------------

async function getCompany(id: string): Promise<Company> {
  const { data, error } = await withTimeout(supabase.rpc('get_companies').eq('id', id).single());
  if (error || !data) throw error ?? new Error('Company was not found.');
  return data as Company;
}

export async function getCompanies(): Promise<Company[]> {
  const { data, error } = await withTimeout(
    supabase
      .rpc("get_companies")
      .order("created_at", { ascending: false }),
    8000
  );
  if (error) throw error;
  return data ?? [];
}

export async function getCompanyByOwner(ownerId: string): Promise<Company | null> {
  if (!isSupabaseConfigured || hasTimedOut) throw new Error("Coupon database is unavailable. Please retry.");
  const { data, error } = await withTimeout(
    supabase
      .rpc("get_companies")
      .eq("owner_id", ownerId)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    8000
  );
  if (error) throw error;
  return data as Company | null;
}

const MERCHANT_DOCUMENT_BUCKET = 'merchant-documents';
export async function uploadMerchantDocument(userId: string, file: File): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('Document upload is unavailable until Supabase is configured.');
  const extensions: Record<string,string> = { 'application/pdf':'pdf', 'image/jpeg':'jpg', 'image/png':'png' };
  if (!extensions[file.type] || file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('Choose a PDF, JPG or PNG up to 5 MB.');
  const path = `${userId}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const { error } = await supabase.storage.from(MERCHANT_DOCUMENT_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
  if (error) throw error;
  return path;
}
export async function getMerchantDocumentUrl(path: string): Promise<string> {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(path)) throw new Error('No uploaded document is available. Ask the merchant to resubmit.');
  const { data, error } = await supabase.storage.from(MERCHANT_DOCUMENT_BUCKET).createSignedUrl(path,60,{download:true});
  if (error) throw error;
  return data.signedUrl;
}

export async function submitOnboarding(companyData: Partial<Company>): Promise<Company> {
  const insertPayload = {
    name: companyData.name,
    prefix: (companyData.prefix ?? "MCH").toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X').substring(0, 3),
    coupon_limit: companyData.coupon_limit ?? 100,
    status: "pending",
    gstin: companyData.gstin,
    pan: companyData.pan,
    address: companyData.address,
    bank_name: companyData.bank_name,
    account_number: companyData.account_number,
    ifsc_code: companyData.ifsc_code,
    document_url: companyData.document_url,
    owner_id: companyData.owner_id,
  };

  try {
    let response;
    if (companyData.owner_id) {
      const existingCompany = await getCompanyByOwner(companyData.owner_id);
      if (existingCompany) {
        response = await supabase
          .from("companies")
          .update({ name: insertPayload.name, gstin: insertPayload.gstin, pan: insertPayload.pan, address: insertPayload.address, bank_name: insertPayload.bank_name, account_number: insertPayload.account_number, ifsc_code: insertPayload.ifsc_code, document_url: insertPayload.document_url, status: "pending" })
          .eq("id", existingCompany.id)
          .select("id")
          .single();
      }
    }

    if (!response) {
      response = await supabase
        .from("companies")
        .insert(insertPayload)
        .select("id")
        .single();
    }

    const { data, error } = response;
    if (error) throw error;
    return getCompany(data.id);
  } catch (err: any) {
    if (isSupabaseConfigured) throw err;
    console.error("[CouponWorld] submitOnboarding failed on the live database:", err.message);
    throw new Error(err.message || "Database rejected the company profile. Check constraints or RLS policies.");
  }
}

export async function createCompany(
  companyData: Partial<Company>
): Promise<Company> {
    const { data, error } = await supabase
      .from("companies")
      .insert({
        ...companyData,
        prefix: companyData.prefix?.toUpperCase(),
        status: 'approved'
      })
      .select("id")
      .single();
    if (error) throw error;
    return getCompany(data.id);
}

export async function deleteCompany(id: string): Promise<void> {
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) throw error;
}

export async function updateCompanyLimit(id: string, limit: number): Promise<Company> {
    const { data, error } = await supabase
      .from("companies")
      .update({ coupon_limit: limit })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
    return getCompany(data.id);
}

export async function adminApproveCompany(id: string): Promise<Company> {
    const { data, error } = await supabase
      .from("companies")
      .update({ status: "approved" })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
    return getCompany(data.id);
}

export async function adminRejectCompany(id: string): Promise<Company> {
    const { data, error } = await supabase
      .from("companies")
      .update({ status: "rejected" })
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
    return getCompany(data.id);
}

export async function adminSetCompanyDestination(
  companyId: string,
  destination: RedemptionDestination | null
): Promise<Company> {
  const { data, error } = await supabase.rpc('admin_set_company_destination', {
    p_company_id: companyId,
    p_destination: destination,
  });
  if (error) throw error;
  if (!data) throw new Error('Company destination was not saved.');
  return data as Company;
}

export async function getCompanyStats(): Promise<CompanyStats[]> {
  const { data: companies, error: ce } = await supabase
    .rpc("get_companies")
    .order("created_at", { ascending: false });
  if (ce) throw ce;

  const { data: counts, error: cnte } = await supabase
    .from("coupons")
    .select("company_id");
  if (cnte) throw cnte;

  const issuedMap: Record<string, number> = {};
  (counts ?? []).forEach((c) => {
    issuedMap[c.company_id] = (issuedMap[c.company_id] ?? 0) + 1;
  });

  return (companies as Company[] ?? []).map((co: Company) => ({
    company: co,
    issued: issuedMap[co.id] ?? 0,
    remaining: co.coupon_limit - (issuedMap[co.id] ?? 0),
  }));
}

// ---- Gift Card API -----------------------------------------------

export async function getGiftCards(companyId?: string): Promise<GiftCard[]> {
  if (!isSupabaseConfigured || hasTimedOut) throw new Error("Coupon database is unavailable. Please retry.");

  // First, try the new RPC which bypasses RLS to get global counts
  const { data, error } = await supabase.rpc('get_gift_cards_with_counts');

  if (error) throw error;


  const remoteCards: GiftCard[] = (data ?? []).filter((d: any) => !companyId || d.company_id === companyId).map((d: any) => ({
    ...d,
    company_name: d.company_name || d.companies?.name,
    redemption_destination: d.redemption_destination ?? d.companies?.redemption_destination ?? null,
    // Inventory counts come only from the database.
    issued_count: Number(d.issued_count || 0)
  }));

  if (remoteCards.length > 0) {
    // Preserve distinct offers even when their titles match.
    const seenIds = new Set<string>();
    const deduped: GiftCard[] = [];
    for (const card of remoteCards) {
      if (!seenIds.has(card.id)) { seenIds.add(card.id); deduped.push(card); }
    }
    return deduped;
  }

  return [];
}

export async function createGiftCard(giftCardData: Omit<GiftCard, 'id' | 'created_at'>): Promise<GiftCard> {
  const { data, error } = await supabase
    .from("gift_cards")
    .insert(giftCardData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGiftCardCountry(id: string, countryCode: string): Promise<void> {
  const { data, error } = await supabase.from('gift_cards').update({ country_code: countryCode }).eq('id', id).select('id').single();
  if (error || !data) throw error ?? new Error('Coupon country was not saved.');
}

export async function updateGiftCardBanner(id: string, companyId: string, previousImage: string | null, image: string): Promise<void> {
  const banner = normalizeCardBackground(image);
  if (!banner) throw new Error('Choose a preset or a valid HTTPS image URL.');
  if (!isSupabaseConfigured) throw new Error('Coupon database is not configured.');
  let query = supabase.from('gift_cards').update({ banner_image: banner }).eq('id', id).eq('company_id', companyId);
  query = previousImage == null ? query.is('banner_image', null) : query.eq('banner_image', previousImage);
  const { data, error } = await query.select('id').single();
  if (error || !data) throw new Error('Background was not saved. The coupon may have changed or your merchant access may have expired. Reload before retrying.');
}

export interface UpdateGiftCardInput {
  title?: string;
  description?: string;
  terms?: string;
  price?: number;
  value?: number;
  expiry_date?: string;
  country_code?: string | null;
  banner_image?: string;
  issue_limit?: number | null;
  is_active?: boolean;
}

export async function updateGiftCard(
  id: string,
  companyId: string,
  updates: UpdateGiftCardInput
): Promise<GiftCard> {
  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title.trim();
  if (updates.description !== undefined) payload.description = updates.description.trim();
  if (updates.terms !== undefined) payload.terms = updates.terms.trim();
  if (updates.price !== undefined) {
    if (!Number.isFinite(updates.price) || updates.price < 0) throw new Error('Price cannot be negative.');
    payload.price = Math.round(updates.price * 100) / 100;
  }
  if (updates.value !== undefined) {
    if (!Number.isFinite(updates.value) || updates.value <= 0) throw new Error('Face value must be positive.');
    payload.value = Math.round(updates.value * 100) / 100;
  }
  if (updates.expiry_date !== undefined) payload.expiry_date = updates.expiry_date;
  if (updates.country_code !== undefined) payload.country_code = updates.country_code;
  if (updates.banner_image !== undefined) {
    const banner = normalizeCardBackground(updates.banner_image);
    if (!banner) throw new Error('Choose a preset or valid HTTPS image URL.');
    payload.banner_image = banner;
  }
  if (updates.issue_limit !== undefined) {
    if (updates.issue_limit !== null && (!Number.isFinite(updates.issue_limit) || updates.issue_limit <= 0)) {
      throw new Error('Issue limit must be positive.');
    }
    payload.issue_limit = updates.issue_limit;
  }
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  if (isSupabaseConfigured && !hasTimedOut) {
    const { data, error } = await supabase
      .from('gift_cards')
      .update(payload)
      .eq('id', id)
      .eq('company_id', companyId)
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to update campaign.');
    }
    return data as GiftCard;
  }

  throw new Error('Coupon database is unavailable. No campaign changes were saved.');
}

export async function toggleGiftCardActive(
  id: string,
  companyId: string,
  isActive: boolean
): Promise<void> {
  if (isSupabaseConfigured && !hasTimedOut) {
    const { error } = await supabase
      .from('gift_cards')
      .update({ is_active: isActive })
      .eq('id', id)
      .eq('company_id', companyId);

    if (error) throw error;
    return;
  }

  throw new Error('Coupon database is unavailable. No campaign changes were saved.');
}

export async function deleteGiftCard(id: string): Promise<void> {
  const { data, error } = await supabase.from("gift_cards").delete().eq("id", id).select("id");
  
  if (error) {
    console.error("[CouponWorld] deleteGiftCard failed:", error);
    if (error.code === '23503') { // foreign_key_violation
      throw new Error("Cannot delete this campaign because customers have already purchased vouchers from it.");
    }
    throw new Error(error.message);
  }
  
  if (!data || data.length === 0) {
    throw new Error("Deletion blocked by database security policy. The campaign either doesn't exist or you don't have permission.");
  }
}

// ---- Coupon Purchase Flow (RPC issue_gift_card_coupon equivalent) ----

export async function purchaseGiftCard(
  giftCardId: string,
  userId: string,
  _userEmail: string,
  amountPaid: number
): Promise<{ coupon_code: string; order_id: string; coupon_id: string }> {
  const { data, error } = await supabase.rpc("issue_gift_card_coupon", {
    p_gift_card_id: giftCardId,
    p_user_id: userId,
    p_amount: amountPaid
  });
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Failed to issue coupon");

  return {
    coupon_code: data[0].coupon_code,
    order_id: data[0].order_id,
    coupon_id: data[0].coupon_id
  };
}

export async function getUserOrders(userId: string) {
  if (!isSupabaseConfigured || hasTimedOut) throw new Error("Coupon database is unavailable. Please retry.");
  const { data, error } = await withTimeout(
    supabase
      .from("orders")
      .select(`
        *,
        company:companies(name, prefix),
        coupon:coupons(code, amount, country_code, expiry_date, is_used, remaining_balance, status)
      `)
      .eq("user_id", userId)
      .eq("status", "paid")
      .order("created_at", { ascending: false }),
    8000
  );
  if (error) throw error;

  return data ?? [];
}

export async function getUserGiftCards(userId: string): Promise<Coupon[]> {
  if (!isSupabaseConfigured || hasTimedOut) throw new Error("Coupon database is unavailable. Please retry.");
  let data: any[] | null = null;
  let error: any;

  try {
    const res = await withTimeout(
      supabase
        .from("coupons")
        .select("*, companies(name, prefix, status), gift_cards(title, description, banner_image, value, price, terms)")
        .eq("issued_to", userId)
        .order("created_at", { ascending: false }),
      8000
    );
    data = res.data;
    error = res.error;
  } catch (e: any) {
    error = e;
  }

  if (error) {
    const fallback = await withTimeout(
      supabase
        .from("coupons")
        .select("*, companies(name)")
        .eq("issued_to", userId)
        .order("created_at", { ascending: false }),
      8000
    );
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }

  const dbCoupons: Coupon[] = (data ?? []).map((d: any) => ({
    ...d,
    company_name: d.companies?.name || d.company_name,
    company_address: d.companies?.address,
    company_prefix: d.companies?.prefix,
    company_status: d.companies?.status,
    company_logo_url: d.companies?.logo_url,
    card_title: d.gift_cards?.title,
    card_description: d.gift_cards?.description,
    card_banner: d.gift_cards?.banner_image,
    card_value: d.gift_cards?.value,
    card_price: d.gift_cards?.price,
    card_terms: d.gift_cards?.terms,
    redemption_destination: d.redemption_destination ?? d.gift_cards?.redemption_destination ?? null,
  }));

  return dbCoupons;
}

export async function getCompanyCoupons(companyId: string): Promise<Coupon[]> {
  if (!isSupabaseConfigured || hasTimedOut) throw new Error("Coupon database is unavailable. Please retry.");
  const { data, error } = await withTimeout(
    supabase
      .from("coupons")
      .select("*, companies(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    8000
  );
  if (error) throw error;
  return (data ?? []).map(d => ({
    ...d,
    company_name: d.companies?.name
  }));
}

// ---- Scanner / Validation / Redemption API -----------------------

export async function getCouponPreview(reference: string): Promise<CouponPreview> {
  const { data, error } = await supabase.rpc('get_coupon_preview', { p_reference: reference.trim() });
  if (error) throw error;
  if (!data?.[0]) throw new Error('Invalid coupon link');
  return data[0] as CouponPreview;
}

export async function validateCoupon(code: string): Promise<CouponValidation> {
  const { data, error } = await supabase.rpc("validate_coupon", {
    p_code: code.toUpperCase().trim(),
  });
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Invalid coupon code");
  return data[0] as CouponValidation;
}

export async function validateCouponById(id: string): Promise<CouponValidation> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());

    const { data, error } = isUuid
      ? await supabase.rpc("validate_coupon_by_id", { p_coupon_id: id.trim() })
      : await supabase.rpc("validate_coupon", { p_code: id.trim().toUpperCase() });
    if (error) throw error;
    if (!data || data.length === 0) throw new Error(isUuid ? "Invalid coupon link" : "Invalid coupon code");
    return data[0] as CouponValidation;

}

export async function redeemCouponCv(
  couponId: string,
  requestId: string
): Promise<{ idempotent: boolean; remaining_balance: number; redeemed_amount?: number }> {
  const { data, error } = await withTimeout(
    supabase.rpc('redeem_coupon_cv', {
      p_coupon_id: couponId,
      p_request_id: requestId,
    })
  );
  if (error) throw error;
  return data;
}

export async function redeemCouponAmount(couponId: string, amount: number, requestId: string): Promise<{ remaining_balance: number; status: string }> {
  const { data, error } = await withTimeout(supabase.rpc('redeem_coupon_once', {
    p_coupon_id: couponId, p_amount: amount, p_request_id: requestId,
  }));
  if (error) throw error;
  if (!data || typeof data.remaining_balance !== 'number') throw new Error('Redemption was not confirmed.');
  return data;
}

export async function markCouponUsedById(id: string, requestId: string): Promise<string> {
  const coupon = await validateCouponById(id);
  // Only the server decides eligibility. Retrying a confirmed request must still work
  // when its balance is already zero. Never fall back to a second financial route.
  const result = await redeemCouponCv(coupon.coupon_id, requestId);
  if (!result || Number(result.remaining_balance) !== 0) throw new Error('Redemption was not confirmed.');
  return coupon.coupon_code;
}

export async function getRedemptionTransactions(couponId?: string, companyId?: string): Promise<RedemptionTransaction[]> {
  if (isSupabaseConfigured && hasTimedOut) throw new Error("Database unavailable. Please retry.");
  let dbList: (RedemptionTransaction & { company_id?: string })[] = [];
  if (isSupabaseConfigured && !hasTimedOut) {
    // Attempt standard read
    const query = supabase.from("redemptions").select("*, coupons(code, company_id, companies(name))");
    const { data, error } = await withTimeout(query.order("created_at", { ascending: false }), 8000);
    if (error) throw error;
    if (data) {
      dbList = data.map(d => ({
        id: d.id,
        coupon_id: d.coupon_id,
        coupon_code: d.coupons?.code,
        company_name: d.coupons?.companies?.name,
        company_id: d.coupons?.company_id,
        amount: Number(d.amount),
        remaining_balance_after: Number(d.remaining_balance_after),
        created_at: d.created_at
      }));
    }
  }

  if (isSupabaseConfigured) {
    return dbList.filter(row => (!couponId || row.coupon_id === couponId) && (!companyId || row.company_id === companyId));
  }

  throw new Error('Verified redemption history is unavailable.');
}

// Deprecated old coupon methods kept for compatibility with existing tests/shims
export async function markCouponUsed(code: string, requestId: string): Promise<void> {
  await markCouponUsedById(code, requestId);
}

export async function issueCoupon(
  companyId: string,
  userId: string
): Promise<{ coupon_code: string; order_id: string; coupon_id: string }> {
  const { data, error } = await supabase.from("gift_cards").select("id,price")
    .eq("company_id", companyId).eq("is_active", true).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Select an available gift card before purchasing.");
  return purchaseGiftCard(data.id, userId, "", data.price);
}

// ---- Admin Management helpers ------------------------------------

export async function adminGetUsers(page: number = 0, pageSize: number = 20): Promise<AdminUser[]> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await withTimeout(supabase.rpc("admin_get_users").range(from, to), 8000);
  if (error) throw error;
  return data ?? [];
}

export async function adminGetPurchasedCoupons(page: number = 0, pageSize: number = 20): Promise<AdminPurchasedCoupon[]> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase.rpc("admin_get_purchased_coupons").range(from, to);
  if (error) throw error;
  return data ?? [];
}

export async function adminSuspendCompany(companyId: string): Promise<Company> {
  const {data,error}=await supabase.rpc('admin_suspend_company',{p_company_id:companyId});
  if (error) throw error;
  if (!data) throw new Error('Company status was not saved.');
  return data as Company;
}

export async function adminUnsuspendCompany(companyId: string): Promise<Company> {
  const {data,error}=await supabase.rpc('admin_unsuspend_company',{p_company_id:companyId});
  if (error) throw error;
  if (!data) throw new Error('Company status was not saved.');
  return data as Company;
}

export async function getUserProfileData(userId: string): Promise<{
  wallet_balance: number;
  paypal_email: string | null;
  country: string | null;
  country_code: string | null;
  currency: string | null;
  timezone: string | null;
  phone_country_code: string | null;
}> {
  let data, error;
  
  // Try fetching all profile fields including country/currency
  const res1 = await withTimeout(
    supabase
      .from("profiles")
      .select("wallet_balance, paypal_email, country, country_code, currency, timezone, phone_country_code")
      .eq("id", userId)
      .maybeSingle(),
    6000
  );
  
  data = res1.data;
  error = res1.error;

  // If it fails (e.g. missing columns), fallback to just wallet_balance
  if (error) {
    console.warn("Could not fetch full profile, falling back to wallet_balance only:", error.message);
    const res2 = await withTimeout(
      supabase
        .from("profiles")
        .select("wallet_balance")
        .eq("id", userId)
        .maybeSingle(),
      6000
    );
    data = res2.data;
    error = res2.error;
  }

  if (error) throw error;

  // Proactively sweep and remove any legacy cv_paypal_email keys from browser localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(`cv_paypal_email_${userId}`);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cv_paypal_email_')) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {}

  // Helper to extract user_metadata fallback if country_code is null in DB
  const getAuthMetadataFallback = async () => {
    try {
      const { data: authUserData } = await supabase.auth.getUser();
      const meta = authUserData?.user?.user_metadata;
      if (meta?.country_code || meta?.country) {
        return {
          country:            meta.country ?? null,
          country_code:       meta.country_code ?? null,
          currency:           meta.currency ?? null,
          timezone:           meta.timezone ?? null,
          phone_country_code: meta.phone_country_code ?? null,
        };
      }
    } catch {
      // Ignore auth metadata fetch error
    }
    return null;
  };

  if (data) {
    let country            = (data as any).country ?? null;
    let countryCode        = (data as any).country_code ?? null;
    let currency           = (data as any).currency ?? null;
    let timezone           = (data as any).timezone ?? null;
    let phoneCountryCode   = (data as any).phone_country_code ?? null;

    if (!countryCode) {
      const metaFallback = await getAuthMetadataFallback();
      if (metaFallback?.country_code) {
        country          = metaFallback.country;
        countryCode      = metaFallback.country_code;
        currency         = metaFallback.currency;
        timezone         = metaFallback.timezone;
        phoneCountryCode = metaFallback.phone_country_code;

        // Sync to profiles table in background
        void updateUserProfile(userId, {
          country:            country ?? undefined,
          country_code:       countryCode ?? undefined,
          currency:           currency ?? undefined,
          timezone:           timezone ?? undefined,
          phone_country_code: phoneCountryCode ?? undefined,
        }).catch(() => {});
      }
    }

    return {
      wallet_balance:     (data as any).wallet_balance ?? 0,
      paypal_email:       (data as any).paypal_email ?? null,
      country,
      country_code:       countryCode,
      currency,
      timezone,
      phone_country_code: phoneCountryCode,
    };
  }
  
  // If no profile exists, create one with 0 balance
  const metaFallback = await getAuthMetadataFallback();
  const { data: newProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id:                 userId,
      wallet_balance:     0,
      country:            metaFallback?.country ?? null,
      country_code:       metaFallback?.country_code ?? null,
      currency:           metaFallback?.currency ?? null,
      timezone:           metaFallback?.timezone ?? null,
      phone_country_code: metaFallback?.phone_country_code ?? null,
    })
    .select("wallet_balance")
    .single();
    
  if (insertError) throw insertError;
  return {
    wallet_balance:     newProfile?.wallet_balance ?? 0,
    paypal_email:       null,
    country:            metaFallback?.country ?? null,
    country_code:       metaFallback?.country_code ?? null,
    currency:           metaFallback?.currency ?? null,
    timezone:           metaFallback?.timezone ?? null,
    phone_country_code: metaFallback?.phone_country_code ?? null,
  };
}

export async function getUserWalletBalance(userId: string): Promise<number> {
  const profile = await getUserProfileData(userId);
  return profile.wallet_balance;
}

/** Update user's country, currency, and related locale fields */
export async function updateUserProfile(
  userId: string,
  data: {
    country?: string;
    country_code?: string | null;
    currency?: string;
    timezone?: string;
    phone_country_code?: string;
    paypal_email?: string;
  }
): Promise<void> {
  const { error } = await withTimeout(
    supabase
      .from('profiles')
      .update(data)
      .eq('id', userId),
    8000
  );
  if (error) throw error;
}

export async function updateUserPaypalEmail(userId: string, email: string): Promise<void> {
  // Clear any legacy localStorage entry if present
  try {
    localStorage.removeItem(`cv_paypal_email_${userId}`);
  } catch {}

  const { error } = await supabase
    .from("profiles")
    .update({ paypal_email: email })
    .eq("id", userId);
  if (error) throw error;
}

// DEPRECATED: Do not use for financial transactions on the frontend
export async function updateBalances(_newBalance: number): Promise<void> {
  throw new Error('Balances can only be changed by verified server operations.');
}

// DEPRECATED & DISABLED: Direct client-side wallet funding is disabled for security.
// Funds must be added via verified server-side Edge Functions or the API server.
export async function addFunds(_userId: string, _amount: number, _paymentMethod: string = 'Wallet Top-up', _referenceId?: string): Promise<number> {
  throw new Error("Direct client-side fund addition is disabled for security. Use verified payment gateways.");
}

export async function getUserDeposits(userId: string): Promise<UserDeposit[]> {
  try {
    if (!isSupabaseConfigured || hasTimedOut) throw new Error("Verified financial history is unavailable. Check the connection and retry.");

    const depositsQuery = supabase
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const transfersQuery = supabase
      .from('wallet_transfers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const [depRes, trfRes] = await Promise.all([
      withTimeout(depositsQuery, 8000),
      withTimeout(transfersQuery, 8000),
    ]);

    if (depRes.error) throw depRes.error;
    if (trfRes.error) throw trfRes.error;

    const formatPaymentMethod = (method?: string) => {
      if (!method) return 'Wallet Top-up';
      return method
        .replace(/lottery\s+winnings?\s+transfer/gi, 'Winning Transfer')
        .replace(/lottery\s+winnings?/gi, 'Winning Transfer')
        .replace(/\blottery\b/gi, '')
        .trim() || 'Wallet Top-up';
    };

    const dbDeposits: UserDeposit[] = ((depRes as any)?.data ?? []).map((d: any) => ({
      id: d.id,
      user_id: d.user_id,
      amount: Number(d.amount),
      payment_method: formatPaymentMethod(d.payment_method),
      reference_id: d.reference_id || d.id,
      status: (d.status?.toLowerCase() === 'success' ? 'completed' : d.status?.toLowerCase()) || 'completed',
      created_at: d.created_at,
    }));

    const dbTransfers: UserDeposit[] = ((trfRes as any)?.data ?? []).map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      amount: Number(t.amount),
      payment_method: 'Winning Transfer',
      reference_id: t.transaction_id || t.reference_id || t.id,
      status: (t.status?.toLowerCase() === 'success' ? 'completed' : t.status?.toLowerCase()) || 'completed',
      created_at: t.created_at,
    }));

    const allCombined = [...dbDeposits, ...dbTransfers];
    return allCombined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (error) {
    throw error instanceof Error ? error : new Error("Could not load verified deposit history. Please retry.");
  }
}

/**
 * CRIT-05: This function has been intentionally disabled.
 * Wallet balance MUST only be modified by server-side Supabase RPCs or the backend API.
 * Direct client-side updates allow any user to set their balance to any value.
 *
 * All callers should be refactored to use server-side RPCs with RLS enforcement.
 * The Supabase migration also REVOKEs direct UPDATE on wallet_balance from the
 * authenticated role, so any remaining direct calls will fail at the database level.
 */
export async function updateUserWalletBalance(_userId: string, _amount: number): Promise<void> {
  // Balance is managed server-side only. This is intentionally a no-op.
  // After a balance-changing operation, always call refreshWalletBalance() to
  // re-read the authoritative value from the server.
  console.warn(
    '[CouponWorld] updateUserWalletBalance() is deprecated and has no effect. ' +
    'Use server-side RPCs for all balance modifications.'
  );
}

export async function ensureUserProfile(userId: string): Promise<void> {
  // Non-critical: silently attempt to create/verify the profile row.
  // This does not synthesize financial data or authorize a wallet change.
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle(),
      3000 // Profile creation is best-effort; financial reads remain authoritative.
    );

    if (error) return; // RLS error, table missing, etc. — all non-fatal
    if (data) return;

    // Profile row doesn't exist yet — create it
    await withTimeout(
      supabase
        .from("profiles")
        .insert({ id: userId, wallet_balance: 0 }),
      3000
    );
  } catch {
    // Swallow all errors silently — this is a best-effort operation
  }
}

async function readFunctionsInvokeErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    try {
      const clone = res.clone();
      const ct = clone.headers.get("Content-Type") ?? "";
      if (ct.includes("application/json")) {
        const json = (await clone.json()) as { error?: string; message?: string };
        if (json?.error) return json.error;
        if (json?.message) return json.message;
      } else {
        const text = await clone.text();
        if (text) return text.slice(0, 500);
      }
    } catch {
      /* ignore */
    }
    return `${error.message} (HTTP ${(error.context as Response)?.status ?? "?"})`;
  }
  return error instanceof Error ? error.message : String(error);
}

// Razorpay deposits removed — PayPal is the only supported deposit method.
// If Razorpay is reintroduced later, verify-razorpay-payment must fetch the
// captured amount from Razorpay's Payments API server-side and credit via
// add_funds_secure, exactly like verify-paypal-payment does. Do not restore
// a client-side wallet-crediting call for it.



// ---- PayPal API --------------------------------------------------------

export async function createPayPalOrder(input: {
  amount: number;
  currency?: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke("create-paypal-order", {
    body: {
      amount: input.amount,
      currency: input.currency ?? "INR",
      receipt: `wallet_topup_${Date.now()}`,
    },
  });

  if (error) {
    const msg = await readFunctionsInvokeErrorMessage(error);
    throw new Error(`Failed to create PayPal order: ${msg}`);
  }
  
  if (!data?.id) {
    throw new Error("PayPal order response was incomplete.");
  }
  
  return data as { id: string };
}

export async function verifyPayPalPayment(orderId: string): Promise<{ verified: boolean; amount?: number }> {
  if (!orderId) {
    throw new Error('Payment verification requires a PayPal orderId.');
  }

  const { data, error } = await supabase.functions.invoke('verify-paypal-payment', {
    body: { order_id: orderId },
  });

  if (error) {
    const msg = await readFunctionsInvokeErrorMessage(error);
    throw new Error(`Payment verification failed: ${msg}`);
  }

  const isVerified = !!data?.verified;
  const capturedAmount = data?.amount ? Number(data.amount) : undefined;

  return { verified: isVerified, amount: capturedAmount };
}

// ---- Withdrawal API ----------------------------------------------------

export async function createWithdrawal(_userId: string, amount: number, routing: string, account: string, currency = 'USD') {
  const { data, error } = await withTimeout(supabase.rpc('request_withdrawal', {
    p_amount: amount, p_currency: currency, p_routing: routing, p_account: account,
  }));
  if (error) throw error;
  if (!data) throw new Error('Withdrawal was not confirmed.');
  return data;
}

export async function getUserWithdrawals(userId: string) {
  const { data, error } = await withTimeout(
    supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  );

  if (error) throw error;
  return data as Withdrawal[];
}

// ---- Settlements API ----

export async function adminGenerateSettlements(year: number, month: number, companyId?: string): Promise<number> {
  const { data, error } = await supabase.rpc('generate_monthly_settlements', {
    p_year: year,
    p_month: month,
    p_company_id: companyId || null
  });
  if (error) throw error;
  return data as number;
}

export async function adminGetSettlements(): Promise<Settlement[]> {
  if (!isSupabaseConfigured || hasTimedOut) throw new Error("Coupon database is unavailable. Please retry.");
  const { data, error } = await withTimeout(
    supabase
      .from('settlements')
      .select('*, company:companies(name, prefix)')
      .order('period_month', { ascending: false })
      .order('created_at', { ascending: false })
  );
  if (error) throw error;
  return (data ?? []) as Settlement[];
}

export async function merchantGetSettlements(companyId: string): Promise<Settlement[]> {
  if (!isSupabaseConfigured || hasTimedOut) throw new Error("Coupon database is unavailable. Please retry.");
  const { data, error } = await withTimeout(
    supabase
      .from('settlements')
      .select('*, company:companies(name, prefix)')
      .eq('company_id', companyId)
      .order('period_month', { ascending: false })
  );
  if (error) throw error;
  return (data ?? []) as Settlement[];
}

export async function adminMarkSettlementPaid(settlementId: string): Promise<void> {
  const { error } = await withTimeout(supabase.rpc('admin_mark_settlement_paid', { p_settlement_id: settlementId }));
  if (error) throw error;
}

// ---- Admin Withdrawal Management ----

export interface AdminWithdrawal {
  id: string;
  user_id: string;
  email: string;
  country?: string | null;
  country_code?: string | null;
  currency?: string | null;
  amount: number;
  routing_number: string;
  account_number: string;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
}

export async function adminGetWithdrawals(): Promise<AdminWithdrawal[]> {
  const { data, error } = await withTimeout(
    supabase.rpc('admin_get_withdrawals'),
    8000
  );
  if (error) throw error;

  let rawList = (data ?? []) as AdminWithdrawal[];
  if (rawList.length > 0) {
    const userIds = Array.from(new Set(rawList.map(w => w.user_id)));
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, country, country_code, currency')
        .in('id', userIds);

      if (profiles && profiles.length > 0) {
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        rawList = rawList.map(w => {
          const prof = profileMap.get(w.user_id);
          return {
            ...w,
            country: w.country ?? prof?.country ?? null,
            country_code: w.country_code ?? prof?.country_code ?? null,
            currency: w.currency ?? prof?.currency ?? 'USD',
          };
        });
      }
    } catch (profErr) {
      console.warn("Could not load profiles for admin withdrawals:", profErr);
    }
  }
  return rawList;
}

export async function adminUpdateWithdrawalStatus(
  id: string,
  status: 'completed' | 'rejected'
): Promise<void> {
  const { data, error } = await withTimeout(
    supabase.from('withdrawals').update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'pending').select('id').maybeSingle(), 8000
  );
  if (error) throw error;
  if (!data) throw new Error('This withdrawal was already processed. Refresh the list.');
}

// ---- Support Ticket System ----------------------------------------

export interface SupportTicket {
  id: string;
  user_id: string;
  user_email?: string;
  subject: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
  latest_message?: string;
  message_count?: number;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

/** Customer creates a new support ticket (first message included) */
export async function createSupportTicket(
  subject: string,
  firstMessage: string,
  requestId: string
): Promise<SupportTicket> {
  const { data, error } = await withTimeout(supabase.rpc('create_support_ticket', {
    p_subject: subject, p_message: firstMessage, p_request_id: requestId,
  }), 8000);
  if (error) throw error;
  return data as SupportTicket;
}

/** Customer: get own tickets */
export async function getUserSupportTickets(userId: string): Promise<SupportTicket[]> {
  const { data, error } = await withTimeout(
    supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    8000
  );
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

/** Get all messages for a ticket thread */
export async function getSupportTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const { data, error } = await withTimeout(
    supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),
    8000
  );
  if (error) throw error;
  return (data ?? []) as SupportMessage[];
}

/** Post a new reply to a ticket thread */
export async function sendSupportMessage(
  ticketId: string,
  senderId: string,
  message: string,
  isAdmin: boolean
): Promise<void> {
  const { error: msgError } = await withTimeout(
    supabase.from('support_messages').insert({
      ticket_id: ticketId,
      sender_id: senderId,
      message,
      is_admin: isAdmin,
    }),
    8000
  );
  if (msgError) throw msgError;

  // Bump the updated_at on the ticket
  const { error: ticketError } = await withTimeout(
    supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString(), ...(isAdmin ? { status: 'in_progress' } : {}) })
      .eq('id', ticketId),
    8000
  );
  if (ticketError) throw ticketError;
}

/** Admin: get all tickets with user info */
export async function adminGetAllSupportTickets(): Promise<SupportTicket[]> {
  const { data, error } = await withTimeout(
    supabase
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false }),
    8000
  );
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

/** Admin: update ticket status */
export async function adminUpdateTicketStatus(
  ticketId: string,
  status: 'open' | 'in_progress' | 'closed'
): Promise<void> {
  const { error } = await withTimeout(
    supabase
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticketId),
    8000
  );
  if (error) throw error;
}

export async function adminSetAccountLocked(userId: string, locked: boolean): Promise<void> {
  const { error } = await withTimeout(supabase.rpc('admin_set_account_locked', { p_user_id: userId, p_locked: locked }));
  if (error) throw error;
}
export async function adminGetAccountLocks(): Promise<Record<string, boolean>> {
  const { data, error } = await withTimeout(supabase.rpc('admin_get_account_locks'));
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row: { id: string; is_locked: boolean }) => [row.id, row.is_locked]));
}

export interface CouponOfferDetails {
  coupon: GiftCard & { available_count: number };
  company: { name: string; address: string | null; joined_at: string; status: string };
}

// No local catalogue fallback for a page that can take payment.
export async function getCouponOfferDetails(id: string): Promise<CouponOfferDetails | null> {
  const { data, error } = await withTimeout(supabase.rpc('get_coupon_offer_details', { p_gift_card_id: id }));
  if (error) throw error;
  return data;
}

export async function purchaseGiftCardOnce(giftCardId: string, expectedPrice: number, requestId: string): Promise<{coupon_id: string; order_id: string}> {
  const {data,error}=await withTimeout(supabase.rpc('purchase_coupon_once',{p_gift_card_id:giftCardId,p_expected_price:expectedPrice,p_request_id:requestId}));
  if(error) throw error;
  if(!data?.coupon_id) throw new Error('Coupon confirmation is pending. Retry the same purchase.');
  return data;
}
