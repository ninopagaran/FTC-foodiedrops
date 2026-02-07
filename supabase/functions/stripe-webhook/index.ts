import Stripe from 'npm:stripe@16.10.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type SessionEvent = Stripe.Checkout.Session;

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
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey || !stripeWebhookSecret) {
    return jsonResponse(500, { error: 'Missing required function secrets.' });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return jsonResponse(400, { error: 'Missing stripe-signature header.' });
  }

  const body = await req.text();
  const stripe = new Stripe(stripeSecretKey, {
    appInfo: {
      name: 'FoodieDrops',
      version: '1.0.0',
    },
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature.';
    return jsonResponse(400, { error: message });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as SessionEvent;
      const purchaseId = session.metadata?.purchase_id;

      if (purchaseId) {
        await supabase
          .from('purchases')
          .update({
            payment_status: 'paid',
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            paid_at: new Date().toISOString(),
          })
          .eq('id', purchaseId);
      }
    }

    if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
      const session = event.data.object as SessionEvent;
      const purchaseId = session.metadata?.purchase_id;

      if (purchaseId) {
        await supabase
          .from('purchases')
          .update({
            payment_status: 'failed',
            stripe_checkout_session_id: session.id,
          })
          .eq('id', purchaseId)
          .neq('payment_status', 'paid');
      }
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === 'string' ? charge.payment_intent : null;

      if (paymentIntentId) {
        await supabase
          .from('purchases')
          .update({ payment_status: 'refunded' })
          .eq('stripe_payment_intent_id', paymentIntentId);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    return jsonResponse(500, { error: message });
  }

  return jsonResponse(200, { received: true });
});
