/**
 * ═══════════════════════════════════════════════════════════
 * SITE CONFIG — AMAN CLOTHING
 * ═══════════════════════════════════════════════════════════
 */

window.SITE_CONFIG = {

  /* ── Identity ── */
  name:        'AMAN',
  tagline:     'Minimal. Timeless. Yours.',
  description: 'Premium minimal streetwear crafted for the modern generation.',
  logo:        'AMAN',

  /* ── Supabase credentials ── */
  supabase: {
    url:     'https://jjjhctruyyjexjljmroe.supabase.co',
    anonKey: 'sb_publishable_xKJ6hXc8O6LrVBq0LXQ9hQ_PCt3Jwl8',
  },

  /* ── Tables ── */
  table: {
    products: 'products',
    orders:   'orders',
    users:    'users',
  },

  /* ── Navigation (used in menu drawer) ── */
  nav: [
    { label: 'HOME',     href: '#/'                 },
    { label: 'HOODIES',  href: '#/category/hoodies' },
    { label: 'T-SHIRTS', href: '#/category/t-shirts'},
    { label: 'SHIRTS',   href: '#/category/shirts'  },
    { label: 'ABOUT US', href: '#/about'            },
    { label: 'CONTACT',  href: '#/contact'          },
  ],

  /* ── Footer ── */
  footer: {
    columns: [
      {
        title: 'Shop',
        links: [
          { label: 'Hoodies',       href: '#/category/hoodies'  },
          { label: 'T-Shirts',      href: '#/category/t-shirts' },
          { label: 'Shirts',        href: '#/category/shirts'   },
        ]
      },
      {
        title: 'Info',
        links: [
          { label: 'About Us',  href: '#/about'   },
          { label: 'Contact',   href: '#/contact' },
          { label: '7-Day Returns', href: '#/returns' },
        ]
      }
    ]
  },

  /* ── Hero ── */
  hero: {
    eyebrow:      'New Season',
    title:        'NEW<br>SEASON',
    desc:         'Minimal. Timeless. Yours.',
    ctaPrimary:   { label: 'Shop Now', href: '#/shop' },
    ctaSecondary: { label: 'Explore',  href: '#/about'   },
    stats: [],
    badge: 'FREE SHIPPING ABOVE ₹999',
  },

  /* ── Products section ── */
  products: {
    sectionEyebrow:  'Drop 01',
    sectionTitle:    'New Season',
    sectionSubtitle: 'Crafted for the ones who move quietly.',
    lowStockThreshold: 5,
    categories: [
      { slug: 'all',      label: 'ALL'      },
      { slug: 'hoodies',  label: 'HOODIES'  },
      { slug: 't-shirts', label: 'T-SHIRTS' },
      { slug: 'shirts',   label: 'SHIRTS'   },
    ],
  },

  /* ── Currency & locale ── */
  locale: {
    currency: 'INR',
    symbol:   '₹',
    locale:   'en-IN',
  },

  /* ── Feature flags ── */
  features: {
    auth:        true,
    cart:        true,
    adminPanel:  true,
    stockBadges: false,
    search:      true,
    categories:  true,
  },

  /* ── Admin ── */
  admin: {
    adminEmails: ['admin@aman.com', 'saifibilal385@gmail.com'],
  },

  /* ── About Us ── */
  about: {
    headline:    'Built Different',
    subline:     'Premium minimal streetwear crafted for the modern generation.',
    storyTitle:  'Born in Lucknow, Made for Everyone',
    storyP1:     'AMAN started with one simple idea — clothing should feel as good as it looks. We believe in clean cuts, quality fabrics, and designs that never go out of style. No loud logos, no unnecessary details.',
    storyP2:     'Made in India for those who move quietly but make an impact. Every piece we create is crafted with care — because you deserve clothing that works as hard as you do.',
    storyImage:  'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80',
    values: [
      { icon: '✦', title: 'Quality First',    desc: 'Premium fabrics that feel great and last long.' },
      { icon: '◈', title: 'Minimal Design',   desc: 'Clean cuts and timeless styles, no unnecessary details.' },
      { icon: '❋', title: 'Made in India',    desc: 'Proudly crafted in India for the modern generation.' },
      { icon: '⟡', title: 'Honest Pricing',   desc: 'Premium quality without the premium markup.' },
    ],
  },

  /* ── Contact ── */
  contact: {
    email:     'saifibilal385@gmail.com',
    whatsapp:  '+919235052684',
    address:   'Lucknow, Uttar Pradesh, India',
    hours:     'Within 24 hours (Mon–Sat)',
    tagline:   'Have a question about your order, sizing, or just want to say hello? We are here.',
  },

  /* ── Payment ── */
  payment: {
    provider:        'demo',
    razorpayKeyId:   'rzp_test_YOUR_KEY_ID',
    stripePublicKey: 'pk_test_YOUR_STRIPE_KEY',
    currency:        'INR',
  },

  /* ── Theming ── */
  theme: {
    '--color-primary':       '#0a0a0a',
    '--color-primary-hover': '#1c1c1c',
    '--color-accent':        '#0a0a0a',
    '--color-accent-hover':  '#1c1c1c',
    '--color-bg':            '#f2f0ec',
    '--color-surface':       '#ffffff',
    '--color-surface-2':     '#eae8e4',
    '--color-border':        '#e0ddd9',
    '--color-text':          '#0a0a0a',
    '--color-text-muted':    '#706e6b',
    '--color-text-light':    '#b0aeab',
    '--font-display':        "'DM Sans', system-ui, sans-serif",
    '--font-body':           "'DM Sans', system-ui, sans-serif",
    '--navbar-h':            '56px',
    '--hero-image':          'url(https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1200&q=80)',
  },

};

Object.freeze(window.SITE_CONFIG.features);
Object.freeze(window.SITE_CONFIG.locale);
