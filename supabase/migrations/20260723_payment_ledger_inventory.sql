create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  company_profile_id uuid references public.company_profiles(id) on delete set null, sku text not null, name text not null,
  description text, unit text not null default 'each', sale_price numeric(14,3) not null default 0,
  average_cost numeric(14,4) not null default 0, quantity_on_hand numeric(18,3) not null default 0,
  reorder_level numeric(18,3) not null default 0, gst_enabled boolean not null default true,
  track_inventory boolean not null default true, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, sku)
);
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  movement_type text not null check (movement_type in ('opening','purchase','sale','customer_return','supplier_return','loss','adjustment','reversal')),
  quantity_delta numeric(18,3) not null check (quantity_delta <> 0), unit_cost numeric(14,4) not null default 0,
  movement_date date not null default current_date, reference text, notes text, source_type text, source_id uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  payment_account_id uuid references public.payment_accounts(id) on delete set null,
  entry_type text not null check (entry_type in ('payment','reversal')), amount numeric(14,2) not null check (amount <> 0),
  payment_date date not null, reference text, notes text, reverses_payment_id uuid references public.invoice_payments(id) on delete restrict,
  created_at timestamptz not null default now(), unique(reverses_payment_id)
);
create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade, number text not null,
  issue_date date not null, description text not null, reason text not null, total numeric(14,2) not null check(total > 0),
  gst_amount numeric(14,2) not null default 0, status text not null default 'issued' check(status in ('issued','void')),
  inventory_product_id uuid references public.inventory_products(id) on delete set null, inventory_quantity numeric(18,3),
  created_at timestamptz not null default now(), unique(user_id, number)
);
create index if not exists inventory_movements_product_date_idx on public.inventory_movements(product_id, movement_date desc);
create index if not exists invoice_payments_document_idx on public.invoice_payments(document_id, payment_date desc);
create index if not exists credit_notes_document_idx on public.credit_notes(document_id, issue_date desc);

alter table public.inventory_products enable row level security; alter table public.inventory_movements enable row level security;
alter table public.invoice_payments enable row level security; alter table public.credit_notes enable row level security;
do $$ begin
  create policy "own inventory products" on public.inventory_products for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
  create policy "read own inventory movements" on public.inventory_movements for select using (auth.uid()=user_id);
  create policy "read own invoice payments" on public.invoice_payments for select using (auth.uid()=user_id);
  create policy "read own credit notes" on public.credit_notes for select using (auth.uid()=user_id);
exception when duplicate_object then null; end $$;

