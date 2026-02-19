import { APIRequestContext, expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type AuthSession = {
  access_token: string;
  user: { id: string; email?: string };
};

type DropRow = {
  id: string;
  name: string;
  image: string;
  price: number;
  tax_rate: number | null;
  delivery_fee: number | null;
  pass_stripe_fee: boolean | null;
  quantity_remaining: number;
  is_deleted: boolean | null;
  start_date: string;
  end_date: string;
};

const parseDotEnv = (): Record<string, string> => {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const entries: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    entries[key] = value;
  }
  return entries;
};

const localEnv = parseDotEnv();
const readEnv = (key: string): string => process.env[key] || localEnv[key] || '';
const SUPABASE_URL = readEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = readEnv('VITE_SUPABASE_ANON_KEY') || readEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY');

const CUSTOMER_EMAIL = readEnv('E2E_CUSTOMER_EMAIL');
const CUSTOMER_PASSWORD = readEnv('E2E_CUSTOMER_PASSWORD');
const VENDOR_EMAIL = readEnv('E2E_VENDOR_EMAIL');
const VENDOR_PASSWORD = readEnv('E2E_VENDOR_PASSWORD');
const ADMIN_EMAIL = readEnv('E2E_ADMIN_EMAIL');
const ADMIN_PASSWORD = readEnv('E2E_ADMIN_PASSWORD');
const E2E_DROP_ID = readEnv('E2E_DROP_ID');
const E2E_MUTABLE_DROP_ID = readEnv('E2E_MUTABLE_DROP_ID');

const looksLikePlaceholder = (value: string): boolean => {
  const v = (value || '').trim().toLowerCase();
  return (
    !v ||
    v.includes('example.com') ||
    v.includes('<') ||
    v.includes('your-') ||
    v === 'customer-password' ||
    v === 'vendor-password' ||
    v === 'admin-password'
  );
};

const hasBaseConfig = !!SUPABASE_URL && !!SUPABASE_ANON_KEY && !looksLikePlaceholder(SUPABASE_URL) && !looksLikePlaceholder(SUPABASE_ANON_KEY);
const hasUserPair =
  !!CUSTOMER_EMAIL &&
  !!CUSTOMER_PASSWORD &&
  !!VENDOR_EMAIL &&
  !!VENDOR_PASSWORD &&
  !looksLikePlaceholder(CUSTOMER_EMAIL) &&
  !looksLikePlaceholder(CUSTOMER_PASSWORD) &&
  !looksLikePlaceholder(VENDOR_EMAIL) &&
  !looksLikePlaceholder(VENDOR_PASSWORD);
const hasAdmin =
  !!ADMIN_EMAIL &&
  !!ADMIN_PASSWORD &&
  !looksLikePlaceholder(ADMIN_EMAIL) &&
  !looksLikePlaceholder(ADMIN_PASSWORD);
const CHECK_STRIPE_DISPLAY = readEnv('E2E_CHECK_STRIPE_DISPLAY') === '1';
const hasCustomer =
  !!CUSTOMER_EMAIL &&
  !!CUSTOMER_PASSWORD &&
  !looksLikePlaceholder(CUSTOMER_EMAIL) &&
  !looksLikePlaceholder(CUSTOMER_PASSWORD);
const hasVendor =
  !!VENDOR_EMAIL &&
  !!VENDOR_PASSWORD &&
  !looksLikePlaceholder(VENDOR_EMAIL) &&
  !looksLikePlaceholder(VENDOR_PASSWORD);

const apiHeaders = (token?: string) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: token ? `Bearer ${token}` : '',
  'Content-Type': 'application/json',
});

const loginWithPassword = async (
  request: APIRequestContext,
  email: string,
  password: string
): Promise<AuthSession> => {
  const response = await request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: apiHeaders(),
      data: { email, password },
    }
  );
  if (!response.ok()) {
    const status = response.status();
    const body = await response.text();
    throw new Error(
      `Supabase password login failed for ${email} (status ${status}). ` +
      `Response: ${body}. Check E2E_* credentials, confirmed email state, and rate limits.`
    );
  }
  return (await response.json()) as AuthSession;
};

