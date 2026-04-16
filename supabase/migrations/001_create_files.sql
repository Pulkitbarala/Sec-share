-- ================================================================
-- SecureShare Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ================================================================

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ── 1. Files table ─────────────────────────────────────────────
create table if not exists public.files (
  id                   uuid primary key default uuid_generate_v4(),
  code                 varchar(6) not null,
  name                 varchar(500) not null,
  size                 bigint not null default 0,
  storage_path         varchar(1000) not null,
  expiry_time          timestamptz not null,
  max_downloads        integer not null default 1,
  current_downloads    integer not null default 0,
  is_password_protected boolean not null default false,
  password_hash        text,
  user_id              uuid references auth.users(id) on delete cascade,
  created_at           timestamptz not null default now()
);

-- Unique index on code for fast lookups
create unique index if not exists files_code_idx on public.files (code);

-- Index on user_id for dashboard queries
create index if not exists files_user_idx on public.files (user_id);

-- Index on expiry_time for cleanup queries
create index if not exists files_expiry_idx on public.files (expiry_time);

-- ── 2. Row Level Security ───────────────────────────────────────
alter table public.files enable row level security;

-- Owners can see their own files
create policy "Users can view own files"
  on public.files for select
  using (auth.uid() = user_id);

-- Owners can insert files
create policy "Users can insert own files"
  on public.files for insert
  with check (auth.uid() = user_id);

-- Owners can delete their own files
create policy "Users can delete own files"
  on public.files for delete
  using (auth.uid() = user_id);

-- Public read for code lookup (download page — anyone with code can see metadata)
create policy "Public can lookup files by code"
  on public.files for select
  using (true);

-- ── 3. record_download RPC ─────────────────────────────────────
-- Atomically increments current_downloads and triggers cleanup if needed.
-- Returns the updated row or raises an error if limits are exceeded.
create or replace function public.record_download(file_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_max  integer;
  v_cur  integer;
  v_path text;
begin
  -- Lock the row to prevent race conditions
  select max_downloads, current_downloads, storage_path
  into v_max, v_cur, v_path
  from public.files
  where id = file_id
  for update;

  if not found then
    raise exception 'File not found';
  end if;

  if v_cur >= v_max then
    raise exception 'Download limit already reached';
  end if;

  -- Increment
  update public.files
  set current_downloads = current_downloads + 1
  where id = file_id;
end;
$$;

-- Grant execute to anon and authenticated roles
grant execute on function public.record_download(uuid) to anon, authenticated;

-- ── 4. cleanup_expired_files function ──────────────────────────
-- Called by the Edge Function on a schedule to delete expired/maxed files.
create or replace function public.cleanup_expired_files()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer := 0;
  rec record;
begin
  for rec in
    select id, storage_path
    from public.files
    where
      expiry_time < now()
      or current_downloads >= max_downloads
  loop
    -- Delete the row (storage cleanup handled by Edge Function)
    delete from public.files where id = rec.id;
    deleted_count := deleted_count + 1;
  end loop;

  return deleted_count;
end;
$$;

grant execute on function public.cleanup_expired_files() to service_role;
