-- Snake & Ladder Knowledge Battle V1.5 • MIGRASI TAMBAHAN dari V1.4
-- JALANKAN HANYA SETELAH 001_cloud_bank_v14.sql.
-- Jangan menjalankan ulang SQL V1.4 yang lama setelah migrasi ini; kebijakan lama akan membuka kembali soal bersama.
-- Tidak menghapus akun, soal, atau status admin sebelumnya.

begin;

-- Lisensi melekat pada akun Supabase Auth, bukan localStorage atau tombol web.
create table if not exists public.slkb_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  product_code text not null default 'PAI_ALL' check (product_code = 'PAI_ALL'),
  status text not null default 'active' check (status in ('active','suspended')),
  order_reference text,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists slkb_entitlements_status_idx on public.slkb_entitlements(status);
alter table public.slkb_entitlements enable row level security;
revoke all on public.slkb_entitlements from anon, authenticated;
grant select on public.slkb_entitlements to authenticated;
drop policy if exists slkb_entitlements_self_admin on public.slkb_entitlements;
create policy slkb_entitlements_self_admin on public.slkb_entitlements
  for select to authenticated using (user_id = (select auth.uid()) or (select public.slkb_is_admin()));

create or replace function public.slkb_is_premium()
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.slkb_entitlements
  where user_id = (select auth.uid()) and status = 'active' and product_code = 'PAI_ALL');
$$;
revoke all on function public.slkb_is_premium() from public, anon;
grant execute on function public.slkb_is_premium() to authenticated;

-- Ubah akses bersama dari "semua yang login" menjadi hanya admin/premium.
drop policy if exists slkb_questions_read on public.slkb_questions;
create policy slkb_questions_read on public.slkb_questions
for select to authenticated using (
 owner_id = (select auth.uid())
 or (select public.slkb_is_admin())
 or (status = 'approved' and (select public.slkb_is_premium()))
);

-- Hanya akun premium (atau admin) boleh menulis/mengubah/menghapus Bank Pribadi Cloud.
drop policy if exists slkb_questions_insert_own on public.slkb_questions;
create policy slkb_questions_insert_own on public.slkb_questions
for insert to authenticated with check (
 owner_id=(select auth.uid()) and status='private' and reviewed_by is null and reviewed_at is null
 and ((select public.slkb_is_premium()) or (select public.slkb_is_admin()))
);
drop policy if exists slkb_questions_edit_own on public.slkb_questions;
create policy slkb_questions_edit_own on public.slkb_questions
for update to authenticated using (
 owner_id=(select auth.uid()) and status in ('private','rejected')
 and ((select public.slkb_is_premium()) or (select public.slkb_is_admin()))
) with check (
 owner_id=(select auth.uid()) and status in ('private','rejected')
 and ((select public.slkb_is_premium()) or (select public.slkb_is_admin()))
);
drop policy if exists slkb_questions_delete_own on public.slkb_questions;
create policy slkb_questions_delete_own on public.slkb_questions
for delete to authenticated using (
 owner_id=(select auth.uid()) and status in ('private','rejected')
 and ((select public.slkb_is_premium()) or (select public.slkb_is_admin()))
);

-- Izinkan soal 3 atau 4 opsi: yang lama tidak dihapus. Soal baru kelas 1-3 WAJIB A-C.
alter table public.slkb_questions drop constraint if exists slkb_questions_choices_check;
alter table public.slkb_questions drop constraint if exists slkb_choices_v15;
alter table public.slkb_questions add constraint slkb_choices_v15
 check (jsonb_typeof(choices)='array' and jsonb_array_length(choices) in (3,4)
 and answer>=0 and answer<jsonb_array_length(choices));
create or replace function public.slkb_validate_low_grade_options()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.level='SD' and new.grade between 1 and 3 and jsonb_array_length(new.choices)<>3 then
   raise exception 'SD kelas 1-3 wajib memiliki tepat 3 pilihan A-C';
 end if;
 return new;
end; $$;
drop trigger if exists slkb_enforce_abc on public.slkb_questions;
create trigger slkb_enforce_abc before insert or update of level,grade,choices,answer
on public.slkb_questions for each row execute function public.slkb_validate_low_grade_options();

