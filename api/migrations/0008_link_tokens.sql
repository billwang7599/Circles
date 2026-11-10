-- The app opens someone's own answers page through a link of its own,
-- minted fresh each time it is asked for. It used to replace the token the
-- person's browser was given when they answered from the invite link, so
-- that browser then read as a stranger and could answer a second time. The
-- app's link now has its own column; the browser's token never changes.
alter table responses add column link_token_hash text unique;
