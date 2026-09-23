-- Initial schema for Hapag on Render Postgres.
--
-- Consolidated equivalent of qr-menu-dev's supabase/migrations/ history
-- (20260710015525_initial_schema.sql through 20260904000000), reflecting the
-- CURRENT shape described in qr-menu-render-v2/reference/database.md, not a
-- replay of the incremental history — this is a fresh database with no
-- existing rows to reconcile.
--
-- Two structural differences from the Supabase-era schema, both required by
-- the migration itself (see specs/Hapag-SRS.md §12.11):
--   1. `auth.users` does not exist on Render Postgres. A `users` table
--      replaces it as the FK target for `businesses.owner_id` and
--      `admin_users.id`, plus new `sessions` and `email_confirmation_tokens` /
--      `password_reset_tokens` tables for Auth.js's hand-rolled session and
--      confirmation/reset flows (previously handled internally by Supabase
--      Auth / GoTrue).
--   2. No Row-Level Security anywhere in this file. Tenant isolation is
--      enforced by the application data-access layer instead (Constitution
--      Principle I, v3.0.0) — every table still carries `business_id` for
--      that layer to filter on, but no `alter table ... enable row level
--      security` or `create policy` statements exist on this stack.
--
-- One additional table not present in qr-menu-dev at all:
-- `item_description_generations` was flagged in Hapag-SRS.md §12.10 as
-- referenced by application code (`src/lib/ai-description/rate-limit.ts`)
-- but never migrated in the original repo, so the AI-description daily cap
-- silently never applied. It's created properly here from the start.

-- ============================================================
-- Extensions
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- Enums
-- ============================================================

create type plan_type as enum ('standard', 'pro', 'trial');
create type business_status as enum ('active', 'suspended', 'trial', 'pending');
create type subscription_status as enum ('pending', 'active', 'expired', 'cancelled');
create type ticket_status as enum ('open', 'in_progress', 'resolved');
create type description_source as enum ('ai_generated', 'manual');
create type source_language as enum ('en', 'fil');
create type display_language as enum ('en', 'ko', 'ja', 'zh');

-- ============================================================
-- users — replaces Supabase `auth.users`. Backs both owner and admin
-- accounts; Auth.js's authorize() distinguishes the two via `admin_users`
-- membership (loginContext: "admin"), same split as the original
-- auth.users + admin_users pairing.
-- ============================================================

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  email_verified timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- sessions — Auth.js's hand-rolled session store. The JWT cookie carries
-- only an opaque session_token pointing here; deleting a row (e.g. on
-- password change, revokeAllSessions()) invalidates that session
-- server-side. `expires` slides forward on activity (30-day idle expiry).
-- ============================================================

create table sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  user_id uuid not null references users (id) on delete cascade,
  expires timestamptz not null,
  created_at timestamptz not null default now()
);

create index on sessions (user_id);

-- ============================================================
-- email_confirmation_tokens — one-time confirmation links, consumed exactly
-- once inside authorize()'s confirmationToken branch (replaces GoTrue's
-- built-in verifyOtp()/type=email flow).
-- ============================================================

create table email_confirmation_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index on email_confirmation_tokens (user_id);

-- ============================================================
-- password_reset_tokens — same one-time-token pattern, for the
-- forgot/reset-password flow (replaces GoTrue's resetPasswordForEmail() /
-- verifyOtp() type=recovery).
-- ============================================================

create table password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index on password_reset_tokens (user_id);

-- ============================================================
-- admin_users
-- Internal ACRET staff. Rows are provisioned manually (direct database
-- access) — no public self-signup, same as before.
-- ============================================================

create table admin_users (
  id uuid primary key references users (id) on delete cascade,
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- businesses
-- ============================================================

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  contact_phone text,
  contact_email text,
  address text,
  owner_id uuid not null references users (id) on delete cascade,
  plan plan_type not null default 'standard',
  status business_status not null default 'pending',
  source_language source_language not null default 'en',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index on businesses (slug);
create index on businesses (owner_id);

-- ============================================================
-- categories
-- ============================================================

create table categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index on categories (business_id);

-- ============================================================
-- items
-- ============================================================

create table items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  name text not null,
  description text,
  description_source description_source,
  ai_keywords text[],
  ai_generated_at timestamptz,
  price numeric(10, 2) not null,
  photo_url text,
  is_displayed boolean not null default true,
  is_sold_out boolean not null default false,
  is_best_seller boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index on items (business_id);
create index on items (category_id);

-- ============================================================
-- item_description_generations — daily AI-description generation cap.
-- Flagged in the original repo as referenced by code but never migrated
-- (Hapag-SRS.md §12.10); created here so the cap actually applies.
-- ============================================================

create table item_description_generations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  generated_on date not null default current_date,
  generation_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (item_id, generated_on)
);

-- ============================================================
-- category_translations / item_translations — Instant Translate cache.
-- ============================================================

create table category_translations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  language_code display_language not null,
  translated_name text,
  source_hash text not null,
  translated_at timestamptz not null default now(),
  unique (category_id, language_code)
);

create index on category_translations (business_id);

create table item_translations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  language_code display_language not null,
  translated_description text,
  source_hash text not null,
  translated_at timestamptz not null default now(),
  unique (item_id, language_code)
);

create index on item_translations (business_id);

-- ============================================================
-- ingredients / item_ingredients / ingredient_translations
-- ============================================================

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index ingredients_business_id_lower_name_idx
  on ingredients (business_id, lower(name));

create table item_ingredients (
  item_id uuid not null references items (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, ingredient_id)
);

create index on item_ingredients (business_id);

create table ingredient_translations (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  language_code display_language not null,
  translated_name text,
  source_hash text not null,
  translated_at timestamptz not null default now(),
  unique (ingredient_id, language_code)
);

create index on ingredient_translations (business_id);

-- ============================================================
-- subscriptions
-- ============================================================

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  plan plan_type not null,
  amount numeric(10, 2) not null default 0,
  status subscription_status not null default 'pending',
  payment_method text,
  payment_proof_url text,
  activated_by uuid references admin_users (id),
  activated_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  reminder_sent_at timestamptz,
  expiry_reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index on subscriptions (business_id);

-- ============================================================
-- support_tickets
-- ============================================================

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  subject text not null,
  message text not null,
  status ticket_status not null default 'open',
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index on support_tickets (business_id);
