-- Art Library: final vs working art (founder polish 10-05).
-- APPLIED: 2026-10-05 10:56 CT to production (backup 20261005T155606Z). Read back: column + check constraint present.
--
-- stage = 'final' (the art itself) or 'working' (what it is made from: rig layers and parts, raw ChatGPT captures,
-- keyed / chroma-background copies, costume pieces, cut mascot parts and fit renders, explorations, option boards,
-- mockups, retired art). Set by the art repo (tools/classify-stage.py + build-manifest.mjs) and synced by sync.mjs.
-- admin > Art Library shows final only until "Show working files" is switched on. (`kind` stays the sub-folder.)

alter table public.art_assets
  add column if not exists stage text not null default 'final';

alter table public.art_assets drop constraint if exists art_assets_stage_check;
alter table public.art_assets
  add constraint art_assets_stage_check check (stage in ('final', 'working'));

create index if not exists art_assets_stage_idx on public.art_assets (stage);
