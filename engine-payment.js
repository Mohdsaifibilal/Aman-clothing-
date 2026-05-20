/**
 * ═══════════════════════════════════════════════════════════
 * ENGINE / engine-payment.js
 *
 * PAYMENT ABSTRACTION LAYER
 * · Supports Razorpay now, Stripe later — via config.js
 * · NON-BLOCKING — never blocks UI render
 * · All payment calls go through Engine.API layer
 * · Secret keys NEVER exposed in frontend
 * · Full failure handling + duplicate order prevention
 * ═══════════════════════════════════════════════════════════
 */

Engine.Payment = (() => {

  let _config       = null;
  let _processing   = false; /* Global lock — prevents duplicate payments */

  /* ══════════════════════════════════════════════════════
     INIT — called from app.js on boot
     Reads payment config from SITE_CONFIG
  ══════════════════════════════════════════════════════ */
  function init(config) {
    _config = config || window.SITE_CONFIG.payment || {};
    Engine.Logger.info('Payment', `Provider: ${_config.provider || 'none'} ✓`);
  }

  /* ══════════════════════════════════════════════════════
     START PAYMENT — main entry point
     Called from component-cart.js on checkout click
     NON-BLOCKING: fires async, updates UI via callbacks
  ══════════════════════════════════════════════════════ */
  function startPayment({ amount, items, user, onSuccess, onFailure }) {

    /* Duplicate payment guard */
    if (_processing) {
      Engine.Logger.warn('Payment', 'Payment already in progress — ignored');
      return;
    }

    if (!amount || amount <= 0) {
      Engine.EventBus.emit(Engine.Events.NOTIFY, {
        msg:  'Invalid payment amount',
        type: 'error',
      });
      return;
    }

    const provider = (_config?.provider || 'demo').toLowerCase();

    Engine.Logger.info('Payment', `Starting payment — provider: ${provider}, amount: ${amount}`);

    /* Fire async — does NOT block */
    _processPayment({ provider, amount, items, user, onSuccess, onFailure })
      .catch(err => {
        Engine.Logger.error('Payment', 'Unhandled payment error', err);
        _processing = false;
        Engine.EventBus.emit(Engine.Events.NOTIFY, {
          msg:  'Payment failed. Please try again.',
          type: 'error',
        });
        if (onFailure) onFailure({ error: err.message });
      });
  }

  /* ══════════════════════════════════════════════════════
     INTERNAL: route to correct provider
  ══════════════════════════════════════════════════════ */
  async function _processPayment({ provider, amount, items, user, onSuccess, onFailure }) {
    _processing = true;

    try {
      switch (provider) {
        case 'razorpay':
          await _handleRazorpay({ amount, items, user, onSuccess, onFailure });
          break;

        case 'stripe':
          await _handleStripe({ amount, items, user, onSuccess, onFailure });
          break;

        case 'demo':
        default:
          await _handleDemo({ amount, items, user, onSuccess, onFailure });
          break;
      }
    } finally {
      _processing = false;
    }
  }

  /* ══════════════════════════════════════════════════════
     RAZORPAY HANDLER
  ══════════════════════════════════════════════════════ */
  async function _handleRazorpay({ amount, items, user, onSuccess, onFailure }) {

    /* 1. Verify Razorpay SDK is loaded */
    if (typeof Razorpay === 'undefined') {
      throw new Error('Razorpay SDK not loaded. Add script to index.html.');
    }

    /* 2. Create payment order via Supabase Edge Function */
    Engine.EventBus.emit(Engine.Events.NOTIFY, {
      msg:  'Connecting to payment gateway…',
      type: 'info',
    });

    const { data: orderData, error: orderErr } =
      await Engine.API.createPaymentOrder({ amount, items });

    if (orderErr || !orderData?.order_id) {
      Engine.EventBus.emit(Engine.Events.NOTIFY, {
        msg:  orderErr || 'Failed to create payment order',
        type: 'error',
      });
      if (onFailure) onFailure({ error: orderErr });
      return;
    }

    const { order_id, amount: confirmedAmount, currency } = orderData;

    /* 3. Open Razorpay popup */
    const options = {
      key:      _config.razorpayKeyId, /* Public key — safe in frontend */
      amount:   confirmedAmount,        /* Amount in paise from backend */
      currency: currency || _config.currency || 'INR',
      order_id,
      name:     window.SITE_CONFIG.name || 'Shop',
      description: 'Order Payment',

      prefill: {
        email: user?.email || '',
        name:  user?.name  || '',
      },

      theme: {
        color: getComputedStyle(document.documentElement)
          .getPropertyValue('--color-accent').trim() || '#c8a96e',
      },

      /* ── Payment success callback ── */
      handler: async function(response) {
        Engine.Logger.info('Payment', 'Razorpay success — verifying…');

        Engine.EventBus.emit(Engine.Events.NOTIFY, {
          msg:  'Verifying payment…',
          type: 'info',
        });

        const { data: verifyData, error: verifyErr } =
          await Engine.API.verifyPayment({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_signature:  response.razorpay_signature,
            items,
            user_id: user?.id || null,
            amount,
          });

        if (verifyErr || !verifyData?.success) {
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg:  verifyErr || 'Payment verification failed',
            type: 'error',
          });
          if (onFailure) onFailure({ error: verifyErr });
          return;
        }

        /* Success — clear cart + notify + callback */
        Engine.Cart.clear();
        Engine.EventBus.emit(Engine.Events.NOTIFY, {
          msg:  'Payment successful! Order placed 🎉',
          type: 'success',
        });
        if (onSuccess) onSuccess({ orderId: verifyData.order_id });
      },

      /* ── Modal dismissed ── */
      modal: {
        ondismiss: function() {
          Engine.Logger.info('Payment', 'Razorpay modal dismissed by user');
          Engine.EventBus.emit(Engine.Events.NOTIFY, {
            msg:  'Payment cancelled',
            type: 'warning',
          });
          _processing = false;
          if (onFailure) onFailure({ error: 'cancelled' });
        },
      },
    };

    const rzp = new Razorpay(options);

    /* Handle Razorpay internal errors */
    rzp.on('payment.failed', function(response) {
      Engine.Logger.error('Payment', 'Razorpay payment failed', response.error);
      Engine.EventBus.emit(Engine.Events.NOTIFY, {
        msg:  response.error?.description || 'Payment failed',
        type: 'error',
      });
      _processing = false;
      if (onFailure) onFailure({ error: response.error?.description });
    });

    rzp.open();
  }

  /* ══════════════════════════════════════════════════════
     STRIPE HANDLER (scaffold — ready for future)
  ══════════════════════════════════════════════════════ */
  async function _handleStripe({ amount, items, user, onSuccess, onFailure }) {
    /* Stripe implementation scaffold */
    /* Switch config.js payment.provider to "stripe" when ready */

    Engine.Logger.info('Payment', 'Stripe handler — scaffold ready');

    const { data: sessionData, error: sessionErr } =
      await Engine.API.createPaymentOrder({ amount, items, provider: 'stripe' });

    if (sessionErr || !sessionData?.session_url) {
      Engine.EventBus.emit(Engine.Events.NOTIFY, {
        msg:  sessionErr || 'Failed to create Stripe session',
        type: 'error',
      });
      if (onFailure) onFailure({ error: sessionErr });
      return;
    }

    /* Redirect to Stripe hosted checkout */
    window.location.href = sessionData.session_url;
  }

  /* ══════════════════════════════════════════════════════
     DEMO HANDLER — works without any payment gateway
     Used when config.payment.provider = "demo" or not set
  ══════════════════════════════════════════════════════ */
  async function _handleDemo({ amount, items, user, onSuccess, onFailure }) {
    Engine.Logger.info('Payment', 'Demo payment mode — simulating…');

    Engine.EventBus.emit(Engine.Events.NOTIFY, {
      msg:  'Processing demo payment…',
      type: 'info',
    });

    /* Simulate network delay */
    await new Promise(r => setTimeout(r, 1200));

    /* Create order directly (no gateway) */
    const { data, error } = await Engine.API.createOrder(items, user?.id);

    if (error) {
      Engine.EventBus.emit(Engine.Events.NOTIFY, {
        msg:  error,
        type: 'error',
      });
      if (onFailure) onFailure({ error });
      return;
    }

    Engine.Cart.clear();
    Engine.EventBus.emit(Engine.Events.NOTIFY, {
      msg:  'Demo order placed successfully! 🎉',
      type: 'success',
    });
    if (onSuccess) onSuccess({ orderId: data?.id });
  }

  /* ══════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════ */
  return {
    init,
    startPayment,
    isProcessing: () => _processing,
  };

})();

Engine.Logger.info('Payment', 'Payment abstraction layer ready ✓');
