-- PaperMint Supabase schema
-- Run this in Supabase SQL Editor after creating a new free project.

create extension if not exists pgcrypto;

do $$
begin
  create type public.document_type as enum ('invoice', 'quote');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.document_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  email text,
  phone text,
  abn text,
  address text,
  logo_url text,
  default_payment_methods text,
  default_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  abn text,
  billing_address text,
  shipping_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_user_id_updated_idx
on public.customers (user_id, updated_at desc);

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  email text,
  phone text,
  abn text,
  address text,
  logo_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_profiles_user_id_updated_idx
on public.company_profiles (user_id, updated_at desc);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.document_type not null,
  status public.document_status not null default 'draft',
  title text not null,
  number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  currency text not null default 'AUD',
  issue_date date not null default current_date,
  due_date date,
  valid_until date,
  gst_enabled boolean not null default true,
  gst_rate numeric(5, 2) not null default 10,
  company jsonb not null default '{}'::jsonb,
  bill_to jsonb not null default '{}'::jsonb,
  ship_to jsonb,
  line_items jsonb not null default '[]'::jsonb,
  order_discount jsonb not null default '{"type":"percent","value":0}'::jsonb,
  notes text,
  payment_methods text,
  logo_url text,
  totals jsonb not null default '{}'::jsonb,
  converted_from_quote_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_currency_aud check (currency = 'AUD'),
  constraint documents_number_alphanumeric check (number ~ '^[A-Za-z0-9]+$')
);

create index if not exists documents_user_id_updated_idx
on public.documents (user_id, updated_at desc);

create index if not exists documents_user_id_type_idx
on public.documents (user_id, type);

create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'free' check (plan in ('free', 'weekly', 'monthly')),
  status text not null default 'free',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null,
  week_start timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, document_id)
);

create index if not exists document_usage_user_week_idx
on public.document_usage (user_id, week_start desc);

create or replace function public.australian_week_start(moment timestamptz default now())
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('week', moment at time zone 'Australia/Sydney') at time zone 'Australia/Sydney';
$$;

create or replace function public.get_billing_status()
returns table (
  plan text,
  status text,
  current_period_end timestamptz,
  documents_used integer,
  documents_limit integer,
  week_starts_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when coalesce(account.status, 'free') in ('active', 'trialing') then account.plan else 'free' end,
    coalesce(account.status, 'free'),
    account.current_period_end,
    (
      select count(*)::integer
      from public.document_usage usage
      where usage.user_id = auth.uid()
        and usage.week_start = public.australian_week_start()
    ),
    case when coalesce(account.status, 'free') in ('active', 'trialing') then null else 5 end,
    public.australian_week_start()
  from (select auth.uid() as user_id) viewer
  left join public.billing_accounts account on account.user_id = viewer.user_id;
$$;

create or replace function public.enforce_free_document_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  week_start_value timestamptz := public.australian_week_start();
  usage_count integer;
  paid_access boolean;
begin
  select coalesce(status in ('active', 'trialing'), false)
  into paid_access
  from public.billing_accounts
  where user_id = new.user_id;

  if coalesce(paid_access, false) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || week_start_value::text, 0));

  select count(*)::integer
  into usage_count
  from public.document_usage
  where user_id = new.user_id
    and week_start = week_start_value;

  if usage_count >= 5 then
    raise exception 'FREE_WEEKLY_DOCUMENT_LIMIT_REACHED'
      using errcode = 'P0001';
  end if;

  insert into public.document_usage (user_id, document_id, week_start)
  values (new.user_id, new.id, week_start_value)
  on conflict (user_id, document_id) do nothing;

  return new;
end;
$$;

insert into public.billing_accounts (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.document_usage (user_id, document_id, week_start, created_at)
select user_id, id, public.australian_week_start(created_at), created_at
from public.documents
where created_at >= public.australian_week_start()
on conflict (user_id, document_id) do nothing;

drop trigger if exists documents_enforce_free_limit on public.documents;
create trigger documents_enforce_free_limit
before insert on public.documents
for each row execute function public.enforce_free_document_limit();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.billing_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists company_profiles_set_updated_at on public.company_profiles;
create trigger company_profiles_set_updated_at
before update on public.company_profiles
for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.company_profiles enable row level security;
alter table public.documents enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.document_usage enable row level security;

revoke all on public.billing_accounts from anon, authenticated;
revoke all on public.document_usage from anon, authenticated;
grant execute on function public.get_billing_status() to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can manage own customers" on public.customers;
create policy "Users can manage own customers"
on public.customers for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own company profiles" on public.company_profiles;
create policy "Users can manage own company profiles"
on public.company_profiles for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own documents" on public.documents;
create policy "Users can manage own documents"
on public.documents for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    customer_id is null
    or exists (
      select 1
      from public.customers c
      where c.id = customer_id
        and c.user_id = auth.uid()
    )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'papermint-logos',
  'papermint-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "PaperMint logos are public" on storage.objects;
create policy "PaperMint logos are public"
on storage.objects for select
using (bucket_id = 'papermint-logos');

drop policy if exists "Users upload own PaperMint logos" on storage.objects;
create policy "Users upload own PaperMint logos"
on storage.objects for insert
with check (
  bucket_id = 'papermint-logos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users update own PaperMint logos" on storage.objects;
create policy "Users update own PaperMint logos"
on storage.objects for update
using (
  bucket_id = 'papermint-logos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'papermint-logos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users delete own PaperMint logos" on storage.objects;
create policy "Users delete own PaperMint logos"
on storage.objects for delete
using (
  bucket_id = 'papermint-logos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