const getBookingFeePerPackage = async (
  request: APIRequestContext,
  token: string
): Promise<number> => {
  const response = await request.get(
    `${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=booking_fee_per_package`,
    { headers: apiHeaders(token) }
  );
  expect(response.ok()).toBeTruthy();
  const rows = (await response.json()) as Array<{ booking_fee_per_package: number | string }>;
  if (!rows.length) return 0;
  return Number(rows[0].booking_fee_per_package || 0);
};

const getLiveApprovedDrop = async (
  request: APIRequestContext,
  token: string,
  specificDropId?: string
): Promise<DropRow> => {
  const nowIso = encodeURIComponent(new Date().toISOString());
  const baseSelect =
    'id,name,image,price,tax_rate,delivery_fee,pass_stripe_fee,quantity_remaining,is_deleted,start_date,end_date';
  const url = specificDropId
    ? `${SUPABASE_URL}/rest/v1/drops?id=eq.${encodeURIComponent(specificDropId)}&select=${baseSelect}`
    : `${SUPABASE_URL}/rest/v1/drops?select=${baseSelect}&approval_status=eq.approved&is_deleted=eq.false&quantity_remaining=gt.1&start_date=lte.${nowIso}&end_date=gte.${nowIso}&order=quantity_remaining.desc&limit=1`;
  const response = await request.get(url, { headers: apiHeaders(token) });
  expect(response.ok()).toBeTruthy();
  const rows = (await response.json()) as DropRow[];
  expect(rows.length).toBeGreaterThan(0);
  return rows[0];
};

const buildPurchasePayload = async (
  request: APIRequestContext,
  token: string,
  userId: string,
  drop: DropRow,
  quantity: number
) => {
  const bookingFeePerPackage = await getBookingFeePerPackage(request, token);
  const subtotal = Number(drop.price || 0) * quantity;
  const deliveryFee = 0;
  const bookingFee = bookingFeePerPackage * quantity;
  const taxRate = Number(drop.tax_rate || 0);
  const taxAmount = (subtotal + deliveryFee + bookingFee) * taxRate;
  const baseTotal = subtotal + deliveryFee + bookingFee + taxAmount;
  const stripeFee = drop.pass_stripe_fee ? (baseTotal * 0.029) + 0.2 : 0;
  const total = baseTotal + stripeFee;

  return {
    p_drop_id: drop.id,
    p_user_id: userId,
    p_customer_name: 'E2E Security',
    p_customer_email: CUSTOMER_EMAIL || 'e2e@example.com',
    p_quantity: quantity,
    p_subtotal: subtotal,
    p_tax_rate: taxRate,
    p_tax_amount: taxAmount,
    p_booking_fee: bookingFee,
    p_stripe_fee_amount: stripeFee,
    p_total_paid: total,
    p_delivery_requested: false,
    p_delivery_address: null,
    p_selected_items: [],
    p_drop_name: drop.name,
    p_drop_image: drop.image,
    p_order_notes: 'playwright-security-e2e',
    p_is_bulk: false,
  };
};

