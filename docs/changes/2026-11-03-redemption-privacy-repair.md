# Redemption and public scan security repair

The legacy amount-redemption route bypassed application restrictions, and public scan validation returned voucher codes and balances. PayPal wallet preflight also omitted the primary site's origin.

- Added one transactional redemption function for full and partial redemption. It checks caller authority, account locks, recipient country, issuer approval, expiry, status, destination and amount precision. A private receipt binds each retry ID to its actor, coupon and requested amount. Retired the legacy function and removed the frontend fallback. Existing full-redemption clients use the same guarded implementation.
- Restricted private validation to active recipients, approved owning merchants and administrators. A separate public scan projection returns status, branding and expiry without codes, balances, account identifiers or issue timestamps. Scan state resets on identity changes; failed requests retain their retry ID.
- Added the primary frontend to the exact Edge Function CORS allowlist, preserving configured origins. Gateway JWT verification and server-side authentication remain enabled.
- Removed client schema CREATE and table TRUNCATE privileges. New receipt storage has RLS and no client table grants.
- Reconciled the fresh-database installer with the incremental repair. The installer is for a new database; only the incremental migration is applied to the existing project.

Validation: 36 security tests and 26 workflow tests passed; production build passed. Lint has no errors and one existing Fast Refresh warning in UserDashboard. Financial tests use fictional records in isolated PGlite databases. No production payment or redemption is used for verification.

The unused issue-coupon Edge endpoint still fails closed because it passes a zero price; current frontend purchases do not use it. Leaked-password protection remains a separate paid-plan setting. These changes do not certify end-to-end payment capture or the entire application.
