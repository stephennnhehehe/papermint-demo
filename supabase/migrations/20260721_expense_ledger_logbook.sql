-- PaperMint lightweight expense ledger, payment accounts and ATO-style vehicle logbook.
-- Run after 20260716_cashflow_expenses.sql.

create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_profile_id uuid references public.company_profiles(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in (
    'bank', 'credit_card', 'cash', 'director_loan', 'owner_contribution',
    'reimbursement_clearing', 'other'
  )),
  last_four text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_accounts_user_company_idx
on public.payment_accounts (user_id, company_profile_id, is_active);

alter table public.expenses
  add column if not exists payment_account_id uuid references public.payment_accounts(id) on delete set null,
  add column if not exists gst_treatment text not null default 'gst',
  add column if not exists business_use_percent numeric(5, 2) not null default 100,
  add column if not exists supplier_abn text,
  add column if not exists reference text,
  add column if not exists vehicle_id uuid;

do $$ begin
  alter table public.expenses add constraint expenses_gst_treatment_check
    check (gst_treatment in ('gst', 'gst_free', 'input_taxed', 'not_registered'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.expenses add constraint expenses_business_use_percent_check
    check (business_use_percent >= 0 and business_use_percent <= 100);
exception when duplicate_object then null; end $$;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_profile_id uuid references public.company_profiles(id) on delete cascade,
  name text not null,
  registration text not null,
  make text,
  model text,
  year integer check (year is null or (year >= 1900 and year <= 2200)),
  ownership_type text not null default 'business' check (ownership_type in ('business', 'personal', 'leased', 'director')),
  logbook_start_date date,
  logbook_end_date date,
  opening_odometer numeric(12, 1),
  closing_odometer numeric(12, 1),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, registration)
);

alter table public.expenses
  drop constraint if exists expenses_vehicle_id_fkey;
alter table public.expenses
  add constraint expenses_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) on delete set null;

create table if not exists public.vehicle_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_profile_id uuid references public.company_profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  origin text not null,
  destination text not null,
  purpose text not null,
  start_odometer numeric(12, 1) not null,
  end_odometer numeric(12, 1) not null,
  is_business boolean not null default true,
  driver text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_odometer >= start_odometer)
);

create index if not exists vehicles_user_company_idx
on public.vehicles (user_id, company_profile_id, is_active);
create index if not exists vehicle_trips_vehicle_date_idx
on public.vehicle_trips (vehicle_id, start_date desc);

drop trigger if exists payment_accounts_set_updated_at on public.payment_accounts;
create trigger payment_accounts_set_updated_at before update on public.payment_accounts
for each row execute function public.set_updated_at();
drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at before update on public.vehicles
for each row execute function public.set_updated_at();
drop trigger if exists vehicle_trips_set_updated_at on public.vehicle_trips;
create trigger vehicle_trips_set_updated_at before update on public.vehicle_trips
for each row execute function public.set_updated_at();

alter table public.payment_accounts enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_trips enable row level security;

drop policy if exists "Users manage own payment accounts" on public.payment_accounts;
create policy "Users manage own payment accounts" on public.payment_accounts for all
using (auth.uid() = user_id) with check (
  auth.uid() = user_id and (company_profile_id is null or exists (
    select 1 from public.company_profiles c where c.id = company_profile_id and c.user_id = auth.uid()
  ))
);

drop policy if exists "Users manage own vehicles" on public.vehicles;
create policy "Users manage own vehicles" on public.vehicles for all
using (auth.uid() = user_id) with check (
  auth.uid() = user_id and (company_profile_id is null or exists (
    select 1 from public.company_profiles c where c.id = company_profile_id and c.user_id = auth.uid()
  ))
);

drop policy if exists "Users manage own vehicle trips" on public.vehicle_trips;
create policy "Users manage own vehicle trips" on public.vehicle_trips for all
using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (
    select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = auth.uid()
  )
);
