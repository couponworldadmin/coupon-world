# CouponVault security hardening — 3 November 2026

Status: code repair validated locally and prepared for release. Production database migration remains blocked by the paused Supabase project. No payment was performed during validation.

## Changes

- Removed the browser demo database and all financial/campaign mutation fallbacks. Database failures now fail visibly instead of manufacturing successful local results. Startup deletes only the eight obsolete `cv_*` database keys; authentication, theme preferences and payment recovery data remain intact.
- Added a production Content Security Policy to the built HTML and Render header configuration. Arbitrary inline scripts, inline event handlers, eval, plugins and foreign base URLs are blocked. The existing JSON-LD has an exact hash; theme initialization uses a local script. Existing hosting security headers remain in place.
- Removed PayPal's `test` client-ID fallback. Missing or placeholder configuration disables PayPal. Its SDK runs in a separate API-origin frame with a fresh nonce per response, exact parent-origin validation and source/channel-bound messages. The main app's session and database access are not passed to the frame. Existing server payment verification remains authoritative.
- Kept the coupon PayPal controls mounted while its saved order is awaiting approval; retries reuse that order instead of creating another.
- Prepared an incremental database repair: replace permissive company/campaign/profile policies; prevent merchant self-approval, owner/limit/destination tampering and campaign reassignment; remove both table and historic column grants for private company fields; restrict profile updates to preferences; revoke direct financial writes and customer execution of trusted settlement/redemption functions. Existing transactional admin/purchase RPCs remain in use.
- Included the repair as the final definitions in `ALL_IN_ONE_NEW_DATABASE.sql`. Use the separate incremental migration for the existing project after inspecting its live schema; the installer is not the production upgrade procedure.

## Validation

- Production frontend build and API typecheck passed.
- Lint: no errors; one existing React Fast Refresh warning in UserDashboard.
- 69 local tests passed: 6 authorization database, 9 checkout database, 2 CSP, 26 workflow, 3 parent-frame messaging and 23 API/payment tests.
- Local production preview login page rendered with no reported CSP errors. This build has no Supabase credentials; this does not establish authenticated production compatibility.
- Tested denied merchant/customer mutations, private column grants, locked users, fake wallet credits, replayed captures, stale checkout offers, fail-closed outages, targeted browser cleanup and forged frame messages. No charge or wallet credit was made.

## Production blocker and rollout requirements

The reconnected Supabase account lists `mrextbryyayaojorstml` (coupon Project), but its status is INACTIVE. A read-only SQL probe fails with “Database is possibly not accessible at the moment.” Resume is refused because organization member mvasagan099 has reached the two-active-free-project limit. Connecting the account alone does not resume the database. No unrelated project was paused or deleted.

The high-severity live authorization concern is still unresolved until the database is active, live policies/RPC definitions are inspected, the incremental repair is reconciled/applied, and denied/authorized access is verified against the real project. An empty advisory response while inactive is not a clean audit.

Deploy the API and frontend together (API frame route first). Confirm the actual Render HTTP CSP header; committing render.yaml alone may not synchronize dashboard-managed headers. The HTML policy provides the script restrictions independently, while existing X-Frame-Options provides framing protection. Verify the real PayPal SDK buttons and payment recovery controls in the deployed environment before enabling customer payments. Authenticated live flows and provider SDK compatibility remain unverified. A public API probe timed out; it was not treated as payment verification.

## Artifacts

- Incremental migration: `supabase/migrations/20261103073504_security_authorization_guards.sql`
- Read-only live policy/grant inventory: `supabase/tests/authorization_audit.sql`
- Shared CSP: `security/csp.mjs`
