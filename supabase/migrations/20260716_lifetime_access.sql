-- Permanent complimentary access for founder and managed test accounts.

alter table public.billing_accounts
  add column if not exists lifetime_access boolean not null default false;

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
    case
      when coalesce(account.lifetime_access, false) then 'lifetime'
      when coalesce(account.status, 'free') in ('active', 'trialing') then account.plan
      else 'free'
    end,
    case when coalesce(account.lifetime_access, false) then 'lifetime' else coalesce(account.status, 'free') end,
    case when coalesce(account.lifetime_access, false) then null else account.current_period_end end,
    (
      select count(*)::integer
      from public.document_usage usage
      where usage.user_id = auth.uid()
        and usage.week_start = public.australian_week_start()
    ),
    case
      when coalesce(account.lifetime_access, false)
        or coalesce(account.status, 'free') in ('active', 'trialing') then null
      else 5
    end,
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
  unlimited_access boolean;
begin
  select coalesce(lifetime_access or status in ('active', 'trialing'), false)
  into unlimited_access
  from public.billing_accounts
  where user_id = new.user_id;

  if coalesce(unlimited_access, false) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || week_start_value::text, 0));

  select count(*)::integer
  into usage_count
  from public.document_usage
  where user_id = new.user_id
    and week_start = week_start_value;

  if usage_count >= 5 then
    raise exception 'FREE_WEEKLY_DOCUMENT_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  insert into public.document_usage (user_id, document_id, week_start)
  values (new.user_id, new.id, week_start_value)
  on conflict (user_id, document_id) do nothing;

  return new;
end;
$$;
