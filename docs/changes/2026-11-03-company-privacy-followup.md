# Company privacy and CSP follow-up — 3 November 2026

## Company listing: fixed live

The existing get_companies function was executable by anonymous callers. Its implementation already masked private fields for non-owners, so returning blank GSTIN/PAN/bank columns was not evidence that later-populated fields would automatically leak. The requested stricter access model has now been implemented.

- Applied require_authenticated_companies to mrextbryyayaojorstml (remote migration version 20261103125126).
- Anonymous/PUBLIC execution revoked; signed-in customers and trusted service callers retain explicit execution permission.
- A function-level identity guard also rejects missing identity even if anonymous permission is accidentally granted again.
- Signed-in calls retain the active-account check. Owning merchants and active administrators retain private company details; other callers receive only explicitly selected branding fields. Other fields, including future private columns, remain NULL for non-owners.
- Seven isolated PostgreSQL-compatible regression tests passed with populated fictional GSTIN, PAN, bank, document and future-private fields. They also cover denied anonymous calls, missing identity, locked accounts, merchant/admin access and server compatibility.
- Live anonymous GET and POST requests through the public Supabase API both return HTTP 401 and PostgreSQL code 42501: permission denied for function get_companies.
- A live read-only authenticated-role check succeeded and found zero private rows outside the caller's own company. No company records were edited during verification.
- The security advisor no longer lists get_companies among anonymously executable SECURITY DEFINER functions (count decreased from four to three).
- The fresh installer includes the same final definition and grants.

## CSP

The primary e8b3 site's built HTML already included a CSP before scripts, and its existing X-Frame-Options header was DENY. The missing HTTP Content-Security-Policy response header has now been added for /*. Public HTTPS checks on both the homepage and /login return the exact header below, matching the existing application policy, render.yaml and payment integrations. Existing X-Frame-Options, MIME, referrer, permission and asset-cache headers were preserved.

Initial browser access was through Manivasagan's workspace, which Render denied access to the primary service. The user then completed sign-in to the owning My Workspace account. The header was saved on coupon-frontend, service srv-dal4egdbedkc73b7omlg, in workspace tea-d9m3t5gae00c73bcqlb0. No header was written to an unrelated service. This service is Blueprint-managed; its existing tracked render.yaml already contains the same policy, so the dashboard value matches the source configuration.

Request path: /*
Header name: Content-Security-Policy
Header value:

```
default-src 'self'; script-src 'self' 'sha256-sp6HoJpAks9+TpKdl0mtbOEI/tkPldZ+7udMgS5yZwA=' https://js.stripe.com https://*.js.stripe.com https://checkout.razorpay.com https://*.paypal.com https://*.paypalobjects.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://coupon-api-qyer.onrender.com https://*.stripe.com https://*.paypal.com https://*.paypalobjects.com https://*.razorpay.com; frame-src https://coupon-api-qyer.onrender.com https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://*.paypal.com https://*.razorpay.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; frame-ancestors 'none'
```

No passwords, private provider keys, customer financial records, purchases or wallet balances were changed.

## Final verification

- All 18 security tests pass (the existing 11 plus seven new company-privacy checks).
- Lint has no errors and one pre-existing Fast Refresh warning.
- The live login page renders under the HTTP policy with no reported browser warnings/errors. No login, password reset or financial transaction was performed.
- The old anonymous get_companies advisory is gone; remaining publicly callable functions are separate endpoints and are not certified by this fix.
- The incremental migration, fresh-installer update, regression tests and verification report are included together in the source change.
- Verification screenshot: coupon-primary-csp-live.jpg in the session visualization artifacts.
