#!/usr/bin/env node
// Social Studio: attach images to a draft post from the command line (the same result as the admin page's
// "Replace image", which is /api/admin/studio/media + /api/admin/studio/edit).
//
//   node apps/web/scripts/social-attach.mjs <post-id> <image.png>                     one source, cover-cropped to every size
//   node apps/web/scripts/social-attach.mjs <post-id> --portrait a.png --landscape b.png --pin c.png
//   node apps/web/scripts/social-attach.mjs <post-id> <image.png> --size portrait,pin   only these sizes (others kept as they are)
//   node apps/web/scripts/social-attach.mjs --manifest media.json                       [{ "post_id": "...", "files": { "portrait": "a.png", "landscape": "b.png", "pin": "c.png" } }]
//                                                                                        ("files" may also hold "source": one image for every size; paths are relative to the manifest)
//   node apps/web/scripts/social-attach.mjs --clear <post-id>                           media back to [] (bucket files removed)
//
// Options: --dry-run   render the JPEGs to a temp folder and print the media JSON; touches nothing (no network)
//          --env FILE  where to read NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (default: the environment,
//                      then apps/web/.env.local). The key is never printed.
//
// Mirrors the route exactly: per size a JPEG (rotate, cover crop on "attention", flatten white, mozjpeg q88) in the
// private 'social-media' bucket at posts/<post-id>/<tag>-<size>.jpg, then social_posts.media = [{ size, src:'bucket',
// path, width, height }] with version + 1 (optimistic: only from the version read), edited_at/updated_at now. The
// version bump is what resets BOTH approvals (reviews are stamped with the version they were given on); reviews
// are not touched. Posted / posting posts are refused, like the edit route.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
/** lib/admin/studio.ts MEDIA_SIZES. */
const MEDIA_SIZES = { portrait: [1080, 1350], pin: [1000, 1500], landscape: [1600, 900] };
const SIZES = Object.keys(MEDIA_SIZES);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function usage(msg) {
  if (msg) console.error(`social-attach: ${msg}\n`);
  console.error(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(msg ? 1 : 0);
}

/* ------------------------------------------------------------------ args */
const argv = process.argv.slice(2);
const opts = { dry: false, env: null, manifest: null, clear: false, only: null, files: {}, source: null, postId: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dry-run') opts.dry = true;
  else if (a === '--env') opts.env = argv[++i];
  else if (a === '--manifest') opts.manifest = argv[++i];
  else if (a === '--clear') opts.clear = true;
  else if (a === '--size') opts.only = String(argv[++i] ?? '').split(',').filter(Boolean);
  else if (a === '-h' || a === '--help') usage();
  else if (a.startsWith('--') && SIZES.includes(a.slice(2))) opts.files[a.slice(2)] = argv[++i];
  else if (a.startsWith('--')) usage(`unknown option ${a}`);
  else if (!opts.postId && UUID.test(a)) opts.postId = a;
  else if (!opts.source) opts.source = a;
  else usage(`unexpected argument ${a}`);
}
if (opts.only && !opts.only.every((s) => SIZES.includes(s))) usage(`--size takes ${SIZES.join(', ')}`);

/* ------------------------------------------------------------------ env */
function readEnvFile(file) {
  const out = {};
  if (!file || !existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}
function credentials() {
  const file = readEnvFile(opts.env ?? join(WEB, '.env.local'));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || file.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || file.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('social-attach: no SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) in the environment or apps/web/.env.local.\n' +
      'Add them to that file, or point --env at one that has them. (--dry-run needs neither.)');
    process.exit(2);
  }
  return { url, key };
}

/* --------------------------------------------------------------- render */
async function render(input, size) {
  const [width, height] = MEDIA_SIZES[size];
  const buf = await sharp(input).rotate().resize(width, height, { fit: 'cover', position: 'attention' })
    .flatten({ background: '#ffffff' }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  return { buf, width, height };
}

/** One job: which source feeds which size. A size with its own file wins over the single source. */
function plan(job, baseDir) {
  const want = job.only ?? SIZES;
  const out = {};
  for (const size of want) {
    const f = job.files?.[size] ?? job.source;
    if (f) out[size] = resolve(baseDir, f);
  }
  if (!Object.keys(out).length) throw new Error('no image given for this post');
  for (const [size, f] of Object.entries(out)) if (!existsSync(f)) throw new Error(`${size}: ${f} does not exist`);
  return out;
}

/* ------------------------------------------------------------------ main */
const jobs = [];
if (opts.manifest) {
  const file = resolve(opts.manifest);
  const list = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(list)) usage('the manifest must be an array');
  for (const e of list) {
    if (!UUID.test(e.post_id ?? '')) usage(`manifest: bad post_id ${e.post_id}`);
    const { source, ...files } = e.files ?? {};
    jobs.push({ postId: e.post_id, files, source, only: opts.only, base: dirname(file) });
  }
} else if (opts.clear) {
  if (!opts.postId && opts.source && UUID.test(opts.source)) opts.postId = opts.source;
  if (!opts.postId) usage('--clear needs a post id');
  jobs.push({ postId: opts.postId, clear: true });
} else {
  if (!opts.postId) usage('give a post id (uuid)');
  jobs.push({ postId: opts.postId, files: opts.files, source: opts.source, only: opts.only, base: process.cwd() });
}

let admin = null;
if (!opts.dry) {
  const { url, key } = credentials();
  const { createClient } = await import('@supabase/supabase-js');
  admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

let failed = 0;
for (const job of jobs) {
  try {
    await run(job);
  } catch (err) {
    failed++;
    console.error(`FAIL ${job.postId}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);

async function loadDraft(postId) {
  const { data: post, error } = await admin.from('social_posts').select('id, status, version, media').eq('id', postId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!post) throw new Error('no such post');
  const { data: targets, error: tErr } = await admin.from('social_post_targets').select('status').eq('post_id', postId);
  if (tErr) throw new Error(tErr.message);
  if (post.status !== 'draft' || (targets ?? []).some((t) => t.status === 'posted' || t.status === 'posting')) {
    throw new Error('already posted (or posting): it can no longer be edited');
  }
  return post;
}

/** The edit route's write: media + version + 1, from the version read (optimistic), nothing else. */
async function saveMedia(post, media) {
  const now = new Date().toISOString();
  const { data, error } = await admin.from('social_posts')
    .update({ media, version: post.version + 1, edited_at: now, edited_by: null, updated_at: now })
    .eq('id', post.id).eq('version', post.version).select('id, version').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('someone else just edited this post; run it again');
  return data.version;
}

async function run(job) {
  if (job.clear) {
    const post = await loadDraft(job.postId);
    const paths = (post.media ?? []).filter((m) => m.src === 'bucket').map((m) => m.path);
    if (JSON.stringify(post.media ?? []) === '[]') return console.log(`${job.postId}: media already empty`);
    const v = await saveMedia(post, []);
    if (paths.length) await admin.storage.from('social-media').remove(paths);
    return console.log(`${job.postId}: media cleared (version ${v}, ${paths.length} files removed)`);
  }

  const sources = plan(job, job.base);
  const tag = randomBytes(4).toString('hex');
  const rendered = [];
  for (const [size, file] of Object.entries(sources)) {
    const { buf, width, height } = await render(readFileSync(file), size);
    rendered.push({ size, buf, width, height, path: `posts/${job.postId}/${tag}-${size}.jpg` });
  }

  if (opts.dry) {
    const dir = join(tmpdir(), `social-attach-${tag}`);
    mkdirSync(dir, { recursive: true });
    const { writeFileSync } = await import('node:fs');
    for (const r of rendered) writeFileSync(join(dir, `${tag}-${r.size}.jpg`), r.buf);
    console.log(`DRY ${job.postId}: ${rendered.map((r) => `${r.size} ${r.width}x${r.height} ${(r.buf.length / 1024).toFixed(0)} KB`).join(', ')} -> ${dir}`);
    console.log(JSON.stringify(rendered.map((r) => ({ size: r.size, src: 'bucket', path: r.path, width: r.width, height: r.height }))));
    return;
  }

  const post = await loadDraft(job.postId);
  const fresh = [];
  for (const r of rendered) {
    const { error } = await admin.storage.from('social-media').upload(r.path, r.buf, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error(`upload ${r.size}: ${error.message}`);
    fresh.push({ size: r.size, src: 'bucket', path: r.path, width: r.width, height: r.height });
  }
  // A size that was not re-rendered keeps its current image (the page replaces all three; the CLI can do a subset).
  const kept = (post.media ?? []).filter((m) => !fresh.some((f) => f.size === m.size));
  const next = SIZES.flatMap((s) => [...fresh, ...kept].filter((m) => m.size === s));
  const v = await saveMedia(post, next);
  const old = (post.media ?? []).filter((m) => m.src === 'bucket' && fresh.some((f) => f.size === m.size)).map((m) => m.path);
  if (old.length) await admin.storage.from('social-media').remove(old);
  console.log(`OK ${job.postId}: ${fresh.map((f) => f.size).join(', ')} attached (version ${v}); both approvals reset`);
}
