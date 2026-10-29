create table schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create table circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  join_code text not null unique check (join_code ~ '^[2-9A-HJ-NP-Z]{6}$'),
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  circle_id uuid not null references circles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  default_budget_cents integer,
  preferences text[] not null default '{}',
  joined_at timestamptz not null default now(),
  constraint members_one_per_account unique (account_id, circle_id)
);

create unique index members_unique_name on members (circle_id, lower(name));
