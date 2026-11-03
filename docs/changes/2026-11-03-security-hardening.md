# CouponVault security hardening — 3 November 2026

Status: code repair pushed as e189c40. The restored production database is ACTIVE_HEALTHY, and security_authorization_guards was applied successfully on 3 November 2026 as migration 20261103092149. Both Render services are verified live on commit e189c40. No payment was performed during validation.

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

## Initial production blocker and rollout requirements

The reconnected Supabase account lists `mrextbryyayaojorstml` (coupon Project), but its status is INACTIVE. A read-only SQL probe fails with “Database is possibly not accessible at the moment.” Resume is refused because organization member mvasagan099 has reached the two-active-free-project limit. Connecting the account alone does not resume the database. No unrelated project was paused or deleted.

The paused-database blocker described above was subsequently resolved. Live schema, policy, trigger and privileged-function definitions were inspected before applying the repair. An empty advisory response while inactive was not treated as a clean audit.

Both services subsequently deployed commit e189c40 successfully. The HTML CSP is active, but the frontend HTTP CSP header is still absent: the dashboard-managed header must be added separately. Existing X-Frame-Options: DENY remains present. The isolated deployed PayPal SDK renders its payment buttons without reported browser console errors; no button was used to create or approve an order. Authenticated live checkout, recovery and real payment/webhook completion remain unverified.

## Artifacts

- Incremental migration: `supabase/migrations/20261103073504_security_authorization_guards.sql`
- Read-only live policy/grant inventory: `supabase/tests/authorization_audit.sql`
- Shared CSP: `security/csp.mjs`

## Live database verification after restoration

- Confirmed ACTIVE_HEALTHY and a successful read-only SQL query.
- Applied the reviewed incremental repair successfully; migration history records security_authorization_guards at 20261103092149.
- Verified RLS on company, campaign, profile and financial tables, replacement policy names, and removal of direct financial INSERT/UPDATE/DELETE privileges.
- Verified that anonymous and authenticated roles cannot read company bank account fields. Customer wallet balance and account-lock updates are denied; the PayPal preference update remains permitted.
- Verified that settlement, credit, game verification/redemption and checkout-abandonment RPCs remain callable by service_role and cannot be called by anonymous or authenticated browser roles.
- Ran a read-only transaction under the authenticated database role using an existing active profile with ordinary-user claims: admin_get_users was denied, other profiles were invisible, wallet writes/payment insertion/bank reads/server credit RPC were denied, and get_companies/catalogue reads succeeded. The transaction was rolled back. No purchases, balance changes or customer records were written during verification.
- The security advisor still flags callable SECURITY DEFINER functions; callable alone is not proof of missing authorization. The inspected admin RPCs enforce active-account and admin checks. Public coupon-validation endpoints and full external application destination enforcement require separate review; this update does not certify the entire application.
- payment_credits intentionally has RLS with no browser policy because only trusted server paths should access it.
- Leaked-password protection remains disabled according to the live Auth advisor. No Auth setting was changed in this verification.

## Live deployment and remaining settings

- Frontend deployment dep-dbkpgvgae00c73fqiec0 and API deployment dep-dbkpgvgae00c73fqiegg are live on e189c40e7cc42bc78388839dd888e63d2718acc4.
- The live login page returns HTTP 200, includes the production HTML CSP and renders without reported browser errors. HSTS, X-Frame-Options: DENY, nosniff and Referrer-Policy remain present. The frontend HTTP Content-Security-Policy header is still absent.
- The deployed PayPal frame returns HTTP 200 for the authorized frontend origin, has a fresh-nonce CSP, Cache-Control: no-store and same-origin-allow-popups. The real PayPal SDK rendered PayPal and card controls without reported console warnings/errors. A frame requested for an unauthorized parent origin is rejected (HTTP 503); no order or capture was created.
- Unauthenticated empty requests to payment creation, verification and coupon options, plus an unauthenticated payment-status read, all return HTTP 401. These requests did not authorize financial activity.
- Both kyc and merchant-documents storage buckets are private.
- Supabase dashboard access was restored. mani's Org is on Free. The leaked-password switch could be toggled in the form, but did not persist after saving/reloading and remains off. The dashboard and official documentation identify this as a Pro-or-above feature. No plan was purchased and no other Auth setting was changed.
- The Render browser was signed in as mvasagan099@gmail.com in Manivasagan's workspace. The live coupon-frontend service srv-dal4egdbedkc73b7omlg denied that account access. The user confirmed mvasagan099@gmail.com as the desired account. Adding the HTTP CSP header therefore requires that account to receive access to the service's My Workspace; no different service was modified.
- No additional application code changes were made during those live checks. The verification results are recorded in this report; the later legacy retirement is documented below.

