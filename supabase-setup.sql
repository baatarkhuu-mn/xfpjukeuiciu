-- ============================================================================
-- AilOS — Supabase бэлтгэл скрипт
-- Supabase Dashboard → SQL Editor → энэ файлыг бүхэлд нь хуулж RUN дарна.
-- ============================================================================

-- ── 1. Хүснэгтүүд ──────────────────────────────────────────────────────────

create table if not exists public.staff (
  id            text primary key,
  name          text not null,
  role          text default 'canvasser',
  phone         text,
  email         text,
  team          text,
  active        boolean default true,
  joined        date,
  target        int default 0,
  auth_uid      uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now()
);

create table if not exists public.programs (
  id            text primary key,
  name          text not null,
  type          text,
  year          int,
  description   text
);

create table if not exists public.households (
  id            text primary key,
  code          text,
  district      text,
  khoroo        int,
  street        text,
  building      text,
  apartment     text,
  address       text,
  lat           double precision,
  lng           double precision,
  head          text,
  family_size   int default 1,
  phone         text,
  housing       text,
  income        text,
  support       int default 0,
  party         text,
  programs      jsonb default '[]'::jsonb,
  last_contact  date,
  tags          jsonb default '[]'::jsonb,
  notes         text,
  assigned_to   text,
  verified      boolean default false,
  updated_at    date,
  created_at    timestamptz default now()
);

create table if not exists public.citizens (
  id            text primary key,
  household_id  text references public.households(id) on delete cascade,
  name          text,
  gender        text,
  birth_year    int,
  is_voter      boolean default true,
  relation      text,
  education     text,
  occupation    text,
  register      text,
  phone         text,
  support       int default 0,
  party         text,
  notes         text
);

create table if not exists public.interactions (
  id            text primary key,
  household_id  text references public.households(id) on delete cascade,
  date          date,
  type          text,
  staff_id      text,
  canvasser     text,
  result        text,
  note          text
);

create table if not exists public.issues (
  id            text primary key,
  household_id  text references public.households(id) on delete cascade,
  district      text,
  khoroo        int,
  category      text,
  title         text,
  priority      text,
  status        text,
  date          date,
  note          text
);

create table if not exists public.tasks (
  id            text primary key,
  title         text not null,
  status        text default 'Хүлээгдэж буй',
  priority      text default 'Дунд',
  tag           text,
  progress      int default 0,
  owner_id      text,
  due           date,
  created       date,
  comments      int default 0,
  note          text
);

-- ── 2. Индекс (хайлт хурдасгах) ────────────────────────────────────────────

create index if not exists idx_hh_district   on public.households (district, khoroo);
create index if not exists idx_hh_assigned   on public.households (assigned_to);
create index if not exists idx_hh_support    on public.households (support);
create index if not exists idx_cit_hh        on public.citizens (household_id);
create index if not exists idx_int_hh        on public.interactions (household_id);
create index if not exists idx_int_staff     on public.interactions (staff_id, date);
create index if not exists idx_iss_hh        on public.issues (household_id);
create index if not exists idx_iss_status    on public.issues (status);
create index if not exists idx_tasks_owner   on public.tasks (owner_id, status);

-- ── 3. RLS — зөвхөн нэвтэрсэн хэрэглэгч уншиж, бичнэ ───────────────────────
-- ЧУХАЛ: RLS-гүй бол anon key-тэй хэн ч датаг уншина. Заавал асаа.

alter table public.households   enable row level security;
alter table public.citizens     enable row level security;
alter table public.programs     enable row level security;
alter table public.interactions enable row level security;
alter table public.issues       enable row level security;
alter table public.staff        enable row level security;
alter table public.tasks        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['households','citizens','programs','interactions','issues','staff','tasks']
  loop
    execute format('drop policy if exists auth_read on public.%I', t);
    execute format('drop policy if exists auth_write on public.%I', t);
    -- Нэвтэрсэн бүх хэрэглэгч уншина
    execute format(
      'create policy auth_read on public.%I for select to authenticated using (true)', t);
    -- Нэвтэрсэн хэрэглэгч бичнэ (илүү нарийн эрх хэрэгтэй бол доорх 4-р хэсгийг үз)
    execute format(
      'create policy auth_write on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ── 4. (Сонголт) Эрхийн нарийвчилсан хяналт ────────────────────────────────
-- Зөвхөн admin/manager бичих эрхтэй болгохыг хүсвэл дээрх auth_write-ыг устгаад
-- доорхыг ажиллуулна. staff.auth_uid талбарт хэрэглэгчийн auth UID-г бичсэн байх ёстой.
--
-- create or replace function public.my_role() returns text
--   language sql stable security definer as $$
--     select coalesce((select role from public.staff where auth_uid = auth.uid() limit 1), 'viewer')
--   $$;
--
-- drop policy if exists auth_write on public.households;
-- create policy editor_write on public.households for all to authenticated
--   using (public.my_role() in ('admin','manager','canvasser'))
--   with check (public.my_role() in ('admin','manager','canvasser'));

-- ── 5. Хэрэглэгч үүсгэх ────────────────────────────────────────────────────
-- Supabase Dashboard → Authentication → Users → "Add user" дээрээс
-- и-мэйл/нууц үгээр багийнхаа гишүүдийг гараар нэмнэ.
-- Дараа нь staff хүснэгтийн auth_uid баганад тухайн хэрэглэгчийн UID-г бичнэ.
--
-- Жишээ:
-- update public.staff set auth_uid = '00000000-0000-0000-0000-000000000000'
--   where name = 'Б.Ундрах';

-- ── Дууслаа ────────────────────────────────────────────────────────────────
-- Дараа нь AilOS → Тохиргоо → Supabase холболт хэсэгт
-- Project URL болон Publishable (anon) key-г оруулаад «Холбох» → «↑ Хадгалах» дар.
