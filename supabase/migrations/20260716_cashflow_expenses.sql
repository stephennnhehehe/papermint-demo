-- PaperMint cashflow, document delivery, expenses and BAS preparation migration.
-- Safe to run once in the Supabase SQL editor on an existing PaperMint project.

create extension if not exists pgcrypto;

alter table public.company_profiles
  add column if not exists gst_registered boolean not null default true,
  add column if not exists gst_accounting_basis text not null default 'cash',
  add column if not exists bas_frequency text not null default 'quarterly';

do $$
begin
  alter table public.company_profiles
    add constraint company_profiles_gst_basis_check
    check (gst_accounting_basis in ('cash', 'accrual'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.company_profiles
    add constraint company_profiles_bas_frequency_check
    check (bas_frequency in ('monthly', 'quarterly', 'annual'));
exception when duplicate_object then null;
end $$;

alter table public.documents
  add column if not exists company_profile_id uuid references public.company_profiles(id) on delete set null,
  add column if not exists sent_at timestamptz,
  add column if not exists first_viewed_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by text,
  add column if not exists converted_at timestamptz,
  add column if not exists paid_at timestamptz;

drop policy if exists "Users can manage own documents" on public.documents;
create policy "Users can manage own documents"
on public.documents for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    customer_id is null or exists (
      select 1 from public.customers customer
      where customer.id = customer_id and customer.user_id = auth.uid()
    )
  )
  and (
    company_profile_id is null or exists (
      select 1 from public.company_profiles company
      where company.id = company_profile_id and company.user_id = auth.uid()
    )
  )
);

create table if not exists public.document_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'sent', 'viewed', 'accepted', 'converted', 'paid', 'reminder_sent'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_events_user_created_idx
on public.document_events (user_id, created_at desc);

create index if not exists documents_user_company_idx
on public.documents (user_id, company_profile_id);

create index if not exists document_events_document_created_idx
on public.document_events (document_id, created_at desc);

create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  enabled boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, document_id)
);

create index if not exists document_shares_token_idx on public.document_shares (token);

create table if not exists public.reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  before_days integer[] not null default array[3],
  overdue_days integer[] not null default array[3, 7, 14],
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  reminder_key text not null,
  recipient text not null,
  provider_id text,
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  unique (document_id, reminder_key)
);

create table if not exists public.action_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,
  snoozed_until timestamptz,
  dismissed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, action_key)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_profile_id uuid references public.company_profiles(id) on delete set null,
  merchant text not null,
  expense_date date not null default current_date,
  category text not null default 'other',
  purchase_type text not null default 'non_capital' check (purchase_type in ('capital', 'non_capital')),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  gst_amount numeric(12, 2) not null default 0 check (gst_amount >= 0),
  gst_claimable boolean not null default true,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_user_date_idx
on public.expenses (user_id, expense_date desc);

create index if not exists expenses_user_company_idx
on public.expenses (user_id, company_profile_id);

create table if not exists public.expense_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

create index if not exists expense_receipts_expense_idx
on public.expense_receipts (expense_id, created_at desc);

create or replace function public.track_document_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.document_events (user_id, document_id, event_type)
    values (new.user_id, new.id, 'created');
    return new;
  end if;

  if old.sent_at is null and new.sent_at is not null then
    insert into public.document_events (user_id, document_id, event_type)
    values (new.user_id, new.id, 'sent');
  end if;
  if old.first_viewed_at is null and new.first_viewed_at is not null then
    insert into public.document_events (user_id, document_id, event_type)
    values (new.user_id, new.id, 'viewed');
  end if;
  if old.accepted_at is null and new.accepted_at is not null then
    insert into public.document_events (user_id, document_id, event_type, metadata)
    values (new.user_id, new.id, 'accepted', jsonb_build_object('accepted_by', new.accepted_by));
  end if;
  if old.converted_from_quote_id is null and new.converted_from_quote_id is not null then
    insert into public.document_events (user_id, document_id, event_type, metadata)
    values (new.user_id, new.id, 'converted', jsonb_build_object('quote_id', new.converted_from_quote_id));
    update public.documents set converted_at = coalesce(converted_at, now())
    where id = new.converted_from_quote_id and user_id = new.user_id;
  end if;
  if old.paid_at is null and new.paid_at is not null then
    insert into public.document_events (user_id, document_id, event_type)
    values (new.user_id, new.id, 'paid');
  end if;
  return new;
end;
$$;

drop trigger if exists documents_track_lifecycle on public.documents;
create trigger documents_track_lifecycle
after insert or update on public.documents
for each row execute function public.track_document_lifecycle();

drop trigger if exists document_shares_set_updated_at on public.document_shares;
create trigger document_shares_set_updated_at
before update on public.document_shares
for each row execute function public.set_updated_at();

drop trigger if exists reminder_settings_set_updated_at on public.reminder_settings;
create trigger reminder_settings_set_updated_at
before update on public.reminder_settings
for each row execute function public.set_updated_at();

drop trigger if exists action_states_set_updated_at on public.action_states;
create trigger action_states_set_updated_at
before update on public.action_states
for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.document_events enable row level security;
alter table public.document_shares enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.reminder_deliveries enable row level security;
alter table public.action_states enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_receipts enable row level security;

drop policy if exists "Users read own document events" on public.document_events;
create policy "Users read own document events" on public.document_events for select
using (auth.uid() = user_id);

drop policy if exists "Users manage own document shares" on public.document_shares;
create policy "Users manage own document shares" on public.document_shares for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own reminder settings" on public.reminder_settings;
create policy "Users manage own reminder settings" on public.reminder_settings for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users read own reminder deliveries" on public.reminder_deliveries;
create policy "Users read own reminder deliveries" on public.reminder_deliveries for select
using (auth.uid() = user_id);

drop policy if exists "Users manage own action states" on public.action_states;
create policy "Users manage own action states" on public.action_states for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own expenses" on public.expenses;
create policy "Users manage own expenses" on public.expenses for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id and (
    company_profile_id is null or exists (
      select 1 from public.company_profiles company
      where company.id = company_profile_id and company.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users manage own expense receipts" on public.expense_receipts;
create policy "Users manage own expense receipts" on public.expense_receipts for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id and exists (
    select 1 from public.expenses expense
    where expense.id = expense_id and expense.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'papermint-receipts',
  'papermint-receipts',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read own PaperMint receipts" on storage.objects;
create policy "Users read own PaperMint receipts" on storage.objects for select
using (bucket_id = 'papermint-receipts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users upload own PaperMint receipts" on storage.objects;
create policy "Users upload own PaperMint receipts" on storage.objects for insert
with check (bucket_id = 'papermint-receipts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users delete own PaperMint receipts" on storage.objects;
create policy "Users delete own PaperMint receipts" on storage.objects for delete
using (bucket_id = 'papermint-receipts' and auth.uid()::text = (storage.foldername(name))[1]);
