/**
 * PAGE / contact.js — AMAN CLOTHING
 * Path: js/pages/contact.js
 *
 * Contact Us page — form + contact details.
 * Form submits to Supabase contact_messages table (if configured),
 * falls back to mailto: gracefully.
 * NON-BLOCKING: render() is synchronous.
 */

Engine.Pages = Engine.Pages || {};

Engine.Pages.Contact = (() => {

  const cfg = window.SITE_CONFIG;

  function render() {
    const contact = cfg.contact || {};

    Engine.Renderer.mount('#app-root', `

      <!-- Page Header -->
      <div style="background:var(--color-surface);
                  border-bottom:1px solid var(--color-border);
                  padding:calc(var(--navbar-h) + var(--space-16)) 0 var(--space-12);
                  text-align:center">
        <div class="container" style="max-width:580px">
          <p style="font-size:var(--text-xs);font-weight:700;letter-spacing:.14em;
                    text-transform:uppercase;color:var(--color-text-muted);
                    margin-bottom:var(--space-3)">
            Get In Touch
          </p>
          <h1 style="font-size:clamp(2rem,8vw,var(--text-5xl));font-family:var(--font-display);
                     font-weight:300;letter-spacing:-.03em;
                     margin-bottom:var(--space-5)">
            Contact Us
          </h1>
          <p style="font-size:var(--text-base);color:var(--color-text-muted);line-height:1.7">
            ${Engine.Renderer.escape(contact.tagline || 'Have a question about your order, sizing, or just want to say hello? We\'re here.')}
          </p>
        </div>
      </div>

      <!-- Main Content -->
      <section style="padding:var(--space-20) 0;background:var(--color-bg)">
        <div class="container">
          <div style="display:grid;grid-template-columns:1fr;
                      gap:var(--space-8);max-width:900px;margin:0 auto;
                      align-items:start">

            <!-- Contact Info -->
            <div>
              <h2 style="font-size:var(--text-xl);font-family:var(--font-display);
                         font-weight:400;margin-bottom:var(--space-8)">
                How to reach us
              </h2>

              ${[
                {
                  icon: '📧',
                  label: 'Email',
                  value: contact.email || 'hello@aman.in',
                  link:  `mailto:${contact.email || 'hello@aman.in'}`,
                },
                {
                  icon: '📱',
                  label: 'WhatsApp',
                  value: contact.whatsapp || '+91 98765 43210',
                  link:  `https://wa.me/${(contact.whatsapp || '+919876543210').replace(/\D/g,'')}`,
                },
                {
                  icon: '📍',
                  label: 'Address',
                  value: contact.address || 'New Delhi, India',
                  link: null,
                },
                {
                  icon: '🕐',
                  label: 'Response Time',
                  value: contact.hours || 'Within 24 hours (Mon–Sat)',
                  link: null,
                },
              ].map(item => `
                <div style="display:flex;gap:var(--space-4);
                             margin-bottom:var(--space-6);
                             align-items:flex-start">
                  <div style="font-size:1.2rem;width:36px;height:36px;
                               background:var(--color-surface);
                               border:1px solid var(--color-border);
                               border-radius:var(--radius-md);
                               display:flex;align-items:center;
                               justify-content:center;flex-shrink:0">
                    ${item.icon}
                  </div>
                  <div>
                    <div style="font-size:var(--text-xs);font-weight:700;
                                 letter-spacing:.1em;text-transform:uppercase;
                                 color:var(--color-text-muted);
                                 margin-bottom:var(--space-1)">
                      ${item.label}
                    </div>
                    ${item.link
                      ? `<a href="${Engine.Renderer.escape(item.link)}"
                            style="color:var(--color-text);font-size:var(--text-sm);
                                   text-decoration:underline;text-underline-offset:3px"
                            ${item.link.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>
                           ${Engine.Renderer.escape(item.value)}
                         </a>`
                      : `<span style="font-size:var(--text-sm);color:var(--color-text)">
                           ${Engine.Renderer.escape(item.value)}
                         </span>`
                    }
                  </div>
                </div>
              `).join('')}

              <!-- Social Links -->
              ${cfg.social ? `
                <div style="margin-top:var(--space-8);
                             padding-top:var(--space-6);
                             border-top:1px solid var(--color-border)">
                  <div style="font-size:var(--text-xs);font-weight:700;
                               letter-spacing:.1em;text-transform:uppercase;
                               color:var(--color-text-muted);
                               margin-bottom:var(--space-4)">
                    Follow Us
                  </div>
                  <div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
                    ${Object.entries(cfg.social).map(([platform, url]) => `
                      <a href="${Engine.Renderer.escape(url)}"
                         target="_blank" rel="noopener noreferrer"
                         class="btn btn-outline btn-sm"
                         style="text-transform:capitalize;font-size:var(--text-xs)">
                        ${Engine.Renderer.escape(platform)}
                      </a>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- Contact Form -->
            <div style="background:var(--color-surface);
                        border:1px solid var(--color-border);
                        border-radius:var(--radius-lg);
                        padding:clamp(var(--space-5),4vw,var(--space-8))">
              <h2 style="font-size:var(--text-xl);font-family:var(--font-display);
                         font-weight:400;margin-bottom:var(--space-6)">
                Send a Message
              </h2>

              <div id="contact-form-wrap">
                <div class="form-group">
                  <label class="form-label" for="cf-name">Your Name *</label>
                  <input class="form-input" id="cf-name" type="text"
                         placeholder="Arjun Singh"
                         maxlength="100" autocomplete="name" />
                  <span class="form-error" id="cf-name-err" role="alert"></span>
                </div>

                <div class="form-group">
                  <label class="form-label" for="cf-email">Email Address *</label>
                  <input class="form-input" id="cf-email" type="email"
                         placeholder="you@example.com"
                         maxlength="254" autocomplete="email" />
                  <span class="form-error" id="cf-email-err" role="alert"></span>
                </div>

                <div class="form-group">
                  <label class="form-label" for="cf-subject">Subject</label>
                  <input class="form-input" id="cf-subject" type="text"
                         placeholder="Order query, sizing, feedback…"
                         maxlength="160" />
                </div>

                <div class="form-group">
                  <label class="form-label" for="cf-message">Message *</label>
                  <textarea class="form-textarea" id="cf-message"
                            rows="5" maxlength="2000"
                            placeholder="Tell us how we can help…"></textarea>
                  <span class="form-error" id="cf-msg-err" role="alert"></span>
                </div>

                <span class="form-error" id="cf-global-err"
                      role="alert"
                      style="display:block;text-align:center;margin-bottom:var(--space-4)"></span>

                <button class="btn btn-primary btn-full" id="cf-submit">
                  Send Message
                </button>
              </div>

              <!-- Success State -->
              <div id="contact-success" style="display:none;text-align:center;
                                               padding:var(--space-12) var(--space-4)">
                <div style="font-size:2.5rem;margin-bottom:var(--space-4)">✅</div>
                <h3 style="font-size:var(--text-xl);font-family:var(--font-display);
                           font-weight:400;margin-bottom:var(--space-3)">
                  Message Sent!
                </h3>
                <p style="color:var(--color-text-muted);font-size:var(--text-sm);
                          line-height:1.7">
                  Thanks for reaching out. We'll get back to you within 24 hours.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      <!-- FAQ Strip -->
      <section style="padding:var(--space-16) 0;background:var(--color-surface);
                      border-top:1px solid var(--color-border)">
        <div class="container" style="max-width:700px">
          <h2 style="font-size:var(--text-2xl);font-family:var(--font-display);
                     font-weight:300;letter-spacing:-.02em;
                     text-align:center;margin-bottom:var(--space-10)">
            Quick Answers
          </h2>
          <div style="display:flex;flex-direction:column;gap:var(--space-4)">
            ${[
              { q: 'How long does delivery take?', a: 'Standard delivery takes 3–5 business days. Express delivery (1–2 days) is available at checkout.' },
              { q: 'Can I return or exchange?',    a: 'Yes! We offer hassle-free 7-day returns and exchanges. The item must be unworn with tags intact.' },
              { q: 'How do I track my order?',     a: 'Once shipped, you\'ll receive a tracking ID via email. You can also check order status in your account under My Orders.' },
              { q: 'What sizes do you offer?',     a: 'We offer XS through XXL. Check our Size Guide on any product page for measurements.' },
            ].map(faq => `
              <div style="padding:var(--space-5) var(--space-6);
                          background:var(--color-bg);
                          border:1px solid var(--color-border);
                          border-radius:var(--radius-lg)">
                <div style="font-weight:600;font-size:var(--text-sm);
                             margin-bottom:var(--space-2)">
                  ${Engine.Renderer.escape(faq.q)}
                </div>
                <div style="color:var(--color-text-muted);font-size:var(--text-sm);
                             line-height:1.7">
                  ${Engine.Renderer.escape(faq.a)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

    `);

    _bindForm();
  }

  function _bindForm() {
    const form    = document.getElementById('contact-form-wrap');
    const success = document.getElementById('contact-success');
    const submitBtn = document.getElementById('cf-submit');
    if (!submitBtn) return;

    let _submitting = false;

    submitBtn.addEventListener('click', async () => {
      if (_submitting) return;

      /* Clear errors */
      ['name', 'email', 'msg'].forEach(f => {
        const el = document.getElementById(`cf-${f}-err`);
        if (el) el.textContent = '';
      });
      const globalErr = document.getElementById('cf-global-err');
      if (globalErr) globalErr.textContent = '';

      const name    = document.getElementById('cf-name')?.value.trim();
      const email   = document.getElementById('cf-email')?.value.trim();
      const subject = document.getElementById('cf-subject')?.value.trim();
      const message = document.getElementById('cf-message')?.value.trim();

      /* Validate */
      let hasError = false;

      if (!name || name.length < 2) {
        const el = document.getElementById('cf-name-err');
        if (el) el.textContent = 'Please enter your name';
        hasError = true;
      }
      if (!email || !email.includes('@') || !email.includes('.')) {
        const el = document.getElementById('cf-email-err');
        if (el) el.textContent = 'Please enter a valid email';
        hasError = true;
      }
      if (!message || message.length < 10) {
        const el = document.getElementById('cf-msg-err');
        if (el) el.textContent = 'Message must be at least 10 characters';
        hasError = true;
      }

      if (hasError) return;

      _submitting = true;
      submitBtn.disabled    = true;
      submitBtn.textContent = 'Sending…';

      /* Try Supabase contact_messages table first */
      let saved = false;
      const client = SupabaseClient.get();
      if (client) {
        try {
          const { error } = await client
            .from('contact_messages')
            .insert({ name, email, subject: subject || null, message });
          if (!error) saved = true;
        } catch (_) { /* silent fallback */ }
      }

      /* Fallback: mailto link open */
      if (!saved) {
        const mailto = `mailto:${(cfg.contact?.email || 'hello@aman.in')}` +
          `?subject=${encodeURIComponent(subject || 'Message from ' + name)}` +
          `&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`;
        window.open(mailto, '_blank');
      }

      _submitting = false;

      /* Show success */
      if (form)    form.style.display    = 'none';
      if (success) success.style.display = 'block';
    });
  }

  return { render };

})();

/* ── ROUTE REGISTRATION ── */
Engine.Router.register('/contact', () => Engine.Pages.Contact.render());
