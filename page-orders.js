/**
 * PAGE / page-orders.js
 *
 * User Order History Page
 * Route: #/orders
 *
 * NON-BLOCKING PATTERN:
 *  1. render() is SYNCHRONOUS — skeleton immediately
 *  2. Store.subscribe('orders') listens for data
 *  3. API fires in background — no await
 *  4. Grid updates automatically when data arrives
 */

Engine.Pages = Engine.Pages || {};

Engine.Pages.Orders = (() => {

  let _unsubscribe = null;

  /* ── RENDER — synchronous ── */
  function render() {
    const user = Engine.Store.get('user');

    /* Not logged in — redirect to auth */
    if (!user) {
      Engine.EventBus.emit(Engine.Events.NOTIFY, {
        msg:  'Please sign in to view your orders',
        type: 'warning',
      });
      Engine.Router.navigate('/auth');
      return;
    }

    /* 1. Paint skeleton instantly */
    _renderSkeleton();

    /* 2. Clean up previous subscription */
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }

    /* 3. Subscribe to orders store */
    _unsubscribe = Engine.Store.subscribe('orders', (orders) => {
      const error = Engine.Store.get('ordersError');
      if (error) {
        Engine.Renderer.showError(
          '#orders-grid',
          error,
          () => render()
        );
        return;
      }
      /* Only render when we have data or confirmed empty */
      if (!Engine.Store.get('ordersLoading')) {
        _renderOrders(orders || []);
      }
    });

    /* 4. Fire API — no await */
    Engine.API.getMyOrders(user.id);
  }

  /* ── SKELETON ── */
  function _renderSkeleton() {
    Engine.Renderer.mount('#app-root', `
      <div style="padding-top:calc(var(--navbar-h) + var(--space-12));
                  padding-bottom:var(--space-20)">
        <div class="container">

          <div class="section-header">
            <div class="section-eyebrow">Account</div>
            <h1 class="section-title">My Orders</h1>
          </div>

          <div id="orders-grid">
            ${_skeletonCards()}
          </div>

        </div>
      </div>
    `);
  }

  /* ── SKELETON CARDS ── */
  function _skeletonCards() {
    return Array(3).fill(0).map(() => `
      <div style="background:var(--color-surface);
                  border:1px solid var(--color-border);
                  border-radius:var(--radius-lg);
                  padding:var(--space-6);
                  margin-bottom:var(--space-4);
                  pointer-events:none"
           aria-hidden="true">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-4)">
          <div style="height:18px;background:var(--color-border);
                      border-radius:4px;width:160px"></div>
          <div style="height:18px;background:var(--color-border);
                      border-radius:4px;width:80px"></div>
        </div>
        <div style="height:14px;background:var(--color-border);
                    border-radius:4px;width:220px;margin-bottom:var(--space-3)"></div>
        <div style="height:14px;background:var(--color-border);
                    border-radius:4px;width:120px"></div>
      </div>
    `).join('');
  }


  const COURIER_TRACKING = {
    'delhivery':   'https://www.delhivery.com/track/package/',
    'bluedart':    'https://www.bluedart.com/tracking?trackid=',
    'dtdc':        'https://www.dtdc.in/tracking.asp?Ttype=awb&strCnno=',
    'ekart':       'https://ekartlogistics.com/shipmenttrack/',
    'xpressbees':  'https://www.xpressbees.com/shipment/tracking?awbNo=',
    'shiprocket':  'https://shiprocket.co/tracking/',
    'indiapost':   'https://www.indiapost.gov.in/vas/Pages/trackconsignment.aspx?consignment=',
  };

  function _getTrackingUrl(courier, trackingId) {
    if (!courier || !trackingId) return null;
    const key = courier.toLowerCase().replace(/\s+/g, '');
    const base = COURIER_TRACKING[key];
    if (base) return base + trackingId;
    return null;
  }

  /* ── STATUS BADGE CONFIG ── */
  const STATUS_CONFIG = {
    pending:   { label: 'Pending',   color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' },
    confirmed: { label: 'Confirmed', color: 'var(--color-success)',    bg: 'rgba(39,174,96,.1)' },
    shipped:   { label: 'Shipped',   color: 'var(--color-warning)',    bg: 'rgba(230,126,34,.1)' },
    delivered: { label: 'Delivered', color: 'var(--color-accent)',     bg: 'rgba(200,169,110,.15)' },
    cancelled: { label: 'Cancelled', color: 'var(--color-error)',      bg: 'rgba(192,57,43,.1)' },
  };

  const PAYMENT_CONFIG = {
    paid:    { label: 'Paid',    color: 'var(--color-success)' },
    pending: { label: 'Pending', color: 'var(--color-warning)' },
    failed:  { label: 'Failed',  color: 'var(--color-error)' },
  };

  /* ── RENDER REAL ORDERS ── */
  function _renderOrders(orders) {
    const grid = document.getElementById('orders-grid');
    if (!grid) return;

    if (!orders || orders.length === 0) {
      Engine.Renderer.showEmpty('#orders-grid', {
        icon:   '📦',
        title:  'No orders yet',
        desc:   'Your orders will appear here after you make a purchase.',
        action: `<a class="btn btn-primary" href="#/">Start Shopping</a>`,
      });
      return;
    }

    grid.innerHTML = orders.map(_orderCard).join('');
    _bindActions();
  }

  /* ── SINGLE ORDER CARD ── */
  function _orderCard(order) {
    const orderStatus   = STATUS_CONFIG[order.order_status]   || STATUS_CONFIG.pending;
    const paymentStatus = PAYMENT_CONFIG[order.payment_status] || PAYMENT_CONFIG.pending;

    /* Parse items safely */
    let items = [];
    try {
      items = typeof order.items === 'string'
        ? JSON.parse(order.items)
        : (Array.isArray(order.items) ? order.items : []);
    } catch (_) { items = []; }

    const itemsCount  = items.reduce((s, i) => s + (i.quantity || 1), 0);
    const itemPreview = items.slice(0, 2).map(i =>
      Engine.Renderer.escape(i.name || 'Item')
    ).join(', ') + (items.length > 2 ? ` +${items.length - 2} more` : '');

    const date      = new Date(order.created_at);
    const dateStr   = date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    const timeStr   = date.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit',
    });

    const shortId = String(order.id).slice(0, 8).toUpperCase();

    return `
      <div style="background:var(--color-surface);
                  border:1px solid var(--color-border);
                  border-radius:var(--radius-lg);
                  padding:var(--space-6);
                  margin-bottom:var(--space-4);
                  transition:box-shadow var(--dur-base)"
           onmouseover="this.style.boxShadow='var(--shadow-md)'"
           onmouseout="this.style.boxShadow='none'">

        <!-- Header Row -->
        <div style="display:flex;align-items:center;
                    justify-content:space-between;
                    flex-wrap:wrap;gap:var(--space-3);
                    margin-bottom:var(--space-4);
                    padding-bottom:var(--space-4);
                    border-bottom:1px solid var(--color-border)">

          <div>
            <div style="font-size:var(--text-xs);
                        text-transform:uppercase;
                        letter-spacing:.08em;
                        color:var(--color-text-muted);
                        margin-bottom:var(--space-1)">
              Order ID
            </div>
            <div style="font-family:var(--font-mono);
                        font-size:var(--text-sm);
                        font-weight:600;
                        color:var(--color-text)">
              #${Engine.Renderer.escape(shortId)}
            </div>
          </div>

          <div style="text-align:right">
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);
                        margin-bottom:var(--space-1)">${dateStr}</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-light)">${timeStr}</div>
          </div>
        </div>

        <!-- Items + Amount Row -->
        <div style="display:flex;align-items:flex-start;
                    justify-content:space-between;
                    flex-wrap:wrap;gap:var(--space-4);
                    margin-bottom:var(--space-4)">

          <div style="flex:1;min-width:0">
            <div style="font-size:var(--text-xs);
                        text-transform:uppercase;
                        letter-spacing:.08em;
                        color:var(--color-text-muted);
                        margin-bottom:var(--space-2)">
              Items (${itemsCount})
            </div>
            <div style="font-size:var(--text-sm);
                        color:var(--color-text);
                        line-height:1.5;
                        white-space:nowrap;
                        overflow:hidden;
                        text-overflow:ellipsis">
              ${itemPreview || 'No items'}
            </div>
          </div>

          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:var(--text-xs);
                        text-transform:uppercase;
                        letter-spacing:.08em;
                        color:var(--color-text-muted);
                        margin-bottom:var(--space-1)">
              Total
            </div>
            <div style="font-family:var(--font-display);
                        font-size:var(--text-2xl);
                        color:var(--color-primary)">
              ${Engine.Logic.formatPrice(order.total ?? order.amount ?? 0)}
            </div>
          </div>
        </div>

        <!-- Status Row -->
        <div style="display:flex;align-items:center;
                    gap:var(--space-3);flex-wrap:wrap">

          <!-- Order Status -->
          <span style="display:inline-flex;align-items:center;gap:var(--space-2);
                       padding:var(--space-1) var(--space-3);
                       border-radius:999px;
                       font-size:var(--text-xs);
                       font-weight:600;
                       background:${orderStatus.bg};
                       color:${orderStatus.color}">
            ${_statusIcon(order.order_status)}
            ${orderStatus.label}
          </span>

          <!-- Payment Status -->
          <span style="display:inline-flex;align-items:center;
                       padding:var(--space-1) var(--space-3);
                       border-radius:999px;
                       font-size:var(--text-xs);
                       font-weight:600;
                       background:var(--color-surface-2);
                       color:${paymentStatus.color}">
            💳 ${paymentStatus.label}
          </span>

        </div>

        <!-- Order Progress Tracker — full width below badges -->
        <div style="margin-top:var(--space-4)">
          ${_progressBar(order.order_status)}
        </div>

        <!-- Tracking Info — shown only when shipped/delivered -->
        ${(['shipped','delivered'].includes(order.order_status)) && order.tracking_id ? `
          <div style="margin-top:var(--space-4);
                      padding:var(--space-4);
                      background:rgba(200,169,110,.08);
                      border:1px solid rgba(200,169,110,.25);
                      border-radius:var(--radius-md)">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-3)">
              <div style="display:flex;align-items:center;gap:var(--space-4);flex-wrap:wrap">
                <div>
                  <div style="font-size:var(--text-xs);text-transform:uppercase;
                              letter-spacing:.08em;color:var(--color-text-muted);
                              margin-bottom:var(--space-1)">Courier</div>
                  <div style="font-size:var(--text-sm);font-weight:600">
                    🚚 ${Engine.Renderer.escape(order.courier || '')}
                  </div>
                </div>
                <div>
                  <div style="font-size:var(--text-xs);text-transform:uppercase;
                              letter-spacing:.08em;color:var(--color-text-muted);
                              margin-bottom:var(--space-1)">Tracking ID</div>
                  <div style="font-family:var(--font-mono);font-size:var(--text-sm);
                              font-weight:600;color:var(--color-text)">
                    ${Engine.Renderer.escape(order.tracking_id || '')}
                  </div>
                </div>
              </div>
              ${(() => {
                const url = _getTrackingUrl(order.courier, order.tracking_id) || order.tracking_url;
                return url
                  ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="btn btn-accent btn-sm" style="text-decoration:none">🔍 Track Order</a>'
                  : '';
              })()}
            </div>
          </div>
        ` : ''}

        <!-- Action Buttons -->
        <div style="margin-top:var(--space-4);display:flex;gap:var(--space-3);flex-wrap:wrap">

          <!-- Cancel Button — only Pending or Confirmed -->
          ${['pending','confirmed'].includes(order.order_status) ? `
            <button
              class="btn btn-sm"
              style="border:1px solid var(--color-error);color:var(--color-error);background:transparent"
              data-cancel-order="${Engine.Renderer.escape(order.id)}">
              ✕ Cancel Order
            </button>
          ` : ''}

          <!-- Mark as Received — only when Shipped -->
          ${order.order_status === 'shipped' ? `
            <button
              class="btn btn-primary btn-sm"
              data-mark-delivered="${Engine.Renderer.escape(order.id)}">
              ✓ Mark as Received
            </button>
          ` : ''}

        </div>

      </div>
    `;
  }

  function _statusIcon(status) {
    const icons = {
      pending:   '🕐',
      confirmed: '✅',
      shipped:   '🚚',
      delivered: '🎉',
      cancelled: '❌',
    };
    return icons[status] || '📦';
  }

  function _progressBar(status) {
    if (status === 'cancelled') return `
      <div style="display:inline-flex;align-items:center;gap:var(--space-2);
                  padding:var(--space-2) var(--space-4);
                  background:rgba(192,57,43,.08);
                  border:1px solid rgba(192,57,43,.2);
                  border-radius:var(--radius-md);
                  font-size:var(--text-xs);color:var(--color-error);font-weight:600">
        ❌ Order Cancelled
      </div>`;

    const STEPS = [
      { key: 'pending',   icon: '🕐', label: 'Order Placed'  },
      { key: 'confirmed', icon: '✅', label: 'Confirmed'     },
      { key: 'shipped',   icon: '🚚', label: 'Shipped'       },
      { key: 'delivered', icon: '🎉', label: 'Delivered'     },
    ];

    const currentIdx = STEPS.findIndex(s => s.key === status);

    return `
      <div style="display:flex;align-items:center;gap:0;margin-top:var(--space-4);
                  overflow-x:auto;padding-bottom:var(--space-1)">
        ${STEPS.map((step, i) => {
          const done   = i <= currentIdx;
          const active = i === currentIdx;
          return `
            <div style="display:flex;flex-direction:column;align-items:center;
                        flex:1;min-width:60px;position:relative">
              ${i > 0 ? `
                <div style="position:absolute;top:14px;right:50%;width:100%;height:2px;
                            background:${i <= currentIdx ? 'var(--color-accent)' : 'var(--color-border)'};
                            z-index:0"></div>
              ` : ''}
              <div style="width:28px;height:28px;border-radius:50%;
                          background:${done ? 'var(--color-accent)' : 'var(--color-surface)'};
                          border:2px solid ${done ? 'var(--color-accent)' : 'var(--color-border)'};
                          display:flex;align-items:center;justify-content:center;
                          font-size:12px;position:relative;z-index:1;
                          box-shadow:${active ? '0 0 0 3px rgba(10,10,10,.1)' : 'none'};
                          transition:all .3s ease">
                ${done ? (active ? step.icon : '✓') : ''}
              </div>
              <div style="font-size:10px;font-weight:${active ? '700' : '500'};
                          color:${done ? 'var(--color-text)' : 'var(--color-text-light)'};
                          margin-top:var(--space-2);text-align:center;
                          letter-spacing:.02em;white-space:nowrap">
                ${step.label}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /* ── BIND ACTION BUTTONS ── */
  function _bindActions() {
    document.getElementById('orders-grid')?.addEventListener('click', async (e) => {

      /* Cancel Order */
      const cancelBtn = e.target.closest('[data-cancel-order]');
      if (cancelBtn) {
        const orderId = cancelBtn.dataset.cancelOrder;
        if (!confirm('Kya aap sure hain? Order cancel ho jayegi.')) return;
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Cancelling…';
        const { error } = await Engine.API.cancelOrder(orderId, 'customer');
        if (error) {
          cancelBtn.disabled = false;
          cancelBtn.textContent = '✕ Cancel Order';
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: error, type: 'error' });
        } else {
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: 'Order cancel ho gayi ✓', type: 'success' });
          const user = Engine.Store.get('user');
          Engine.API.getMyOrders(user?.id);
        }
        return;
      }

      /* Mark as Received */
      const deliveredBtn = e.target.closest('[data-mark-delivered]');
      if (deliveredBtn) {
        const orderId = deliveredBtn.dataset.markDelivered;
        if (!confirm('Order receive kar li? Mark as Delivered ho jayegi.')) return;
        deliveredBtn.disabled = true;
        deliveredBtn.textContent = 'Saving…';
        const { error } = await Engine.API.markDelivered(orderId);
        if (error) {
          deliveredBtn.disabled = false;
          deliveredBtn.textContent = '✓ Mark as Received';
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: error, type: 'error' });
        } else {
          Engine.EventBus.emit(Engine.Events.NOTIFY, { msg: 'Order delivered mark ho gayi! 🎉', type: 'success' });
          const user = Engine.Store.get('user');
          Engine.API.getMyOrders(user?.id);
        }
        return;
      }

    });
  }

  return { render };

})();

/* Route registration — wrapper prevents {} params bug */
Engine.Router.register('/orders', () => Engine.Pages.Orders.render());
