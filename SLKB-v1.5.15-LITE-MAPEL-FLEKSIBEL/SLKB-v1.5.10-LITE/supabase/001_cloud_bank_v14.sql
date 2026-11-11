-- PERHATIAN: untuk proyek yang sudah menjalankan V1.5, JANGAN rerun file V1.4 ini. Gunakan 002 saja.
-- SNAKE & LADDER KNOWLEDGE BATTLE V1.4 — Model C
-- Jalankan sekali melalui Supabase SQL Editor dengan akun pemilik proyek.
-- Login/registrasi guru: Supabase Auth. Admin hanya dipromosikan lewat SQL Editor.

create table if not exists public.slkb_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.slkb_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('SD', 'SMP', 'SMA')),
  grade integer not null check (
    (level = 'SD' and grade between 1 and 6) or
    (level = 'SMP' and grade between 7 and 9) or
    (level = 'SMA' and grade between 10 and 12)
  ),
  subject text not null check (length(trim(subject)) between 1 and 60),
  topic text not null default 'Umum' check (length(trim(topic)) between 1 and 60),
  question text not null check (length(trim(question)) between 5 and 600),
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4),
  answer integer not null check (answer between 0 and 3),
  explanation text not null default '' check (length(explanation) <= 400),
  status text not null default 'private' check (status in ('private', 'pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists slkb_questions_status_idx on public.slkb_questions (status, level, grade, subject);
create index if not exists slkb_questions_owner_idx on public.slkb_questions (owner_id, updated_at desc);

create or replace function public.slkb_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.slkb_user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.slkb_touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists slkb_questions_touch on public.slkb_questions;
create trigger slkb_questions_touch before update on public.slkb_questions
for each row execute function public.slkb_touch_updated_at();

alter table public.slkb_user_roles enable row level security;
alter table public.slkb_questions enable row level security;
-- Prinsip minimum akses. Tidak ada akses anonim ke data pribadi guru.
revoke all on public.slkb_user_roles from anon, authenticated;
revoke all on public.slkb_questions from anon, authenticated;
grant select on public.slkb_user_roles to authenticated;
grant select, delete on public.slkb_questions to authenticated;
-- Pengguna hanya dapat menulis kolom soal; status/owner/hasil ulasan bukan kolom UPDATE.
grant insert (owner_id, level, grade, subject, topic, question, choices, answer, explanation)
  on public.slkb_questions to authenticated;
grant update (level, grade, subject, topic, question, choices, answer, explanation)
  on public.slkb_questions to authenticated;

-- Kebijakan baca role: diri sendiri saja. Tidak ada INSERT/UPDATE/DELETE dari browser.
drop policy if exists slkb_roles_read_self on public.slkb_user_roles;
create policy slkb_roles_read_self on public.slkb_user_roles
for select to authenticated using (user_id = (select auth.uid()));

-- Pembaca: soal sendiri, soal approved, atau admin yang mereview antrean.
drop policy if exists slkb_questions_read on public.slkb_questions;
create policy slkb_questions_read on public.slkb_questions
for select to authenticated
using (owner_id = (select auth.uid()) or status = 'approved' or (status = 'pending' and (select public.slkb_is_admin())));

-- Sisipan hanya atas nama sendiri, dengan status otomatis PRIVATE.
drop policy if exists slkb_questions_insert_own on public.slkb_questions;
create policy slkb_questions_insert_own on public.slkb_questions
for insert to authenticated with check (
  owner_id = (select auth.uid()) and status = 'private'
  and reviewed_by is null and reviewed_at is null
);

-- Guru hanya boleh mengubah isinya ketika belum diajukan / ditolak.
drop policy if exists slkb_questions_edit_own on public.slkb_questions;
create policy slkb_questions_edit_own on public.slkb_questions
for update to authenticated
using (owner_id = (select auth.uid()) and status in ('private','rejected'))
with check (owner_id = (select auth.uid()) and status in ('private','rejected'));

drop policy if exists slkb_questions_delete_own on public.slkb_questions;
create policy slkb_questions_delete_own on public.slkb_questions
for delete to authenticated
using (owner_id = (select auth.uid()) and status in ('private','rejected'));

-- Status tidak bisa diubah dengan API update biasa; harus lewat RPC terkontrol.
create or replace function public.slkb_submit_question(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Harus login'; end if;
  update public.slkb_questions
  set status = 'pending', reviewed_at = null, reviewed_by = null
  where id = p_id and owner_id = (select auth.uid()) and status in ('private','rejected');
  if not found then raise exception 'Soal tidak tersedia untuk pengajuan'; end if;
end; $$;

create or replace function public.slkb_review_question(p_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.slkb_is_admin()) then raise exception 'Hanya admin'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Keputusan tidak valid'; end if;
  update public.slkb_questions
  set status = p_decision, reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = p_id and status = 'pending';
  if not found then raise exception 'Soal tidak ada atau sudah ditinjau'; end if;
end; $$;

revoke all on function public.slkb_is_admin() from public, anon;
revoke all on function public.slkb_submit_question(uuid) from public, anon;
revoke all on function public.slkb_review_question(uuid, text) from public, anon;
grant execute on function public.slkb_is_admin() to authenticated;
grant execute on function public.slkb_submit_question(uuid) to authenticated;
grant execute on function public.slkb_review_question(uuid, text) to authenticated;

-- JANGAN memasukkan service_role key di HTML/JS, dan jangan memberikan privilege
-- update role kepada authenticated. Buat akun admin melalui Supabase Auth dulu,
-- lalu jalankan contoh perintah admin dalam PANDUAN-SUPABASE-V1.4.md.
