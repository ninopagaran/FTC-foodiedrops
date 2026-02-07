<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FoodieDrops

Limited restaurant drop marketplace with Supabase auth/data and Stripe checkout.

## Local app setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local`.
3. Fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`)
4. Run:
   `npm run dev`

## Supabase database setup

1. Open your Supabase project SQL Editor.
2. Run `supabase_schema.sql`.
3. (Optional) make an admin account:
   ```sql
   update public.profiles
   set is_admin = true
   where email = 'your-email@example.com';
   ```

## Stripe integration setup

This repo includes Supabase Edge Functions:
- `supabase/functions/create-checkout-session`
- `supabase/functions/stripe-webhook`

Deploy them:

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

Set function secrets:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SITE_URL=https://your-frontend-domain.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically in hosted Supabase functions.

Create a Stripe webhook endpoint pointing to:

`https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`

Subscribe to events:
- `checkout.session.completed`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