const createPurchase = async (
  request: APIRequestContext,
  token: string,
  payload: Record<string, unknown>
) => {
  const response = await request.post(`${SUPABASE_URL}/rest/v1/rpc/purchase_drop_item`, {
    headers: apiHeaders(token),
    data: payload,
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
};

test.describe.serial('security runtime validations', () => {
  test('owner-only checkout blocks non-owner', async ({ request }) => {
    test.skip(!hasBaseConfig || !hasCustomer || !hasVendor, 'Missing Supabase config or real customer/vendor creds.');

    const customer = await loginWithPassword(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const vendor = await loginWithPassword(request, VENDOR_EMAIL, VENDOR_PASSWORD);
    const drop = await getLiveApprovedDrop(request, customer.access_token, E2E_DROP_ID || undefined);

    const payload = await buildPurchasePayload(request, customer.access_token, customer.user.id, drop, 1);
    const { response: purchaseResp, body: purchaseBody } = await createPurchase(request, customer.access_token, payload);
    expect(purchaseResp.ok()).toBeTruthy();
    expect(purchaseBody?.purchase_id).toBeTruthy();

    const checkoutResp = await request.post(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      headers: apiHeaders(vendor.access_token),
      data: {
        purchaseId: purchaseBody.purchase_id,
        returnUrl: 'http://127.0.0.1:4173',
        checkoutToken: purchaseBody.checkout_token,
      },
    });
    expect(checkoutResp.status()).toBe(403);
    const body = await checkoutResp.json();
    expect(String(body?.error || '').toLowerCase()).toContain('unauthorized');
  });

  test('owner can still create checkout session (regression)', async ({ request }) => {
    test.skip(!hasBaseConfig || !hasCustomer, 'Missing Supabase config or real customer creds.');

    const customer = await loginWithPassword(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const drop = await getLiveApprovedDrop(request, customer.access_token, E2E_DROP_ID || undefined);
    const payload = await buildPurchasePayload(request, customer.access_token, customer.user.id, drop, 1);
    const { response: purchaseResp, body: purchaseBody } = await createPurchase(request, customer.access_token, payload);
    expect(purchaseResp.ok()).toBeTruthy();

    const checkoutResp = await request.post(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      headers: apiHeaders(customer.access_token),
      data: {
        purchaseId: purchaseBody.purchase_id,
        returnUrl: 'http://127.0.0.1:4173',
        checkoutToken: purchaseBody.checkout_token,
      },
    });
    expect(checkoutResp.ok()).toBeTruthy();
    const body = await checkoutResp.json();
    expect(typeof body?.url).toBe('string');
    expect(String(body.url).startsWith('https://')).toBeTruthy();
  });

  test('stripe checkout page shows expected total (no payment completion)', async ({ request, page }) => {
    test.skip(
      !hasBaseConfig || !hasCustomer || !CHECK_STRIPE_DISPLAY,
      'Missing base config/real customer creds or E2E_CHECK_STRIPE_DISPLAY=1.'
    );

    const customer = await loginWithPassword(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const drop = await getLiveApprovedDrop(request, customer.access_token, E2E_DROP_ID || undefined);
    const payload = await buildPurchasePayload(request, customer.access_token, customer.user.id, drop, 1);
    const expectedTotal = Number(payload.p_total_paid || 0);

    const { response: purchaseResp, body: purchaseBody } = await createPurchase(request, customer.access_token, payload);
    expect(purchaseResp.ok()).toBeTruthy();

    const checkoutResp = await request.post(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      headers: apiHeaders(customer.access_token),
      data: {
        purchaseId: purchaseBody.purchase_id,
        returnUrl: 'http://127.0.0.1:4173',
        checkoutToken: purchaseBody.checkout_token,
      },
    });
    expect(checkoutResp.ok()).toBeTruthy();
    const checkoutBody = await checkoutResp.json();
    expect(typeof checkoutBody?.url).toBe('string');

    await page.goto(String(checkoutBody.url), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/checkout\.stripe\.com/);

    // Stripe can render amount as "$4.32", "US$4.32", or similar locale variants.
    const expectedAmountText = expectedTotal.toFixed(2);
    await expect(page.getByText(new RegExp(expectedAmountText.replace('.', '\\.'))).first()).toBeVisible({ timeout: 20000 });
  });

  test('quantity zero/negative is rejected by purchase RPC', async ({ request }) => {
    test.skip(!hasBaseConfig || !hasCustomer, 'Missing Supabase config or real customer creds.');

    const customer = await loginWithPassword(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const drop = await getLiveApprovedDrop(request, customer.access_token, E2E_DROP_ID || undefined);
    const payload = await buildPurchasePayload(request, customer.access_token, customer.user.id, drop, 0);
    payload.p_total_paid = 0;

    const { response, body } = await createPurchase(request, customer.access_token, payload);
    expect(response.ok()).toBeFalsy();
    const message = String(body?.message || body?.error_description || body?.error || '').toLowerCase();
    expect(message).toContain('quantity must be at least 1');
  });

  test('inventory restore RPC recovers quantity after pending->failed transition', async ({ request }) => {
    test.skip(!hasBaseConfig || !hasAdmin || !hasCustomer, 'Missing Supabase/admin/customer creds.');

    const admin = await loginWithPassword(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const customer = await loginWithPassword(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const drop = await getLiveApprovedDrop(request, customer.access_token, E2E_DROP_ID || undefined);
    const startingQty = Number(drop.quantity_remaining);

    const payload = await buildPurchasePayload(request, customer.access_token, customer.user.id, drop, 1);
    const { response: purchaseResp, body: purchaseBody } = await createPurchase(request, customer.access_token, payload);
    expect(purchaseResp.ok()).toBeTruthy();

    const purchaseId = String(purchaseBody.purchase_id);
    const failResp = await request.patch(`${SUPABASE_URL}/rest/v1/purchases?id=eq.${encodeURIComponent(purchaseId)}&payment_status=eq.pending`, {
      headers: {
        ...apiHeaders(admin.access_token),
        Prefer: 'return=representation',
      },
      data: { payment_status: 'failed' },
    });
    expect(failResp.ok()).toBeTruthy();

    const restoreResp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/restore_drop_inventory`, {
      headers: apiHeaders(admin.access_token),
      data: { p_drop_id: drop.id, p_quantity: 1 },
    });
    expect(restoreResp.ok()).toBeTruthy();

    const reloadedDrop = await getLiveApprovedDrop(request, admin.access_token, drop.id);
    expect(Number(reloadedDrop.quantity_remaining)).toBe(startingQty);
  });

  test('deleted drop cannot be purchased', async ({ request }) => {
    test.skip(!hasBaseConfig || !hasAdmin || !hasCustomer || !E2E_MUTABLE_DROP_ID, 'Missing required envs for mutable drop test.');

    const admin = await loginWithPassword(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const customer = await loginWithPassword(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const drop = await getLiveApprovedDrop(request, admin.access_token, E2E_MUTABLE_DROP_ID);

    let restored = false;
    try {
      const markDeleted = await request.patch(
        `${SUPABASE_URL}/rest/v1/drops?id=eq.${encodeURIComponent(drop.id)}`,
        {
          headers: apiHeaders(admin.access_token),
          data: { is_deleted: true },
        }
      );
      expect(markDeleted.ok()).toBeTruthy();

      const payload = await buildPurchasePayload(request, customer.access_token, customer.user.id, drop, 1);
      const { response, body } = await createPurchase(request, customer.access_token, payload);
      expect(response.ok()).toBeFalsy();
      const message = String(body?.message || body?.error_description || body?.error || '').toLowerCase();
      expect(message).toContain('no longer available');
    } finally {
      const restoreResp = await request.patch(
        `${SUPABASE_URL}/rest/v1/drops?id=eq.${encodeURIComponent(drop.id)}`,
        {
          headers: apiHeaders(admin.access_token),
          data: { is_deleted: false },
        }
      );
      restored = restoreResp.ok();
    }
    expect(restored).toBeTruthy();
  });

  test('time-expired drop cannot be purchased', async ({ request }) => {
    test.skip(!hasBaseConfig || !hasAdmin || !hasCustomer || !E2E_MUTABLE_DROP_ID, 'Missing required envs for mutable drop test.');

    const admin = await loginWithPassword(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const customer = await loginWithPassword(request, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const drop = await getLiveApprovedDrop(request, admin.access_token, E2E_MUTABLE_DROP_ID);
    const originalEndDate = drop.end_date;
    const pastEndDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    let restored = false;
    try {
      const expireResp = await request.patch(
        `${SUPABASE_URL}/rest/v1/drops?id=eq.${encodeURIComponent(drop.id)}`,
        {
          headers: apiHeaders(admin.access_token),
          data: { end_date: pastEndDate },
        }
      );
      expect(expireResp.ok()).toBeTruthy();

      const payload = await buildPurchasePayload(request, customer.access_token, customer.user.id, drop, 1);
      const { response, body } = await createPurchase(request, customer.access_token, payload);
      expect(response.ok()).toBeFalsy();
      const message = String(body?.message || body?.error_description || body?.error || '').toLowerCase();
      expect(message).toContain('not currently available');
    } finally {
      const restoreResp = await request.patch(
        `${SUPABASE_URL}/rest/v1/drops?id=eq.${encodeURIComponent(drop.id)}`,
        {
          headers: apiHeaders(admin.access_token),
          data: { end_date: originalEndDate },
        }
      );
      restored = restoreResp.ok();
    }
    expect(restored).toBeTruthy();
  });
});