create or replace function public.refresh_invoice_settlement(p_document_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_total numeric; v_paid numeric; v_credits numeric; v_user uuid;
begin
  select user_id, coalesce((totals->>'total')::numeric,0) into v_user,v_total from documents where id=p_document_id;
  if v_user <> auth.uid() then raise exception 'Not authorised'; end if;
  select coalesce(sum(amount),0) into v_paid from invoice_payments where document_id=p_document_id;
  select coalesce(sum(total),0) into v_credits from credit_notes where document_id=p_document_id and status='issued';
  update documents set status=case when v_paid+v_credits >= v_total-.005 then 'paid' when status='paid' then 'sent' else status end,
    paid_at=case when v_paid+v_credits >= v_total-.005 then coalesce(paid_at,now()) else null end, updated_at=now() where id=p_document_id;
end $$;

create or replace function public.record_inventory_movement(p_product_id uuid,p_movement_type text,p_quantity_delta numeric,p_unit_cost numeric default 0,p_movement_date date default current_date,p_reference text default null,p_notes text default null,p_source_type text default null,p_source_id uuid default null) returns inventory_movements language plpgsql security definer set search_path=public as $$
declare v_product inventory_products; v_row inventory_movements; v_new_qty numeric; v_average numeric;
begin
  select * into v_product from inventory_products where id=p_product_id and user_id=auth.uid() for update; if not found then raise exception 'Product not found'; end if;
  v_new_qty:=v_product.quantity_on_hand+p_quantity_delta; v_average:=v_product.average_cost;
  if p_quantity_delta>0 and p_unit_cost>0 and v_new_qty>0 then v_average:=((v_product.quantity_on_hand*v_product.average_cost)+(p_quantity_delta*p_unit_cost))/v_new_qty; end if;
  update inventory_products set quantity_on_hand=v_new_qty,average_cost=v_average,updated_at=now() where id=p_product_id;
  insert into inventory_movements(user_id,product_id,movement_type,quantity_delta,unit_cost,movement_date,reference,notes,source_type,source_id)
  values(auth.uid(),p_product_id,p_movement_type,p_quantity_delta,greatest(0,p_unit_cost),p_movement_date,p_reference,p_notes,p_source_type,p_source_id) returning * into v_row; return v_row;
end $$;

create or replace function public.record_invoice_payment(p_document_id uuid,p_amount numeric,p_payment_date date,p_payment_account_id uuid default null,p_reference text default null,p_notes text default null) returns invoice_payments language plpgsql security definer set search_path=public as $$
declare v_row invoice_payments;
begin
  if p_amount<=0 or not exists(select 1 from documents where id=p_document_id and user_id=auth.uid() and type='invoice') then raise exception 'Invalid invoice payment'; end if;
  insert into invoice_payments(user_id,document_id,payment_account_id,entry_type,amount,payment_date,reference,notes) values(auth.uid(),p_document_id,p_payment_account_id,'payment',p_amount,p_payment_date,p_reference,p_notes) returning * into v_row;
  perform refresh_invoice_settlement(p_document_id); return v_row;
end $$;
create or replace function public.reverse_invoice_payment(p_payment_id uuid,p_notes text default null) returns invoice_payments language plpgsql security definer set search_path=public as $$
declare v_original invoice_payments; v_row invoice_payments;
begin
 select * into v_original from invoice_payments where id=p_payment_id and user_id=auth.uid() and entry_type='payment'; if not found then raise exception 'Payment not found'; end if;
 insert into invoice_payments(user_id,document_id,payment_account_id,entry_type,amount,payment_date,reference,notes,reverses_payment_id) values(auth.uid(),v_original.document_id,v_original.payment_account_id,'reversal',-v_original.amount,current_date,v_original.reference,coalesce(p_notes,'Payment reversal'),v_original.id) returning * into v_row;
 perform refresh_invoice_settlement(v_original.document_id); return v_row;
end $$;

create or replace function public.replace_invoice_payment(
  p_payment_id uuid,p_amount numeric,p_payment_date date,p_payment_account_id uuid default null,p_reference text default null,p_notes text default null
) returns invoice_payments language plpgsql security definer set search_path=public as $$
declare v_original invoice_payments; v_row invoice_payments;
begin
  select * into v_original from invoice_payments where id=p_payment_id and user_id=auth.uid() and entry_type='payment';
  if not found then raise exception 'Payment not found'; end if;
  perform reverse_invoice_payment(p_payment_id,'Reversed because the payment record was edited.');
  select * into v_row from record_invoice_payment(v_original.document_id,p_amount,p_payment_date,p_payment_account_id,p_reference,p_notes);
  return v_row;
end $$;

create or replace function public.issue_credit_note(p_document_id uuid,p_issue_date date,p_description text,p_reason text,p_total numeric,p_gst_amount numeric default 0,p_inventory_product_id uuid default null,p_inventory_quantity numeric default null) returns credit_notes language plpgsql security definer set search_path=public as $$
declare v_number text; v_row credit_notes;
begin
 if p_total<=0 or trim(coalesce(p_reason,''))='' or not exists(select 1 from documents where id=p_document_id and user_id=auth.uid() and type='invoice') then raise exception 'Invalid credit note'; end if;
 v_number:='CN'||to_char(current_date,'YYYY')||lpad((select (count(*)+1)::text from credit_notes where user_id=auth.uid()),5,'0');
 insert into credit_notes(user_id,document_id,number,issue_date,description,reason,total,gst_amount,inventory_product_id,inventory_quantity) values(auth.uid(),p_document_id,v_number,p_issue_date,p_description,p_reason,p_total,greatest(0,p_gst_amount),p_inventory_product_id,p_inventory_quantity) returning * into v_row;
 if p_inventory_product_id is not null and p_inventory_quantity>0 then perform record_inventory_movement(p_inventory_product_id,'customer_return',p_inventory_quantity,0,p_issue_date,v_number,p_reason,'credit_note',v_row.id); end if;
 perform refresh_invoice_settlement(p_document_id); return v_row;
end $$;

create or replace function public.void_credit_note(p_credit_note_id uuid) returns credit_notes language plpgsql security definer set search_path=public as $$
declare v_note credit_notes; v_existing numeric;
begin
  select * into v_note from credit_notes where id=p_credit_note_id and user_id=auth.uid() and status='issued' for update;
  if not found then raise exception 'Credit note not found or already voided'; end if;
  update credit_notes set status='void' where id=p_credit_note_id returning * into v_note;
  if v_note.inventory_product_id is not null and coalesce(v_note.inventory_quantity,0)>0 then
    select coalesce(sum(quantity_delta),0) into v_existing from inventory_movements where source_type in ('credit_note','credit_note_void') and source_id=p_credit_note_id;
    if abs(v_existing)>=.0005 then
      perform record_inventory_movement(v_note.inventory_product_id,'reversal',-v_existing,0,current_date,v_note.number,'Credit note voided','credit_note_void',v_note.id);
    end if;
  end if;
  perform refresh_invoice_settlement(v_note.document_id);
  return v_note;
end $$;

create or replace function public.replace_credit_note(
  p_credit_note_id uuid,p_issue_date date,p_description text,p_reason text,p_total numeric,p_gst_amount numeric default 0,
  p_inventory_product_id uuid default null,p_inventory_quantity numeric default null
) returns credit_notes language plpgsql security definer set search_path=public as $$
declare v_original credit_notes; v_row credit_notes;
begin
  select * into v_original from credit_notes where id=p_credit_note_id and user_id=auth.uid() and status='issued';
  if not found then raise exception 'Credit note not found'; end if;
  perform void_credit_note(p_credit_note_id);
  select * into v_row from issue_credit_note(v_original.document_id,p_issue_date,p_description,p_reason,p_total,p_gst_amount,p_inventory_product_id,p_inventory_quantity);
  return v_row;
end $$;

create or replace function public.sync_document_inventory(p_document_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_doc documents; v_item record; v_product uuid; v_desired numeric; v_existing numeric; v_diff numeric;
begin
 select * into v_doc from documents where id=p_document_id and user_id=auth.uid(); if not found or v_doc.type<>'invoice' then return; end if;
 for v_item in
  with wanted as (select item->>'productId' product_id, sum(greatest(0,coalesce((item->>'quantity')::numeric,0))) quantity from jsonb_array_elements(v_doc.line_items) item where coalesce(item->>'productId','')<>'' group by item->>'productId'),
  known as (select product_id::text product_id from inventory_movements where source_type='document' and source_id=p_document_id group by product_id)
  select wanted.product_id,wanted.quantity from wanted union all select known.product_id,0 from known where not exists(select 1 from wanted where wanted.product_id=known.product_id)
 loop
  v_product:=v_item.product_id::uuid;
  v_desired:=case when v_doc.status in ('sent','paid','overdue') then -v_item.quantity else 0 end;
  select coalesce(sum(quantity_delta),0) into v_existing from inventory_movements where product_id=v_product and source_type='document' and source_id=p_document_id; v_diff:=v_desired-v_existing;
  if abs(v_diff)>=.0005 then perform record_inventory_movement(v_product,case when v_diff<0 then 'sale' else 'reversal' end,v_diff,0,v_doc.issue_date,v_doc.number,'Automatically synced from invoice','document',p_document_id); end if;
 end loop;
end $$;
