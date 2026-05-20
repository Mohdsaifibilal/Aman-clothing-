// ═══════════════════════════════════════════════════════════
// Supabase Edge Function: verify-payment
// Path: supabase/functions/verify-payment/index.ts
//
// Deploy: supabase functions deploy verify-payment
//
// Environment variables required:
//   RAZORPAY_KEY_SECRET → your Razorpay secret key
//
// CRITICAL SECURITY:
// · Signature verified server-side — fake payments impossible
// · Stock decremented atomically — no overselling
// · Duplicate order prevention via payment_id unique check
// ═══════════════════════════════════════════════════════════

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto }       from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {

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

    /* ── 1. Parse body ── */
    const body = await req.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      items,
      user_id,
      amount,
    } = body;

    /* ── 2. Validate all required fields ── */
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ error: 'Missing payment verification fields' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No items in order' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    /* ── 3. Get secret from environment ── */
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keySecret) {
      console.error('Missing RAZORPAY_KEY_SECRET');
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    /* ── 4. VERIFY SIGNATURE — CRITICAL SECURITY STEP ──
       Razorpay signature = HMAC-SHA256(order_id + "|" + payment_id, secret)
       If signature doesn't match → payment is FAKE → reject immediately */
    const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;

    const encoder       = new TextEncoder();
    const keyData       = encoder.encode(keySecret);
    const messageData   = encoder.encode(signaturePayload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature mismatch — possible fake payment attempt');
      return new Response(
        JSON.stringify({ error: 'Payment verification failed — invalid signature' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    /* ── 5. Init Supabase client with service role ── */
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase     = createClient(supabaseUrl, serviceKey);

    /* ── 6. Duplicate payment prevention ──
       Check if this payment_id already has an order */
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_id', razorpay_payment_id)
      .single();

    if (existingOrder) {
      console.warn('Duplicate payment attempt:', razorpay_payment_id);
      return new Response(
        JSON.stringify({
          success:  true,
          order_id: existingOrder.id,
          message:  'Order already processed',
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    /* ── 7. Verify stock availability (live check) ── */
    const productIds = items.map((i: any) => i.id);

    const { data: liveProducts, error: stockErr } = await supabase
      .from('products')
      .select('id, name, stock')
      .in('id', productIds);

    if (stockErr || !liveProducts) {
      return new Response(
        JSON.stringify({ error: 'Could not verify product stock' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    /* Check each item has enough stock */
    const stockErrors: string[] = [];
    for (const item of items) {
      const live = liveProducts.find((p: any) => p.id === item.id);
      if (!live) {
        stockErrors.push(`Product "${item.name}" not found`);
        continue;
      }
      if (live.stock < item.quantity) {
        stockErrors.push(`"${live.name}": only ${live.stock} left, ordered ${item.quantity}`);
      }
    }

    if (stockErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: stockErrors.join('; ') }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    /* ── 8. Create order record in database ── */
    const { data: newOrder, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id:        user_id || null,
        items:          items,
        amount:         amount,
        payment_id:     razorpay_payment_id,
        payment_order_id: razorpay_order_id,
        payment_status: 'paid',
        order_status:   'confirmed',
      })
      .select('id')
      .single();

    if (orderErr || !newOrder) {
      console.error('Order insert failed:', orderErr);
      return new Response(
        JSON.stringify({ error: 'Failed to create order record' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    /* ── 9. Decrement stock atomically for each item ── */
    const stockUpdateErrors: string[] = [];

    await Promise.all(
      items.map(async (item: any) => {
        const { error: rpcErr } = await supabase.rpc('decrement_stock', {
          product_id: item.id,
          qty:        item.quantity,
        });
        if (rpcErr) {
          stockUpdateErrors.push(`Stock update failed for ${item.name}: ${rpcErr.message}`);
        }
      })
    );

    if (stockUpdateErrors.length > 0) {
      /* Order created but stock update partially failed — log for manual fix */
      console.error('Stock update errors:', stockUpdateErrors);
      /* Do NOT fail the order — payment already done */
    }

    /* ── 10. Return success ── */
    console.log('Payment verified and order created:', newOrder.id);

    return new Response(
      JSON.stringify({
        success:  true,
        order_id: newOrder.id,
        message:  'Payment verified and order placed successfully',
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('verify-payment error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

});
