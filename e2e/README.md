# E2E Tests (Playwright)

## Commands

- `npm run e2e`
- `npm run e2e:headed`
- `npm run e2e:ui`
- `npm run e2e:seed-users` (creates customer/vendor/admin test users and updates `.env.local`)

Security runtime suite:
- `npm run e2e -- e2e/security-flows.spec.ts`

Suggested `.env.local` additions for security/runtime E2E:

```bash
E2E_CUSTOMER_EMAIL=customer@example.com
E2E_CUSTOMER_PASSWORD=customer-password
E2E_VENDOR_EMAIL=vendor@example.com
E2E_VENDOR_PASSWORD=vendor-password
E2E_ADMIN_EMAIL=admin@example.com
E2E_ADMIN_PASSWORD=admin-password
E2E_DROP_ID=<approved-live-drop-id>
E2E_MUTABLE_DROP_ID=<safe-test-drop-id>
E2E_CHECK_STRIPE_DISPLAY=1
```

`playwright.config.ts` builds and runs preview automatically on `127.0.0.1:4173`.

## Credentialed Flows

These tests are auto-skipped unless env vars are set:

- `E2E_CUSTOMER_EMAIL`
- `E2E_CUSTOMER_PASSWORD`
- `E2E_VENDOR_EMAIL`
- `E2E_VENDOR_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_DROP_ID` (optional: fixed approved/live drop id for security tests)
- `E2E_MUTABLE_DROP_ID` (required for delete/inactive mutation test)
- `E2E_CHECK_STRIPE_DISPLAY=1` to enable Stripe hosted page total-amount assertion test

## First-time Setup

Install deps and browsers:

```bash
npm install
npx playwright install --with-deps chromium
```

Generate test users (then promote admin via SQL output):

```bash
npm run e2e:seed-users
```
