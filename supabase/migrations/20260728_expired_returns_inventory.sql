-- Returned/expired goods shown as negative invoice lines are financial credits.
-- They must not be treated as another sale and deducted from sellable stock again.
create or replace function public.sync_document_inventory(p_document_id uuid) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_doc documents;
  v_item record;
  v_product uuid;
  v_desired numeric;
  v_existing numeric;
  v_diff numeric;
begin
  select * into v_doc
  from documents
  where id=p_document_id and user_id=auth.uid();

  if not found or v_doc.type<>'invoice' then return; end if;

  for v_item in
    with wanted as (
      select
        item->>'productId' product_id,
        sum(
          case
            when coalesce(item->>'itemType', case when coalesce((item->>'unitPrice')::numeric,0)<0 then 'return' else 'sale' end) <> 'return'
              and coalesce((item->>'unitPrice')::numeric,0) >= 0
            then greatest(0,coalesce((item->>'quantity')::numeric,0))
            else 0
          end
        ) quantity
      from jsonb_array_elements(v_doc.line_items) item
      where coalesce(item->>'productId','')<>''
      group by item->>'productId'
    ),
    known as (
      select product_id::text product_id
      from inventory_movements
      where source_type='document' and source_id=p_document_id
      group by product_id
    )
    select wanted.product_id,wanted.quantity from wanted
    union all
    select known.product_id,0 from known
    where not exists(select 1 from wanted where wanted.product_id=known.product_id)
  loop
    v_product:=v_item.product_id::uuid;
    v_desired:=case when v_doc.status in ('sent','paid','overdue') then -v_item.quantity else 0 end;
    select coalesce(sum(quantity_delta),0) into v_existing
    from inventory_movements
    where product_id=v_product and source_type='document' and source_id=p_document_id;
    v_diff:=v_desired-v_existing;

    if abs(v_diff)>=.0005 then
      perform record_inventory_movement(
        v_product,
        case when v_diff<0 then 'sale' else 'reversal' end,
        v_diff,
        0,
        v_doc.issue_date,
        v_doc.number,
        'Automatically synced from invoice',
        'document',
        p_document_id
      );
    end if;
  end loop;
end
$$;
