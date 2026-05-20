-- ═══════════════════════════════════════════════════════════
-- SCHEMA ADDON — AMAN ENGINE
-- Run this in Supabase SQL Editor ONCE
-- Existing schema kuch nahi badlega — sirf yeh table add hogi
-- ═══════════════════════════════════════════════════════════

-- ── TABLE: insta_posts
-- Admin panel se Instagram/Lookbook cards manage karo
-- image_url: Supabase Storage ya koi bhi direct image URL
-- post_url:  Instagram post link (optional, click pe open hoga)
-- sort_order: chota number = pehle dikhega
-- active: false = hide from homepage (without deleting)
-- ═══════════════════════════════════════════════════════════

create table if not exists public.insta_posts (
  id          uuid        not null default uuid_generate_v4() primary key,
  image_url   text        not null,
  caption     text        check (caption is null or char_length(caption) <= 300),
  post_url    text,
  sort_order  integer     not null default 0,
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on every row change
drop trigger if exists insta_posts_updated_at on public.insta_posts;
create trigger insta_posts_updated_at
  before update on public.insta_posts
  for each row execute function public.set_updated_at();

-- Index for homepage query (active posts sorted by order)
create index if not exists insta_posts_active_idx
  on public.insta_posts(sort_order asc)
  where active = true;

-- ── ROW LEVEL SECURITY ──
alter table public.insta_posts enable row level security;

-- Anyone can view active posts (homepage)
drop policy if exists "insta_posts: public reads active" on public.insta_posts;
create policy "insta_posts: public reads active"
  on public.insta_posts for select
  using (active = true);

-- Admin can do everything (read all including inactive, insert, update, delete)
drop policy if exists "insta_posts: admin manages all" on public.insta_posts;
create policy "insta_posts: admin manages all"
  on public.insta_posts for all
  using (public.is_admin());

-- ── PERMISSIONS ──
grant select on public.insta_posts to anon;
grant select, insert, update, delete on public.insta_posts to authenticated;

-- ── SAMPLE DATA (optional — delete if not needed) ──
-- Uncomment to insert 6 sample posts:
/*
insert into public.insta_posts (image_url, caption, post_url, sort_order) values
  ('https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=500&q=80', 'Oversized vibes ✦', 'https://instagram.com', 1),
  ('https://images.unsplash.com/photo-1581803118522-7b72a50f7e9f?w=500&q=80', 'Drop 01 is here', 'https://instagram.com', 2),
  ('https://images.unsplash.com/photo-1547153760-18fc86324498?w=500&q=80', 'Move quietly', 'https://instagram.com', 3),
  ('https://images.unsplash.com/photo-1578681994506-b8f463449011?w=500&q=80', 'Premium cotton feels different', 'https://instagram.com', 4),
  ('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80', 'Minimal. Timeless.', 'https://instagram.com', 5),
  ('https://images.unsplash.com/photo-1509631179647-0177331693ae?w=500&q=80', 'New season', 'https://instagram.com', 6);
*/
