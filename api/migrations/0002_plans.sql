create table plans (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  initiator_id uuid not null references members (id),
  title text not null check (char_length(title) between 1 and 80),
  area_id text not null,
  window_start date not null,
  window_end date not null check (window_end between window_start and window_start + 14),
  status text not null default 'open' check (status in ('open', 'locked')),
  version integer not null default 1,
  created_at timestamptz not null default now()
);

create index plans_circle on plans (circle_id);

create table registrations (
  plan_id uuid not null references plans (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  attending boolean not null default true,
  budget_cents integer check (budget_cents between 100 and 100000),
  busy jsonb not null default '[]',
  preferences text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (plan_id, member_id),
  check (not attending or budget_cents is not null)
);
