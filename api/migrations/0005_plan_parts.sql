-- The parts of each day a plan can happen in; existing plans keep the whole day.
alter table plans
  add column parts text[] not null default '{morning,afternoon,evening}',
  add constraint plans_parts check (
    cardinality(parts) > 0
    and parts <@ array['morning', 'afternoon', 'evening']
  );
