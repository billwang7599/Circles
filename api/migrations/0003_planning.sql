create table options (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  place_id text not null,
  place jsonb not null,
  times jsonb not null,
  summary text not null check (char_length(summary) <= 200),
  unverified text[] not null default '{}' check (unverified <@ array['budget', 'openHours']),
  ranker text not null check (ranker in ('model', 'code')),
  created_at timestamptz not null default now(),
  unique (plan_id, rank),
  unique (id, plan_id)
);

create table votes (
  plan_id uuid not null references plans (id) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  option_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (plan_id, member_id),
  foreign key (option_id, plan_id) references options (id, plan_id) on delete cascade
);

alter table plans
  add column locked_option_id uuid references options (id),
  add column locked_start timestamptz,
  add column locked_end timestamptz,
  add column options_version integer,
  add constraint plans_locked_fields check (
    (status = 'locked') = (locked_option_id is not null)
    and (status = 'locked') = (locked_start is not null)
    and (status = 'locked') = (locked_end is not null)
  );

-- The default stays so an older API instance can still create accounts.
alter table accounts add column color text not null default 'blue'
  check (color in ('violet', 'blue', 'fern', 'ember', 'rose'));
update accounts
  set color = (array['violet', 'blue', 'fern', 'ember', 'rose'])[1 + floor(random() * 5)::int];
