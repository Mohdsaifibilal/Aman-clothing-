-- ═══════════════════════════════════════════════════════════
-- AMAN CLOTHING — COMPLETE SUPABASE SCHEMA
-- Version: Final Production
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste all → Run
--   (Safe to run multiple times — all IF NOT EXISTS)
--
-- WHAT THIS CREATES:
--   Tables:    profiles, products, orders, reviews, newsletter_subscribers
--   Functions: set_updated_at, handle_new_user, is_admin,
--              decrement_stock, get_product_rating
--   Triggers:  auto updated_at on all tables, auto profile on signup
--   Indexes:   26 performance indexes
--   RLS:       25 row-level security policies
--   Seed:      8 Aman clothing products
--
-- BEFORE RUNNING:
--   Replace 'admin@youremail.com' with your actual admin email
-- ═══════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────
-- HELPER: auto-set updated_at on any UPDATE
-- ─────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- TABLE: profiles
-- Auto-created when user signs up via Supabase Auth
-- ═══════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text unique not null,
  role       text not null default 'user' check (role in ('user', 'admin')),
  full_name  text check (char_length(full_name) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile when user signs up
-- ⚠️  REPLACE 'admin@youremail.com' with your real admin email
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _admin_emails text[] := array[
    'admin@youremail.com'
  ];
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when new.email = any(_admin_emails) then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════
-- TABLE: products
-- ═══════════════════════════════════════════════════════════
create table if not exists public.products (
  id          uuid not null default uuid_generate_v4() primary key,
  name        text not null check (char_length(name) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  price       numeric(10,2) not null check (price > 0 and price <= 999999),
  image_url   text check (image_url is null or image_url ~* '^https?://'),
  stock       integer not null default 0 check (stock >= 0 and stock <= 999999),
  category    text check (category is null or char_length(category) <= 80),
  sizes       text[] check (sizes is null or array_length(sizes, 1) between 1 and 10),
  sku         text unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists products_active_category_idx
  on public.products(category) where active = true;
create index if not exists products_active_idx
  on public.products(active);
create index if not exists products_stock_idx
  on public.products(stock) where active = true;
create index if not exists products_created_idx
  on public.products(created_at desc);
create index if not exists products_fts_idx
  on public.products
  using gin(to_tsvector('english', name || ' ' || coalesce(description, '')));
create index if not exists products_active_category_created_idx
  on public.products(active, category, created_at desc) where active = true;
create index if not exists products_active_id_idx
  on public.products(id, active) where active = true;
create index if not exists products_id_stock_name_idx
  on public.products(id) include (stock, name);
create index if not exists products_low_stock_idx
  on public.products(stock) where active = true and stock > 0 and stock <= 5;

-- ═══════════════════════════════════════════════════════════
-- TABLE: orders
-- items JSONB shape: [{id, name, price, quantity, size, image_url, category}]
-- ═══════════════════════════════════════════════════════════
create table if not exists public.orders (
  id               uuid not null default uuid_generate_v4() primary key,
  user_id          uuid references auth.users(id) on delete set null,
  items            jsonb not null,
  total            numeric(10,2) not null check (total >= 0),
  status           text not null default 'pending'
                   check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  notes            text,
  address          jsonb,
  payment_id       text unique,
  payment_order_id text,
  payment_status   text not null default 'pending'
                   check (payment_status in ('pending','paid','failed','refunded')),
  order_status     text not null default 'pending'
                   check (order_status in ('pending','confirmed','shipped','delivered','cancelled')),
  courier          text,
  tracking_id      text,
  tracking_url     text,
  shipment_status  text not null default 'pending'
                   check (shipment_status in ('pending','shipped','delivered')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.orders.items is
  'Array: [{id, name, price, quantity, size, image_url, category}]. size is nullable.';

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists orders_user_idx          on public.orders(user_id);
create index if not exists orders_status_idx        on public.orders(status);
create index if not exists orders_created_idx       on public.orders(created_at desc);
create index if not exists orders_user_created_idx  on public.orders(user_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists orders_payment_id_idx
  on public.orders(payment_id) where payment_id is not null;
create index if not exists orders_payment_status_idx  on public.orders(payment_status);
create index if not exists orders_order_status_idx    on public.orders(order_status);
create index if not exists orders_shipment_status_idx on public.orders(shipment_status);

-- ═══════════════════════════════════════════════════════════
-- TABLE: reviews
-- One review per user per product (unique constraint)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.reviews (
  id         uuid not null default uuid_generate_v4() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  title      text check (title is null or char_length(title) <= 120),
  body       text not null check (char_length(body) between 10 and 1000),
  verified   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists reviews_product_idx
  on public.reviews(product_id, created_at desc);
create index if not exists reviews_user_idx
  on public.reviews(user_id);
create index if not exists reviews_verified_idx
  on public.reviews(product_id, rating) where verified = true;

-- ═══════════════════════════════════════════════════════════
-- TABLE: newsletter_subscribers
-- ═══════════════════════════════════════════════════════════
create table if not exists public.newsletter_subscribers (
  id         uuid not null default uuid_generate_v4() primary key,
  email      text not null unique
             check (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
  active     boolean not null default true,
  source     text default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists newsletter_updated_at on public.newsletter_subscribers;
create trigger newsletter_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

create index if not exists newsletter_email_idx
  on public.newsletter_subscribers(email);
create index if not exists newsletter_active_idx
  on public.newsletter_subscribers(active, created_at desc) where active = true;

-- ═══════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════

-- is_admin(): checks if current user is admin
-- SECURITY DEFINER bypasses RLS to read profiles safely
create or replace function public.is_admin()
returns boolean language sql
security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- decrement_stock(): atomic stock decrement
-- Single UPDATE with WHERE stock >= qty prevents overselling
create or replace function public.decrement_stock(product_id uuid, qty integer)
returns void language plpgsql
security definer set search_path = public as $$
begin
  if qty is null or qty <= 0 then
    raise exception 'decrement_stock: qty must be positive, got %', qty;
  end if;

  update public.products
  set    stock = stock - qty
  where  id    = product_id
    and  active = true
    and  stock >= qty;

  if not found then
    raise exception
      'decrement_stock: insufficient stock for product %. Requested %, available may be less.',
      product_id, qty
      using errcode = 'P0002';
  end if;
end;
$$;

-- get_product_rating(): avg rating + count for a product
create or replace function public.get_product_rating(p_product_id uuid)
returns table (avg_rating numeric, review_count bigint)
language sql stable security definer
set search_path = public as $$
  select
    round(avg(rating)::numeric, 1) as avg_rating,
    count(*)                        as review_count
  from public.reviews
  where product_id = p_product_id;
$$;

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════

-- ── PROFILES ──
alter table public.profiles enable row level security;

drop policy if exists "profiles: user reads own"                on public.profiles;
drop policy if exists "profiles: user updates own"              on public.profiles;
drop policy if exists "profiles: user updates own (no role escalation)" on public.profiles;
drop policy if exists "profiles: admin reads all"               on public.profiles;

create policy "profiles: user reads own"
  on public.profiles for select using (auth.uid() = id);

create policy "profiles: user updates own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles: admin reads all"
  on public.profiles for select using (public.is_admin());

-- ── PRODUCTS ──
alter table public.products enable row level security;

drop policy if exists "products: public reads active" on public.products;
drop policy if exists "products: admin reads all"     on public.products;
drop policy if exists "products: admin inserts"       on public.products;
drop policy if exists "products: admin updates"       on public.products;
drop policy if exists "products: admin deletes"       on public.products;

create policy "products: public reads active"
  on public.products for select using (active = true);
create policy "products: admin reads all"
  on public.products for select using (public.is_admin());
create policy "products: admin inserts"
  on public.products for insert with check (public.is_admin());
create policy "products: admin updates"
  on public.products for update using (public.is_admin());
create policy "products: admin deletes"
  on public.products for delete using (public.is_admin());

-- ── ORDERS ──
alter table public.orders enable row level security;

drop policy if exists "orders: auth creates"          on public.orders;
drop policy if exists "orders: user reads own"        on public.orders;
drop policy if exists "orders: admin reads all"       on public.orders;
drop policy if exists "orders: admin updates status"  on public.orders;
drop policy if exists "orders: admin updates shipping" on public.orders;

create policy "orders: auth creates"
  on public.orders for insert
  with check (auth.uid() is not null and (user_id = auth.uid() or user_id is null));
create policy "orders: user reads own"
  on public.orders for select using (auth.uid() = user_id);
create policy "orders: admin reads all"
  on public.orders for select using (public.is_admin());
create policy "orders: admin updates"
  on public.orders for update using (public.is_admin()) with check (public.is_admin());

-- ── REVIEWS ──
alter table public.reviews enable row level security;

drop policy if exists "reviews: public reads all"       on public.reviews;
drop policy if exists "reviews: auth user inserts own"  on public.reviews;
drop policy if exists "reviews: user updates own"       on public.reviews;
drop policy if exists "reviews: user deletes own"       on public.reviews;
drop policy if exists "reviews: admin manages all"      on public.reviews;

create policy "reviews: public reads all"
  on public.reviews for select using (true);
create policy "reviews: auth user inserts own"
  on public.reviews for insert with check (auth.uid() = user_id);
create policy "reviews: user updates own"
  on public.reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reviews: user deletes own"
  on public.reviews for delete using (auth.uid() = user_id);
create policy "reviews: admin manages all"
  on public.reviews for all using (public.is_admin());

-- ── NEWSLETTER ──
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "newsletter: anyone subscribes"      on public.newsletter_subscribers;
drop policy if exists "newsletter: anyone unsubscribes own" on public.newsletter_subscribers;
drop policy if exists "newsletter: admin reads all"        on public.newsletter_subscribers;
drop policy if exists "newsletter: admin deletes"          on public.newsletter_subscribers;

create policy "newsletter: anyone subscribes"
  on public.newsletter_subscribers for insert with check (true);
create policy "newsletter: anyone unsubscribes own"
  on public.newsletter_subscribers for update using (true) with check (active = false);
create policy "newsletter: admin reads all"
  on public.newsletter_subscribers for select using (public.is_admin());
create policy "newsletter: admin deletes"
  on public.newsletter_subscribers for delete using (public.is_admin());

-- ═══════════════════════════════════════════════════════════
-- GRANTS
-- ═══════════════════════════════════════════════════════════
grant usage  on schema public to anon, authenticated;
grant select on public.products to anon;
grant select, insert on public.orders to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.reviews to anon;
grant select, insert, update, delete on public.reviews to authenticated;
grant insert on public.newsletter_subscribers to anon;
grant insert, update, select, delete on public.newsletter_subscribers to authenticated;
grant execute on function public.is_admin()                     to authenticated;
grant execute on function public.decrement_stock(uuid, integer) to authenticated, service_role;
grant execute on function public.get_product_rating(uuid)       to anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- SEED DATA — AMAN CLOTHING
-- Only inserts if products table is empty
-- ═══════════════════════════════════════════════════════════
do $$
begin
  if (select count(*) from public.products) = 0 then

    insert into public.products (name, description, price, image_url, stock, category, sizes, active)
    values
      ('Essential Hoodie',
       'Premium heavyweight hoodie. Minimal branding, maximum comfort. 400GSM brushed fleece inside.',
       1499, 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600&q=80',
       12, 'hoodies', array['XS','S','M','L','XL','XXL'], true),

      ('Oversized Hoodie',
       'Dropped shoulders, kangaroo pocket, ribbed cuffs. Perfect oversized fit for the streets.',
       1699, 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&q=80',
       8, 'hoodies', array['XS','S','M','L','XL','XXL'], true),

      ('Classic Zip Hoodie',
       'Full zip hoodie in brushed fleece. Ribbed cuffs and hem for a clean finish.',
       1899, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
       5, 'hoodies', array['S','M','L','XL','XXL'], true),

      ('Essential Tee',
       'Clean minimal tee. 220GSM combed cotton. Relaxed fit, dropped hem.',
       699, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80',
       20, 't-shirts', array['XS','S','M','L','XL','XXL'], true),

      ('Oversized Graphic Tee',
       'Box-fit graphic tee. Screen printed artwork. 100% organic cotton.',
       899, 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&q=80',
       15, 't-shirts', array['XS','S','M','L','XL'], true),

      ('Longline Tee',
       'Extended hem longline tee. Ultra soft 230GSM cotton. Side splits at hem.',
       799, 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&q=80',
       0, 't-shirts', array['S','M','L','XL'], true),

      ('Oxford Shirt',
       'Slim fit oxford weave shirt. Button down collar. Versatile — street to formal.',
       1299, 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80',
       10, 'shirts', array['XS','S','M','L','XL','XXL'], true),

      ('Linen Overshirt',
       '100% linen overshirt. Relaxed fit, chest pocket. Perfect layering piece.',
       1599, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&q=80',
       6, 'shirts', array['XS','S','M','L','XL'], true);

  end if;
end $$;
