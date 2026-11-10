-- Circles, plans, options and votes give way to events: an organizer
-- describes one, invitees answer its questions from a link, and itineraries
-- are made from the answers. The old tables go; their rows were test data.

drop table votes, options, registrations, plans, members, circles cascade;

alter table accounts drop column defaults;

create table events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references accounts (id) on delete cascade,
  -- The public name in the invite link, /i/<slug>.
  slug text not null unique,
  title text not null check (char_length(title) between 1 and 60),
  description text not null check (char_length(description) between 1 and 300),
  window_start date not null,
  window_end date not null,
  -- What invitees are asked, in order: the shared Questions shape.
  questions jsonb not null,
  -- Goes up when the questions or anyone's response changes.
  version integer not null default 1,
  -- The version the itineraries were made from; they are stale once it lags.
  itineraries_version integer,
  created_at timestamptz not null default now(),
  check (window_end >= window_start and window_end <= window_start + 89)
);

create index events_organizer_id on events (organizer_id);

-- One person's reply to an event. The organizer has one from the start. An
-- invitee's is reached with a token kept only as a hash; an account can
-- claim it, and has at most one per event.
create table responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  token_hash text unique,
  account_id uuid references accounts (id) on delete set null,
  name text not null check (char_length(name) between 1 and 40),
  attending boolean not null,
  -- Answers by question id, null until they have answered. A budget in here
  -- is private to this person.
  answers jsonb,
  created_at timestamptz not null default now(),
  unique (event_id, account_id)
);

create table itineraries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  rank integer not null check (rank between 1 and 3),
  -- The shared Itinerary shape without id and rank.
  body jsonb not null,
  unique (event_id, rank)
);
