-- Accounts were anonymous device tokens holding test data; sign-in starts afresh.
truncate accounts, circles cascade;

alter table accounts
  drop column token_hash,
  add column sub text not null unique,
  add column email text not null;
