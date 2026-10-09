-- 2.8 off-switches (FRIDAY-QUEUE item 38). Rows in app_flags that the 2.8 features read with the
-- FAIL-OPEN resolver (core feature-switches.ts / FlagsService.isLive): enabled=true + audience 'all'
-- = on; flip enabled=false in admin > Ops > Feature flags to turn a feature off in minutes.
-- Idempotent (never overwrites a row the founder already changed).
insert into public.app_flags (key, enabled, audience, note) values
  ('live_play', true, 'all', '2.8 off-switch: live pocket-game play (realtime + presence)'),
  ('branded_invites', true, 'all', '2.8 off-switch: branded one-link invites + preview images'),
  ('mascot_voices', true, 'all', '2.8 off-switch: mascot voices + moods'),
  ('speech_bubbles', true, 'all', '2.8 off-switch: Home notifications as cast speech bubbles'),
  ('living_mascot', true, 'all', '2.8 off-switch: living (rigged) mascots'),
  ('living_wallpapers', true, 'all', '2.8 off-switch: ambient wallpaper motion'),
  ('rich_push', true, 'all', '2.8 off-switch: new push formats'),
  ('age_check', true, 'all', '2.8 off-switch: 13+ age check'),
  ('season_halloween', true, 'all', '2.8 off-switch: Halloween season (off = normal look)'),
  ('opening_animation_season', true, 'all', '2.8 off-switch: seasonal opening animation'),
  ('musical_cast', true, 'all', '2.8 off-switch: musical cast easter egg + seasonal tunes'),
  ('first_play_tutorials', true, 'all', '2.8 off-switch: first-play tutorials'),
  ('whats_new_28', true, 'all', '2.8 off-switch: What''s new in 2.8 tour'),
  ('custom_game_order', true, 'all', '2.8 off-switch: reorderable game lists'),
  ('pro_try_on', true, 'all', '2.8 off-switch: Pro try-on + unlock popup')
on conflict (key) do nothing;
