/**
 * PAGE / about.js — AMAN CLOTHING
 * Path: js/pages/about.js
 *
 * About Us page — brand story, values, team.
 * Fully config-driven from SITE_CONFIG.about (if present),
 * falls back to default content gracefully.
 * NON-BLOCKING: render() is synchronous.
 */

Engine.Pages = Engine.Pages || {};

Engine.Pages.About = (() => {

  const cfg = window.SITE_CONFIG;

  function render() {
    const about = cfg.about || {};

    Engine.Renderer.mount('#app-root', `

      <!-- Page Header -->
      <div style="background:var(--color-surface);
                  border-bottom:1px solid var(--color-border);
                  padding:calc(var(--navbar-h) + var(--space-16)) 0 var(--space-12);
                  text-align:center">
        <div class="container" style="max-width:640px">
          <p style="font-size:var(--text-xs);font-weight:700;letter-spacing:.14em;
                    text-transform:uppercase;color:var(--color-text-muted);
                    margin-bottom:var(--space-3)">
            Our Story
          </p>
          <h1 style="font-size:clamp(2rem,8vw,var(--text-5xl));font-family:var(--font-display);
                     font-weight:300;letter-spacing:-.03em;
                     margin-bottom:var(--space-5)">
            ${Engine.Renderer.escape(about.headline || 'Built Different')}
          </h1>
          <p style="font-size:var(--text-lg);color:var(--color-text-muted);
                    line-height:1.8">
            ${Engine.Renderer.escape(about.subline || cfg.description || 'Premium minimal streetwear crafted for the modern generation.')}
          </p>
        </div>
      </div>

      <!-- Story Section -->
      <section style="padding:var(--space-20) 0;background:var(--color-bg)">
        <div class="container">
          <div style="display:grid;grid-template-columns:1fr;gap:var(--space-10);
                      align-items:center;max-width:1000px;margin:0 auto">
            <div>
              <span style="font-size:var(--text-xs);font-weight:700;letter-spacing:.14em;
                            text-transform:uppercase;color:var(--color-text-muted)">
                The Beginning
              </span>
              <h2 style="font-size:clamp(1.5rem,5vw,var(--text-3xl));font-family:var(--font-display);
                         font-weight:300;letter-spacing:-.02em;
                         margin:var(--space-3) 0 var(--space-5)">
                ${Engine.Renderer.escape(about.storyTitle || 'Born from a love of clean design')}
              </h2>
              <p style="color:var(--color-text-muted);line-height:1.9;font-size:var(--text-base);
                        margin-bottom:var(--space-5)">
                ${Engine.Renderer.escape(about.storyP1 || cfg.description || 'We started AMAN with a simple belief — great clothing should feel effortless. Every piece we create strips away the noise and focuses on what matters: quality fabric, precise fit, and timeless design.')}
              </p>
              <p style="color:var(--color-text-muted);line-height:1.9;font-size:var(--text-base)">
                ${Engine.Renderer.escape(about.storyP2 || 'Made in India for those who move quietly but make an impact. No loud logos. No unnecessary details. Just clothing that works.')}
              </p>
            </div>
            <div style="background:var(--color-surface-2);
                        border-radius:var(--radius-lg);
                        aspect-ratio:4/5;
                        overflow:hidden;
                        position:relative">
              <div style="width:100%;height:100%;
                          background-image:url(${Engine.Renderer.escape(about.storyImage || 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80')});
                          background-size:cover;background-position:center"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Values Grid -->
      <section style="padding:var(--space-20) 0;background:var(--color-surface)">
        <div class="container">
          <div style="text-align:center;margin-bottom:var(--space-12)">
            <span style="font-size:var(--text-xs);font-weight:700;letter-spacing:.14em;
                          text-transform:uppercase;color:var(--color-text-muted)">
              What We Stand For
            </span>
            <h2 style="font-size:var(--text-3xl);font-family:var(--font-display);
                       font-weight:300;letter-spacing:-.02em;
                       margin-top:var(--space-3)">
              Our Values
            </h2>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
                      gap:var(--space-6);max-width:900px;margin:0 auto">
            ${[
              { icon: '🧵', title: 'Craftsmanship', desc: 'Every stitch matters. We use 400GSM+ premium cotton and oversized silhouettes designed to last years, not seasons.' },
              { icon: '🌿', title: 'Sustainability', desc: 'Eco-conscious materials, minimal packaging, and a commitment to reducing waste in everything we do.' },
              { icon: '🇮🇳', title: 'Made in India', desc: 'Proudly designed and crafted in India by skilled artisans who take pride in every garment that leaves their hands.' },
              { icon: '✦', title: 'Minimal by Design', desc: 'No loud logos. No seasonal gimmicks. Clothing designed to outlast trends and stay relevant for years.' },
            ].map(v => `
              <div style="padding:var(--space-8);
                          border:1px solid var(--color-border);
                          border-radius:var(--radius-lg);
                          background:var(--color-bg)">
                <div style="font-size:1.75rem;margin-bottom:var(--space-4)">${v.icon}</div>
                <h3 style="font-size:var(--text-base);font-weight:600;
                           margin-bottom:var(--space-3);letter-spacing:.02em">
                  ${v.title}
                </h3>
                <p style="color:var(--color-text-muted);font-size:var(--text-sm);
                          line-height:1.8">
                  ${v.desc}
                </p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- Stats Bar -->
      <section style="padding:var(--space-16) 0;
                      background:var(--color-primary);
                      color:var(--color-surface)">
        <div class="container">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
                      gap:var(--space-8);text-align:center">
            ${[
              { num: '2024',   label: 'Founded' },
              { num: '400+',   label: 'Happy Customers' },
              { num: '100%',   label: 'Premium Cotton' },
              { num: '7-Day',  label: 'Easy Returns' },
            ].map(s => `
              <div>
                <div style="font-size:var(--text-4xl);font-family:var(--font-display);
                             font-weight:300;letter-spacing:-.03em;
                             margin-bottom:var(--space-2)">
                  ${s.num}
                </div>
                <div style="font-size:var(--text-xs);font-weight:700;
                             letter-spacing:.12em;text-transform:uppercase;
                             opacity:.6">
                  ${s.label}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section style="padding:var(--space-20) 0;background:var(--color-bg);text-align:center">
        <div class="container" style="max-width:500px">
          <h2 style="font-size:var(--text-3xl);font-family:var(--font-display);
                     font-weight:300;letter-spacing:-.02em;
                     margin-bottom:var(--space-5)">
            Ready to elevate your wardrobe?
          </h2>
          <a href="#/shop" class="btn btn-primary btn-lg">
            Shop Now
          </a>
        </div>
      </section>

    `);
  }

  return { render };

})();

/* ── ROUTE REGISTRATION ── */
Engine.Router.register('/about', () => Engine.Pages.About.render());
