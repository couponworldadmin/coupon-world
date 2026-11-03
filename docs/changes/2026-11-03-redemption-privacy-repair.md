# Redemption and public scan security repair

The legacy amount-redemption route bypassed application restrictions, and public scan validation returned voucher codes and balances. PayPal wallet preflight also omitted the primary site's origin.

- Added one transactional redemption function for full and partial redemption. It checks caller authority, account locks, recipient country, issuer approval, expiry, status, destination and amount precision. A private receipt binds each retry ID to its actor, coupon and requested amount. Retired the legacy function and removed the frontend fallback. Existing full-redemption clients use the same guarded implementation.
- Restricted private validation to active recipients, approved owning merchants and administrators. A separate public scan projection returns status, branding and expiry without codes, balances, account identifiers or issue timestamps. Scan state resets on identity changes; failed requests retain their retry ID.
- Added the primary frontend to the exact Edge Function CORS allowlist, preserving configured origins. Gateway JWT verification and server-side authentication remain enabled.
- Removed client schema CREATE and table TRUNCATE privileges. New receipt storage has RLS and no client table grants.
- Reconciled the fresh-database installer with the incremental repair. The installer is for a new database; only the incremental migration is applied to the existing project.

Validation: 36 security tests and 26 workflow tests passed; production build passed. Lint has no errors and one existing Fast Refresh warning in UserDashboard. Financial tests use fictional records in isolated PGlite databases. No production payment or redemption is used for verification.

The unused issue-coupon Edge endpoint still fails closed because it passes a zero price; current frontend purchases do not use it. Leaked-password protection remains a separate paid-plan setting. These changes do not certify end-to-end payment capture or the entire application.

Live verification on 3 November 2026:

- Incremental database repair applied successfully. Anonymous private validation and authenticated legacy redemption execution are revoked; the public preview remains available. Client CREATE is false and client TRUNCATE access covers zero application tables.
- Live anonymous preview of an existing reference returned one record with no coupon_code or remaining_balance field. The reference and customer values were not printed.
- Anonymous HTTP calls to both private lookup endpoints return 401 / PostgreSQL 42501. A nonexistent public preview returns 200 with an empty result.
- create-paypal-order, verify-paypal-payment and redeem-coupon deployed at version 2 with verify_jwt=true. All three return the exact primary origin for valid preflights, omit it for unapproved origins, and reject unauthenticated empty POSTs with 401.
- The primary frontend retains HTTP CSP and X-Frame-Options: DENY. Its scan route now permits the minimal public preview; code revelation and redemption remain subject to database authorization.
- Advisor notices for public catalogue/preview functions and signed-in guarded RPCs reflect intentional APIs; the two private lookup functions no longer appear in anonymous-execution warnings. Private receipt/payment tables have RLS with no client policies by design. Leaked-password protection remains disabled.
