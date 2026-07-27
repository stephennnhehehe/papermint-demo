alter table public.inventory_products
  add column if not exists deleted_at timestamptz;

create or replace function public.replace_inventory_movement(
  p_movement_id uuid,
  p_product_id uuid,
  p_movement_type text,
  p_quantity_delta numeric,
  p_unit_cost numeric default 0,
  p_movement_date date default current_date,
  p_reference text default null,
  p_notes text default null
) returns public.inventory_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.inventory_movements;
  v_row public.inventory_movements;
  v_product_id uuid;
  v_movement record;
  v_quantity numeric;
  v_next_quantity numeric;
  v_average numeric;
begin
  if p_quantity_delta = 0 or p_movement_type not in (
    'opening',
    'purchase',
    'customer_return',
    'supplier_return',
    'loss',
    'adjustment'
  ) then
    raise exception 'Invalid stock change';
  end if;

  select *
    into v_original
    from public.inventory_movements
   where id = p_movement_id
     and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'Stock change not found';
  end if;
  if v_original.source_type is not null and v_original.source_type <> 'manual' then
    raise exception 'Automatic stock changes cannot be edited';
  end if;
  if not exists (
    select 1
      from public.inventory_products
     where id = p_product_id
       and user_id = auth.uid()
       and deleted_at is null
  ) then
    raise exception 'Product not found';
  end if;

  update public.inventory_movements
     set product_id = p_product_id,
         movement_type = p_movement_type,
         quantity_delta = p_quantity_delta,
         unit_cost = greatest(0, p_unit_cost),
         movement_date = p_movement_date,
         reference = nullif(trim(coalesce(p_reference, '')), ''),
         notes = nullif(trim(coalesce(p_notes, '')), ''),
         source_type = 'manual',
         source_id = null
   where id = p_movement_id
   returning * into v_row;

  for v_product_id in
    select distinct affected_id
      from unnest(array[v_original.product_id, p_product_id]) as affected(affected_id)
  loop
    v_quantity := 0;
    v_average := 0;

    for v_movement in
      select quantity_delta, unit_cost
        from public.inventory_movements
       where product_id = v_product_id
       order by movement_date, created_at, id
    loop
      v_next_quantity := v_quantity + v_movement.quantity_delta;
      if v_movement.quantity_delta > 0
         and v_movement.unit_cost > 0
         and v_next_quantity > 0 then
        v_average :=
          ((v_quantity * v_average) +
           (v_movement.quantity_delta * v_movement.unit_cost)) /
          v_next_quantity;
      end if;
      v_quantity := v_next_quantity;
    end loop;

    update public.inventory_products
       set quantity_on_hand = v_quantity,
           average_cost = v_average,
           updated_at = now()
     where id = v_product_id
       and user_id = auth.uid();
  end loop;

  return v_row;
end;
$$;

create or replace function public.delete_inventory_product(
  p_product_id uuid
) returns public.inventory_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.inventory_products;
begin
  select *
    into v_product
    from public.inventory_products
   where id = p_product_id
     and user_id = auth.uid()
     and deleted_at is null
   for update;

  if not found then
    raise exception 'Product not found';
  end if;

  update public.inventory_products
     set sku = sku || '~DELETED~' || id::text,
         is_active = false,
         deleted_at = now(),
         updated_at = now()
   where id = p_product_id
   returning * into v_product;

  return v_product;
end;
$$;

revoke all on function public.replace_inventory_movement(
  uuid, uuid, text, numeric, numeric, date, text, text
) from public;
grant execute on function public.replace_inventory_movement(
  uuid, uuid, text, numeric, numeric, date, text, text
) to authenticated;

revoke all on function public.delete_inventory_product(uuid) from public;
grant execute on function public.delete_inventory_product(uuid) to authenticated;
