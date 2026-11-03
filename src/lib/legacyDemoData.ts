// Remove only obsolete application database mocks. Keep sessions, recovery IDs, themes and preferences.
const legacyDatabaseKeys = ['cv_companies','cv_gift_cards','cv_coupons','cv_orders','cv_redemptions','cv_issued_counts','cv_settlements','cv_withdrawals'];
export function clearLegacyDemoData(storage: Pick<Storage,'removeItem'>): void {
  for (const key of legacyDatabaseKeys) {
    try { storage.removeItem(key); } catch { /* Blocked storage must not prevent application startup. */ }
  }
}