-- Bank premium dipisahkan dari soal pribadi dan tidak disertakan dalam berkas website.
create table if not exists public.slkb_master_questions (
 id text primary key check (length(id) between 5 and 100),
 level text not null check (level in ('SD','SMP','SMA')),
 grade integer not null check (grade between 1 and 12),
 subject text not null check (length(trim(subject)) between 1 and 60),
 topic text not null check (length(trim(topic)) between 1 and 100),
 question text not null check (length(trim(question)) between 5 and 600),
 choices jsonb not null check (jsonb_typeof(choices)='array' and jsonb_array_length(choices) in (3,4)),
 answer integer not null check (answer between 0 and 3),
 explanation text not null default '' check (length(explanation)<=400),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint slkb_master_grade_options check (
   ((level='SD' and grade between 1 and 3) and jsonb_array_length(choices)=3)
   or ((level='SD' and grade between 4 and 6) or (level='SMP' and grade between 7 and 9) or (level='SMA' and grade between 10 and 12)) and jsonb_array_length(choices)=4
 ),
 constraint slkb_master_answer_range check (answer < jsonb_array_length(choices))
);
create index if not exists slkb_master_filter_idx on public.slkb_master_questions(level,grade,subject,topic);
alter table public.slkb_master_questions enable row level security;
revoke all on public.slkb_master_questions from anon, authenticated;
grant select,insert,update,delete on public.slkb_master_questions to authenticated;
drop policy if exists slkb_master_read_premium on public.slkb_master_questions;
create policy slkb_master_read_premium on public.slkb_master_questions
 for select to authenticated using ((select public.slkb_is_admin()) or (select public.slkb_is_premium()));
drop policy if exists slkb_master_insert_admin on public.slkb_master_questions;
create policy slkb_master_insert_admin on public.slkb_master_questions
 for insert to authenticated with check ((select public.slkb_is_admin()));
drop policy if exists slkb_master_update_admin on public.slkb_master_questions;
create policy slkb_master_update_admin on public.slkb_master_questions
 for update to authenticated using ((select public.slkb_is_admin())) with check ((select public.slkb_is_admin()));
drop policy if exists slkb_master_delete_admin on public.slkb_master_questions;
create policy slkb_master_delete_admin on public.slkb_master_questions
 for delete to authenticated using ((select public.slkb_is_admin()));

-- Permintaan aktivasi setelah pembayaran Lynk.id (diverifikasi di dashboard Lynk secara manual).
create table if not exists public.slkb_activation_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 order_reference text not null check (length(trim(order_reference)) between 4 and 100),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(order_reference)
);
create index if not exists slkb_activation_review_idx on public.slkb_activation_requests(status,created_at desc);
create index if not exists slkb_activation_owner_idx on public.slkb_activation_requests(user_id);
alter table public.slkb_activation_requests enable row level security;
revoke all on public.slkb_activation_requests from anon,authenticated;
grant select on public.slkb_activation_requests to authenticated;
drop policy if exists slkb_activation_select on public.slkb_activation_requests;
create policy slkb_activation_select on public.slkb_activation_requests
 for select to authenticated using (user_id=(select auth.uid()) or (select public.slkb_is_admin()));

create or replace function public.slkb_request_activation(p_order_reference text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_ref text := trim(coalesce(p_order_reference,''));
begin
 if (select auth.uid()) is null then raise exception 'Login terlebih dahulu'; end if;
 if length(v_ref)<4 or length(v_ref)>100 then raise exception 'Masukkan nomor transaksi Lynk.id yang valid'; end if;
 if exists(select 1 from public.slkb_activation_requests where user_id=(select auth.uid()) and status='pending')
 then raise exception 'Masih ada pengajuan menunggu verifikasi'; end if;
 insert into public.slkb_activation_requests(user_id,order_reference)
 values((select auth.uid()),v_ref) returning id into v_id;
 return v_id;
end; $$;

create or replace function public.slkb_review_activation(p_request_id uuid,p_decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid; v_ref text;
begin
 if not (select public.slkb_is_admin()) then raise exception 'Hanya admin'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Keputusan tidak valid'; end if;
 update public.slkb_activation_requests
 set status=p_decision, reviewed_by=(select auth.uid()),reviewed_at=now()
 where id=p_request_id and status='pending'
 returning user_id,order_reference into v_user_id,v_ref;
 if v_user_id is null then raise exception 'Permintaan tidak ditemukan atau sudah diproses'; end if;
 if p_decision='approved' then
   insert into public.slkb_entitlements(user_id,product_code,status,order_reference,activated_by)
   values(v_user_id,'PAI_ALL','active',v_ref,(select auth.uid()))
   on conflict (user_id) do update set status='active', order_reference=excluded.order_reference,
      activated_by=excluded.activated_by, activated_at=now(),updated_at=now();
 end if;
end; $$;
revoke all on function public.slkb_request_activation(text) from public,anon;
revoke all on function public.slkb_review_activation(uuid,text) from public,anon;
grant execute on function public.slkb_request_activation(text) to authenticated;
grant execute on function public.slkb_review_activation(uuid,text) to authenticated;

commit;
-- PENTING: PENGUJIAN ROLE admin, free, dan premium pada Supabase asli diperlukan sebelum publikasi.
-- Jangan memasukkan SERVICE ROLE KEY dalam browser. Jangan memasukkan 100 soal premium ke file demo.