## Deployment scope confirmed by the user

The user selected https://coupon-frontend-e8b3.onrender.com as the primary deployment. At that stage, the separate https://coupon-5mul.onrender.com service (srv-d9cshvpkh4rs73dbmgng in Manivasagan's workspace) was left unchanged. The user subsequently authorized repairing it; see the retirement verification below. At the time of that audit, its dashboard showed main commit 41a71d4979c5c5408b90870e946de6e3b49941f2, rather than the secured continuation branch.

Public verification of coupon-5mul confirmed no HTML CSP or HTTP CSP/X-Frame-Options headers, a bundled Supabase hostname ghoiannrniscrxedyzws.supabase.co, and a localhost:4000 payment base with bearer-token request construction. Cloudflare and Google HTTPS DNS both returned Status 3 (NXDOMAIN) for that hostname. No runtime token transmission was exercised; published code alone is not proof of credential exfiltration. These findings belong to that older deployment.

Public bundles on the selected e8b3 deployment instead contain https://mrextbryyayaojorstml.supabase.co and https://coupon-api-qyer.onrender.com. Its served payment module does not contain localhost:4000. The selected database was already verified active and healthy. No older deployment configuration, DNS, redirects or application code was changed during that read-only audit. The subsequent authorized retirement is recorded below.

## Legacy deployment retirement — completed live

The user subsequently requested that the three findings on coupon-5mul be resolved. Because e8b3 had already been selected as the primary app, the older build was retired through a redirect-only deployment. Its broken database was not restored or migrated, and no new payment/authentication origin was trusted.

- Isolated branch: codex/legacy-coupon-redirect. Initial redirect commit 732e987, retained-asset fix b31caeed3743f811e9ea1d595326e97a556c13e2. The primary development branch and its deployment were not changed by these commits.
- Render service srv-d9cshvpkh4rs73dbmgng now uses that branch, build command node scripts/build-legacy-redirect.mjs, publish directory dist. Its original On Commit automatic deployment setting was restored after the configuration change.
- Final deployment dep-dbkr828ae00c73fsm2v0 is verified Live on b31caee.
- The older URL now serves a minimal redirect document with an external local script, strict HTML CSP, an accessible fallback link and no application/API credentials. Browser navigation ends on the selected HTTPS e8b3 site. Paths, queries and fragments are preserved without allowing the incoming path to replace the trusted destination host.
- Render continued serving retained hashed assets after the initial deploy. The build now overwrites all 30 known former JavaScript paths with safe redirect code. Public verification checked all 30: every response had the redirect code, and none contained localhost:4000, the obsolete Supabase project reference or bearer-token request construction. The active entry page references no old application asset.
- Dashboard-managed response headers on /* are verified live: Content-Security-Policy with default-src none, self-only scripts/styles, frame-ancestors none and form-action none; X-Frame-Options DENY; Referrer-Policy no-referrer; Cache-Control no-store. These headers are scoped to the legacy redirect service.
- Browser root and /userlogin?audit=legacy-route#verification-only both redirected successfully; the final login URL preserved the path, query and fragment. Browser console inspection reported no warnings/errors for this verification.
- Three redirect regression tests pass, including destination-host injection checks and retained-asset content checks. Lint passes with the previously documented Fast Refresh warning.
- No production account, payment, coupon, wallet or customer record was changed. No private provider keys were transferred. Legacy frontend environment variables are no longer used by the redirect build.
- Render's automatic dependency installation reported 14 dependency advisories (12 moderate, 2 high). The redirect artifact uses only Node built-ins and publishes none of those packages. This task does not establish dependency clearance or full payment integrity for the separate primary application.

Evidence screenshot: coupon-legacy-security-headers.jpg in the session visualization artifacts. The primary app's separate HTTP CSP header and Pro-only leaked-password protection remain the previously documented outstanding items.
