-- One name per account, shared by all its circles. Accounts start from the
-- name they first joined with; their other circles catch up on the next rename.
alter table accounts
  add column display_name text
    check (char_length(display_name) between 1 and 40),
  add column defaults jsonb;

update accounts a set display_name = first.name
from (
  select distinct on (account_id) account_id, name
  from members order by account_id, joined_at
) first
where first.account_id = a.id;

alter table circles add column emoji text;

-- Names no longer have to differ: nobody can be stuck renaming or joining.
drop index members_unique_name;
