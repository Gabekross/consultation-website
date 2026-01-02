-- Phase 1 schema for MC Booking Platform (multi-tenant)
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

-- ========= RLS =========
alter table public.platform_settings enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_members enable row level security;
alter table public.leads enable row level security;

-- Public can read ACTIVE profiles only
create policy "public read active profiles" on public.profiles
for select
to anon, authenticated
using (status = 'active');

-- Owners can read their own profiles (any status)
create policy "owner read own profiles" on public.profiles
for select
to authenticated
using (owner_user_id = auth.uid());

-- Owners can update their profile basics (but not approval fields)
create policy "owner update own profiles" on public.profiles
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

-- Members can read membership
create policy "members read memberships" on public.profile_members
for select
to authenticated
using (user_id = auth.uid());

-- Platform admins: we keep admin actions in server routes (service role bypasses RLS),
-- but allow platform admins to SELECT all profiles for the approval UI.
create policy "platform admin read all profiles" on public.profiles
for select
to authenticated
using (exists (
  select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'platform_admin'
));

-- Leads: owners can read leads for their profiles
create policy "owner read leads" on public.leads
for select
to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = leads.profile_id and p.owner_user_id = auth.uid()
));

-- Note: inserts are performed via server API using service role in Phase 1.
