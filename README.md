# MC Booking Platform — Phase 1

A **multi-tenant** Next.js + Supabase starter:
- Public sites at `/{slug}` (only `active` profiles are visible)
- Self-serve profile creation (Mode B) with **approval gate** (pending → active)
- Platform admin approval queue
- Basic lead form (stores JSON in `leads`)

## 1) Setup

1. Create a Supabase project
2. Run SQL:
   - `supabase/schema.sql`
   - `supabase/seed.sql` (optional demo)

3. Create `.env.local` from `.env.example`

```bash
npm i
npm run dev
```

## 2) Make yourself a platform admin

After signing up in `/admin/login`, copy your Supabase auth user id (UUID) and insert it:

```sql
insert into public.user_roles (user_id, role) values ('YOUR-USER-ID', 'platform_admin');
```

Now you can open:
- `/admin/platform/profiles` to approve pending profiles

## 3) Self-serve profile creation

- Sign in
- Go to `/admin/create-profile`
- Create profile (status: pending)
- Platform admin approves it → public page works at `/{slug}`

## 4) Switching Mode B → Mode A later

Update the single row:

```sql
update public.platform_settings set profile_creation_mode='admin_only' where id=1;
```

When set to `admin_only`, non-admin users cannot create profiles.

## Notes
- Phase 1 keeps media + dynamic form builder as placeholders.
- Leads are stored as JSON (`leads.form_data`) so Phase 2 can add per-profile form builder without migrations.
