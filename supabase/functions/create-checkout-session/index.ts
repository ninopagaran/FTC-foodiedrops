import Stripe from 'npm:stripe@16.10.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type PurchaseRow = {
  id: string;
  user_id: string | null;
  customer_email: string;
  drop_id: string;
  drop_name: string;
  quantity: number;
  total_paid: number;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  stripe_checkout_session_id: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
    return jsonResponse(500, { error: 'Missing required function secrets.' });
  }

  let purchaseId: string | undefined;
  let returnUrl: string | undefined;
  try {
    const body = await req.json();
    purchaseId = body?.purchaseId;
    returnUrl = body?.returnUrl;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  if (!purchaseId) {
    return jsonResponse(400, { error: 'purchaseId is required.' });
  }

  const siteUrl = returnUrl || req.headers.get('origin') || Deno.env.get('SITE_URL') || 'http://localhost:5173';

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select('id,user_id,customer_email,drop_id,drop_name,quantity,total_paid,payment_status,stripe_checkout_session_id')
    .eq('id', purchaseId)
    .single<PurchaseRow>();

  if (purchaseError || !purchase) {
    return jsonResponse(404, { error: 'Purchase not found.' });
  }

  if (purchase.payment_status === 'paid') {
    return jsonResponse(400, { error: 'Purchase is already paid.' });
  }

  if (purchase.payment_status === 'refunded') {
    return jsonResponse(400, { error: 'Purchase has been refunded and cannot be repaid.' });
  }

  const stripe = new Stripe(stripeSecretKey, {
    appInfo: {
      name: 'FoodieDrops',
      version: '1.0.0',
    },
  });

  if (purchase.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(purchase.stripe_checkout_session_id);
      if (existing.status === 'open' && existing.url) {
        return jsonResponse(200, { url: existing.url, sessionId: existing.id, reused: true });
      }
    } catch {
      // Ignore and create a new session.
    }
  }

  const amountInCents = Math.round(Number(purchase.total_paid) * 100);
  if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
    return jsonResponse(400, { error: 'Invalid purchase amount.' });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: purchase.customer_email,
    success_url: `${siteUrl}/#/profile`,
    cancel_url: `${siteUrl}/#/profile`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountInCents,
          product_data: {
            name: purchase.drop_name || 'FoodieDrops order',
            description: `Order #${purchase.id} · Qty ${purchase.quantity}`,
          },
        },
      },
    ],
    metadata: {
      purchase_id: purchase.id,
      drop_id: purchase.drop_id,
    },
  });

  const { error: updateError } = await supabase
    .from('purchases')
    .update({
      stripe_checkout_session_id: session.id,
      payment_status: 'pending',
    })
    .eq('id', purchase.id);

  if (updateError) {
    return jsonResponse(500, { error: 'Failed to store checkout session.' });
  }

  if (!session.url) {
    return jsonResponse(500, { error: 'Stripe did not return a checkout URL.' });
  }

  return jsonResponse(200, { url: session.url, sessionId: session.id, reused: false });
});
