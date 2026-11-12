-- What a map said about a venue name in an area, so that remaking an
-- event's options, or running the same plan again, asks the map once a
-- month per venue rather than once per option. Rows belong to the lookup
-- that answered, so the fake's answers never serve the real map. Keys are
-- the names as code compares them: lower case, no accents, letters and
-- digits only.
create table venue_lookups (
  source text not null,
  area text not null,
  name text not null,
  venues jsonb not null,
  checked_at timestamptz not null default now(),
  primary key (source, area, name)
);
