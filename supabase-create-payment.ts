// ═══════════════════════════════════════════════════════════
// Supabase Edge Function: create-payment
// Path: supabase/functions/create-payment/index.ts
//
// Deploy: supabase functions deploy create-payment
//
// Environment variables required (set in Supabase Dashboard):
//   RAZORPAY_KEY_ID     → your Razorpay key id
//   RAZORPAY_KEY_SECRET → your Razorpay secret key
//
// This function NEVER exposes the secret key to frontend.
// ═══════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {

  /* Handle CORS preflight */
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    /* ── 1. Parse request body ── */
    const body = await req.json();
    const { amount, currency = 'INR', items } = body;

    /* ── 2. Validate amount ── */
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    /* ── 3. Get Razorpay credentials from environment ── */
    const keyId     = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      console.error('Missing Razorpay credentials in environment');
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    /* ── 4. Create Razorpay order via REST API ── */
    const razorpayAuth = btoa(`${keyId}:${keySecret}`);

    /* Generate unique receipt id — prevents duplicate orders */
    const receipt = `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${razorpayAuth}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:   Math.round(amount),  /* Amount already in paise from frontend */
        currency: currency.toUpperCase(),
        receipt,
        notes: {
          items_count: items?.length || 0,
          source:      'multi-site-engine',
        },
      }),
    });

    const razorpayData = await razorpayResponse.json();

    /* ── 5. Handle Razorpay error ── */
    if (!razorpayResponse.ok) {
      console.error('Razorpay order creation failed:', razorpayData);
      return new Response(
        JSON.stringify({
          error: razorpayData?.error?.description || 'Failed to create payment order',
        }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    /* ── 6. Return order details to frontend ── */
    return new Response(
      JSON.stringify({
        order_id: razorpayData.id,
        amount:   razorpayData.amount,
        currency: razorpayData.currency,
        receipt:  razorpayData.receipt,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('create-payment error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

});
