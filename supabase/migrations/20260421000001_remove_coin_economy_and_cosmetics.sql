-- Drop the coin + cosmetic schema. Those features were removed from the
-- product — Pro subscriptions + ads are the only monetization streams
-- now, so these columns and this table are dead weight on every row.
-- Safe to drop unconditionally: no remaining application code reads or
-- writes any of these (the corresponding helpers, providers, and UI
-- were deleted in the same commit).

alter table public.profiles drop column if exists coins;
alter table public.profiles drop column if exists owned_cosmetics;
alter table public.profiles drop column if exists equipped_cosmetics;

drop table if exists public.coin_transactions;
