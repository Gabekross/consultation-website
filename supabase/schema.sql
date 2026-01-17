-- Phase 1 + Phase 2 schema for MC Booking Platform (multi-tenant)
-- Run in Supabase SQL editor.

create extension if not exists pgcrypto;

-- Platform settings (single row id=1)
create table if not exists public.platform_settings (
  id int primary key,
  profile_creation_mode text not null default 'self_serve', -- 'self_serve' | 'admin_only'
  require_approval boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (1)
on conflict (id) do nothing;

-- User roles (platform admin)
create table if not exists public.user_roles (
  user_id uuid not null,
  role text not null, -- 'platform_admin'
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Profiles (tenants)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  accent_color text not null default '#27c26a',
  hero_headline text,
  hero_subtext text,
  whatsapp_number text,
  notification_emails text[] not null default '{}',
  owner_user_id uuid not null,
  status text not null default 'pending', -- pending|active|rejected
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_status_idx on public.profiles(status);
create index if not exists profiles_owner_idx on public.profiles(owner_user_id);

-- Profile members
create table if not exists public.profile_members (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner', -- owner|editor (phase 2)
  created_at timestamptz not null default now(),
  primary key (profile_id, user_id)
);

-- Leads (form responses stored as JSON to support future dynamic forms)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  form_data jsonb not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- Dynamic form builder fields (phase 2)
create table if not exists public.form_fields (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  field_key text not null,
  type text not null default 'text', -- text|email|phone|date|select|textarea
  required boolean not null default false,
  options text[] not null default '{}',
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique(profile_id, field_key)
);
create index if not exists form_fields_profile_idx on public.form_fields(profile_id, order_index);

-- Gallery items (photos, YouTube, MP4)
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null, -- image|youtube|mp4
  title text,
  image_url text,
  youtube_url text,
  mp4_url text,
  poster_url text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists gallery_profile_idx on public.gallery_items(profile_id, order_index);

-- Reviews (screenshot images on top, text below)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- image|text
  image_url text,
  source text,
  name text,
  rating int,
  event text,
  quote text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists reviews_profile_idx on public.reviews(profile_id, order_index);

-- ========= RLS =========
alter table public.platform_settings enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_members enable row level security;
alter table public.leads enable row level security;
alter table public.form_fields enable row level security;
alter table public.gallery_items enable row level security;
alter table public.reviews enable row level security;

-- Helper: is the current user a member of a profile?
create or replace function public.is_profile_member(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profile_members pm
    where pm.profile_id = p_profile_id and pm.user_id = auth.uid()
  );
$$;

-- ========= POLICIES (IDEMPOTENT) =========

-- PROFILES
drop policy if exists "public read active profiles" on public.profiles;
create policy "public read active profiles" on public.profiles
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "owner read own profiles" on public.profiles;
create policy "owner read own profiles" on public.profiles
for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "owner update own profiles" on public.profiles;
create policy "owner update own profiles" on public.profiles
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "platform admin read all profiles" on public.profiles;
create policy "platform admin read all profiles" on public.profiles
for select
to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = auth.uid() and ur.role = 'platform_admin'
));

-- USER_ROLES
drop policy if exists "Read own roles" on public.user_roles;
create policy "Read own roles" on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

-- PROFILE_MEMBERS
drop policy if exists "members read memberships" on public.profile_members;
create policy "members read memberships" on public.profile_members
for select
to authenticated
using (user_id = auth.uid());

-- LEADS
drop policy if exists "owner read leads" on public.leads;
create policy "owner read leads" on public.leads
for select
to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = leads.profile_id and p.owner_user_id = auth.uid()
));

-- FORM_FIELDS
drop policy if exists "members read form fields" on public.form_fields;
create policy "members read form fields" on public.form_fields
for select
to anon, authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = form_fields.profile_id and p.status = 'active'
  )
  or public.is_profile_member(form_fields.profile_id)
);

drop policy if exists "members write form fields" on public.form_fields;
create policy "members write form fields" on public.form_fields
for all
to authenticated
using (public.is_profile_member(profile_id))
with check (public.is_profile_member(profile_id));

-- GALLERY_ITEMS
drop policy if exists "public read gallery" on public.gallery_items;
create policy "public read gallery" on public.gallery_items
for select
to anon, authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = gallery_items.profile_id and p.status = 'active'
  )
  or public.is_profile_member(gallery_items.profile_id)
);

drop policy if exists "members write gallery" on public.gallery_items;
create policy "members write gallery" on public.gallery_items
for all
to authenticated
using (public.is_profile_member(profile_id))
with check (public.is_profile_member(profile_id));

-- REVIEWS
drop policy if exists "public read reviews" on public.reviews;
create policy "public read reviews" on public.reviews
for select
to anon, authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = reviews.profile_id and p.status = 'active'
  )
  or public.is_profile_member(reviews.profile_id)
);

drop policy if exists "members write reviews" on public.reviews;
create policy "members write reviews" on public.reviews
for all
to authenticated
using (public.is_profile_member(profile_id))
with check (public.is_profile_member(profile_id));

-- Note: inserts/approvals can be performed via server API using service role.
