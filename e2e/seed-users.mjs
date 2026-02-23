import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');

const parseEnvFile = (filePath) => {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
};

const upsertEnvVars = (filePath, updates) => {
  const original = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const lines = original ? original.split('\n') : [];
  const keys = Object.keys(updates);
  const seen = new Set();
  const next = lines.map((line) => {
    const idx = line.indexOf('=');
    if (idx <= 0) return line;
    const key = line.slice(0, idx).trim();
    if (!keys.includes(key)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });
  for (const key of keys) {
    if (!seen.has(key)) next.push(`${key}=${updates[key]}`);
  }
  fs.writeFileSync(filePath, `${next.join('\n').replace(/\n+$/g, '')}\n`, 'utf8');
};

const envFile = parseEnvFile(envPath);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envFile.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  envFile.VITE_SUPABASE_ANON_KEY ||
  envFile.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY in env/.env.local');
  process.exit(1);
}

const rand = Math.random().toString(36).slice(2, 8);
const timestamp = Date.now().toString().slice(-6);
const domain = process.env.E2E_TEST_EMAIL_DOMAIN || 'example.com';
const basePassword = process.env.E2E_TEST_PASSWORD || `E2e!${timestamp}${rand}`;

const users = [
  { role: 'customer', email: `e2e.customer.${timestamp}.${rand}@${domain}`, password: basePassword },
  { role: 'vendor', email: `e2e.vendor.${timestamp}.${rand}@${domain}`, password: basePassword },
  { role: 'customer', email: `e2e.admin.${timestamp}.${rand}@${domain}`, password: basePassword },
];

const authHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

const signUp = async (email, password, role) => {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email,
      password,
      data: { requested_role: role },
    }),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
};

const login = async (email, password) => {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ email, password }),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
};

const main = async () => {
  const results = [];
  for (const u of users) {
    const signupRes = await signUp(u.email, u.password, u.role);
    const loginRes = await login(u.email, u.password);
    results.push({ ...u, signupRes, loginRes });
  }

  const failed = results.find((r) => !r.signupRes.ok || !r.loginRes.ok);
  if (failed) {
    console.error('[seed-users] Failed to create/login all users.');
    for (const r of results) {
      console.error(
        `- ${r.email} signup=${r.signupRes.status} login=${r.loginRes.status} ` +
          `signup_msg=${JSON.stringify(r.signupRes.json)} login_msg=${JSON.stringify(r.loginRes.json)}`
      );
    }
    console.error('\nIf login fails with email confirmation required, confirm these emails first in Supabase Auth.');
    process.exit(1);
  }

  const customer = results[0];
  const vendor = results[1];
  const admin = results[2];

  upsertEnvVars(envPath, {
    E2E_CUSTOMER_EMAIL: customer.email,
    E2E_CUSTOMER_PASSWORD: customer.password,
    E2E_VENDOR_EMAIL: vendor.email,
    E2E_VENDOR_PASSWORD: vendor.password,
    E2E_ADMIN_EMAIL: admin.email,
    E2E_ADMIN_PASSWORD: admin.password,
  });

  console.log('[seed-users] Created and validated users. Updated .env.local E2E_* credentials.');
  console.log('\nPromote admin user with SQL:');
  console.log(
    `select public.set_profile_admin_status((select id from public.profiles where email = '${admin.email}'), true, 'e2e seed promote admin');`
  );
};

main().catch((error) => {
  console.error('[seed-users] Fatal error:', error);
  process.exit(1);
});
