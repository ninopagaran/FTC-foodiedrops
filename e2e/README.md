# E2E Tests (Playwright)

## Commands

- `npm run e2e`
- `npm run e2e:headed`
- `npm run e2e:ui`

`playwright.config.ts` builds and runs preview automatically on `127.0.0.1:4173`.

## Credentialed Flows

These tests are auto-skipped unless env vars are set:

- `E2E_CUSTOMER_EMAIL`
- `E2E_CUSTOMER_PASSWORD`
- `E2E_VENDOR_EMAIL`
- `E2E_VENDOR_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

## First-time Setup

Install deps and browsers:

```bash
npm install
npx playwright install --with-deps chromium
```
