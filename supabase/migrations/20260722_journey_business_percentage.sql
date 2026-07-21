-- Add partial business-use allocation to vehicle logbook journeys.
-- Existing Business journeys become 100%; existing Private journeys become 0%.

alter table public.vehicle_trips
  add column if not exists business_use_percent numeric(5, 2);

update public.vehicle_trips
set business_use_percent = case when is_business then 100 else 0 end
where business_use_percent is null;

alter table public.vehicle_trips
  alter column business_use_percent set default 100,
  alter column business_use_percent set not null;

do $$ begin
  alter table public.vehicle_trips add constraint vehicle_trips_business_use_percent_check
    check (business_use_percent >= 0 and business_use_percent <= 100);
exception when duplicate_object then null; end $$;
