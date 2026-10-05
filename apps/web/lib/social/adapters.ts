/**
 * Social Studio platform adapters, behind one interface (server only). Each provider is dormant until its env vars
 * are set (docs/marketing/SOCIAL-CONNECT-CHECKLIST.md) AND its account is connected (public.social_accounts).
 *
 * Tokens: read and written only here and in the connect/callback routes, with the service role. Never logged,
 * never returned to the browser, never put in an error message (errors pass through `scrub`).
 *
 * API shapes follow each platform's public docs as of 2026; the comments flag what to re-check on first connect.
 */
import { PROVIDERS, type Platform, type Provider } from '@/lib/admin/studio';

export interface AccountRow {
  platform: Platform;
  account_id: string | null;
  handle: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string | null;
  meta: Record<string, unknown>;
}

/** What a successful connect stores (one provider can yield two rows: Meta -> instagram + facebook). */
export type ConnectedAccount = Omit<AccountRow, 'meta'> & { meta?: Record<string, unknown> };

export interface PublishInput {
  text: string;
  /** Public (or signed, long enough to fetch) image URLs, first = cover. */
  imageUrls: string[];
  link: string | null;
  title: string;
}
export interface PublishResult { remoteId: string; url: string | null; note?: string }

export interface ProviderAdapter {
  provider: Provider;
  /** PKCE (S256) needed in the authorize step. */
  pkce: boolean;
  authorizeUrl(a: { clientId: string; redirectUri: string; state: string; codeChallenge?: string }): string;
  exchange(a: { code: string; redirectUri: string; codeVerifier?: string | null; clientId: string; clientSecret: string }): Promise<ConnectedAccount[]>;
}

export interface PlatformPublisher {
  platform: Platform;
  /** Refresh the token when it is near expiry; returns the fields to update, or null when nothing changed. */
  refresh?(acct: AccountRow, env: { clientId: string; clientSecret: string }): Promise<Partial<AccountRow> | null>;
  publish(acct: AccountRow, input: PublishInput): Promise<PublishResult>;
}

/* ------------------------------------------------------------------ env */

export function providerEnv(provider: Provider): { clientId: string; clientSecret: string } | null {
  const [idVar, secretVar] = PROVIDERS[provider].env;
  const clientId = (process.env[idVar] ?? '').trim();
  const clientSecret = (process.env[secretVar] ?? '').trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** The OAuth callback URL a provider's developer app must list (our route on the site). */
export function redirectUriFor(provider: Provider, origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://wordocious.com'): string {
  return `${origin.replace(/\/$/, '')}/api/admin/studio/callback/${provider}`;
}

/* ---------------------------------------------------------------- utils */

/** Remove anything token-shaped from an error before it is stored or shown. */
export function scrub(message: string, secrets: Array<string | null | undefined> = []): string {
  let out = message;
  for (const s of secrets) if (s && s.length > 6) out = out.split(s).join('[redacted]');
  out = out.replace(/(access_token|refresh_token|client_secret|code)=([^&\s"]+)/gi, '$1=[redacted]');
  out = out.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]');
  return out.slice(0, 500);
}

async function json(res: Response, what: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 200) }; }
  if (!res.ok) {
    const err = (body.error as { message?: string } | string | undefined);
    const msg = typeof err === 'string' ? err : err?.message ?? (body.message as string) ?? (body.detail as string) ?? (body.raw as string) ?? '';
    throw new Error(`${what} failed (${res.status})${msg ? `: ${msg}` : ''}`);
  }
  return body;
}

const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
const expiresIn = (sec: unknown) => (typeof sec === 'number' && sec > 0 ? new Date(Date.now() + sec * 1000).toISOString() : null);
const basic = (id: string, secret: string) => `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;

/* ----------------------------------------------------------------- Meta */
// Facebook Login -> long-lived user token -> the Page token (does not expire while the user token is valid) and
// the Page's linked Instagram Business/Creator account. Instagram posts through the Page token.

const GRAPH = 'https://graph.facebook.com/v21.0';

const meta: ProviderAdapter = {
  provider: 'meta',
  pkce: false,
  authorizeUrl: ({ clientId, redirectUri, state }) => `https://www.facebook.com/v21.0/dialog/oauth?${form({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management',
  })}`,
  async exchange({ code, redirectUri, clientId, clientSecret }) {
    const short = await json(await fetch(`${GRAPH}/oauth/access_token?${form({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code })}`), 'Meta token');
    const long = await json(await fetch(`${GRAPH}/oauth/access_token?${form({
      grant_type: 'fb_exchange_token', client_id: clientId, client_secret: clientSecret, fb_exchange_token: String(short.access_token),
    })}`), 'Meta long-lived token');
    const userToken = String(long.access_token);
    const pages = await json(await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`), 'Meta pages');
    const list = (pages.data as Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }>) ?? [];
    const wanted = (process.env.META_PAGE_ID ?? '').trim();
    const page = list.find((p) => p.id === wanted) ?? list[0];
    if (!page) throw new Error('No Facebook Page came back. Pick the Wordocious Page on the Meta consent screen.');
    const out: ConnectedAccount[] = [{
      platform: 'facebook', account_id: page.id, handle: page.name, access_token: page.access_token, refresh_token: null,
      expires_at: null, scopes: null, meta: { page_name: page.name },
    }];
    if (page.instagram_business_account?.id) {
      out.push({
        platform: 'instagram', account_id: page.instagram_business_account.id,
        handle: page.instagram_business_account.username ? `@${page.instagram_business_account.username}` : null,
        access_token: page.access_token, refresh_token: null, expires_at: null, scopes: null, meta: { via_page: page.id },
      });
    }
    return out;
  },
};

const facebook: PlatformPublisher = {
  platform: 'facebook',
  async publish(acct, input) {
    const body = await json(await fetch(`${GRAPH}/${acct.account_id}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ url: input.imageUrls[0], message: input.text, published: 'true', access_token: acct.access_token ?? '' }),
    }), 'Facebook photo');
    const postId = String(body.post_id ?? body.id);
    return { remoteId: postId, url: `https://www.facebook.com/${postId}` };
  },
};

async function igContainer(acct: AccountRow, params: Record<string, string>): Promise<string> {
  const body = await json(await fetch(`${GRAPH}/${acct.account_id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ ...params, access_token: acct.access_token ?? '' }),
  }), 'Instagram container');
  return String(body.id);
}

const instagram: PlatformPublisher = {
  platform: 'instagram',
  async publish(acct, input) {
    // Instagram takes JPEG image URLs it can fetch. 2+ images -> a carousel.
    let creation: string;
    if (input.imageUrls.length > 1) {
      const children: string[] = [];
      for (const url of input.imageUrls.slice(0, 10)) children.push(await igContainer(acct, { image_url: url, is_carousel_item: 'true' }));
      creation = await igContainer(acct, { media_type: 'CAROUSEL', children: children.join(','), caption: input.text });
    } else {
      creation = await igContainer(acct, { image_url: input.imageUrls[0], caption: input.text });
    }
    const pub = await json(await fetch(`${GRAPH}/${acct.account_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ creation_id: creation, access_token: acct.access_token ?? '' }),
    }), 'Instagram publish');
    const id = String(pub.id);
    const link = await fetch(`${GRAPH}/${id}?fields=permalink&access_token=${encodeURIComponent(acct.access_token ?? '')}`)
      .then((r) => r.json()).catch(() => ({})) as { permalink?: string };
    return { remoteId: id, url: link.permalink ?? null };
  },
};

/* -------------------------------------------------------------- Threads */

const THREADS = 'https://graph.threads.net/v1.0';

const threadsProvider: ProviderAdapter = {
  provider: 'threads',
  pkce: false,
  authorizeUrl: ({ clientId, redirectUri, state }) => `https://threads.net/oauth/authorize?${form({
    client_id: clientId, redirect_uri: redirectUri, state, response_type: 'code', scope: 'threads_basic,threads_content_publish',
  })}`,
  async exchange({ code, redirectUri, clientId, clientSecret }) {
    const short = await json(await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code }),
    }), 'Threads token');
    const long = await json(await fetch(`https://graph.threads.net/access_token?${form({
      grant_type: 'th_exchange_token', client_secret: clientSecret, access_token: String(short.access_token),
    })}`), 'Threads long-lived token');
    const token = String(long.access_token);
    const me = await json(await fetch(`${THREADS}/me?fields=id,username&access_token=${encodeURIComponent(token)}`), 'Threads profile');
    return [{
      platform: 'threads', account_id: String(me.id), handle: me.username ? `@${me.username}` : null, access_token: token,
      refresh_token: null, expires_at: expiresIn(long.expires_in), scopes: 'threads_basic,threads_content_publish',
    }];
  },
};

const threads: PlatformPublisher = {
  platform: 'threads',
  async refresh(acct) {
    // Long-lived Threads tokens last ~60 days; refresh when under 10 days remain.
    if (!acct.expires_at || new Date(acct.expires_at).getTime() - Date.now() > 10 * 86400_000) return null;
    const body = await json(await fetch(`https://graph.threads.net/refresh_access_token?${form({ grant_type: 'th_refresh_token', access_token: acct.access_token ?? '' })}`), 'Threads refresh');
    return { access_token: String(body.access_token), expires_at: expiresIn(body.expires_in) };
  },
  async publish(acct, input) {
    const c = await json(await fetch(`${THREADS}/${acct.account_id}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ media_type: 'IMAGE', image_url: input.imageUrls[0], text: input.text, access_token: acct.access_token ?? '' }),
    }), 'Threads container');
    // Meta recommends a short wait before publishing an image container.
    await new Promise((r) => setTimeout(r, 5000));
    const p = await json(await fetch(`${THREADS}/${acct.account_id}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ creation_id: String(c.id), access_token: acct.access_token ?? '' }),
    }), 'Threads publish');
    const id = String(p.id);
    const link = await fetch(`${THREADS}/${id}?fields=permalink&access_token=${encodeURIComponent(acct.access_token ?? '')}`)
      .then((r) => r.json()).catch(() => ({})) as { permalink?: string };
    return { remoteId: id, url: link.permalink ?? null };
  },
};

/* ------------------------------------------------------------ Pinterest */

const PIN_API = 'https://api.pinterest.com/v5';

const pinterestProvider: ProviderAdapter = {
  provider: 'pinterest',
  pkce: false,
  authorizeUrl: ({ clientId, redirectUri, state }) => `https://www.pinterest.com/oauth/?${form({
    client_id: clientId, redirect_uri: redirectUri, state, response_type: 'code', scope: 'boards:read,pins:read,pins:write,user_accounts:read',
  })}`,
  async exchange({ code, redirectUri, clientId, clientSecret }) {
    const tok = await json(await fetch(`${PIN_API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic(clientId, clientSecret) },
      body: form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    }), 'Pinterest token');
    const token = String(tok.access_token);
    const me = await json(await fetch(`${PIN_API}/user_account`, { headers: { Authorization: `Bearer ${token}` } }), 'Pinterest profile');
    const boards = await json(await fetch(`${PIN_API}/boards?page_size=50`, { headers: { Authorization: `Bearer ${token}` } }), 'Pinterest boards');
    const items = (boards.items as Array<{ id: string; name: string }>) ?? [];
    const wanted = (process.env.PINTEREST_BOARD_ID ?? '').trim();
    const board = items.find((b) => b.id === wanted) ?? items[0];
    if (!board) throw new Error('No Pinterest board found. Create a board (e.g. "Wordocious") first, then Connect again.');
    return [{
      platform: 'pinterest', account_id: board.id, handle: me.username ? String(me.username) : null, access_token: token,
      refresh_token: tok.refresh_token ? String(tok.refresh_token) : null, expires_at: expiresIn(tok.expires_in),
      scopes: String(tok.scope ?? ''), meta: { board_name: board.name },
    }];
  },
};

const pinterest: PlatformPublisher = {
  platform: 'pinterest',
  async refresh(acct, env) {
    if (!acct.refresh_token || !acct.expires_at || new Date(acct.expires_at).getTime() - Date.now() > 3 * 86400_000) return null;
    const tok = await json(await fetch(`${PIN_API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic(env.clientId, env.clientSecret) },
      body: form({ grant_type: 'refresh_token', refresh_token: acct.refresh_token }),
    }), 'Pinterest refresh');
    return {
      access_token: String(tok.access_token),
      refresh_token: tok.refresh_token ? String(tok.refresh_token) : acct.refresh_token,
      expires_at: expiresIn(tok.expires_in),
    };
  },
  async publish(acct, input) {
    const body = await json(await fetch(`${PIN_API}/pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${acct.access_token}` },
      body: JSON.stringify({
        board_id: acct.account_id,
        title: input.title.slice(0, 100),
        description: input.text.slice(0, 500),
        link: input.link ?? undefined,
        media_source: { source_type: 'image_url', url: input.imageUrls[0] },
      }),
    }), 'Pinterest pin');
    const id = String(body.id);
    return { remoteId: id, url: `https://www.pinterest.com/pin/${id}/` };
  },
};

/* -------------------------------------------------------------------- X */
// OAuth 2.0 with PKCE. Image upload uses the v2 media endpoint (needs the media.write scope); re-check against
// X's docs on first connect, as X has changed its media API and tier limits more than once.

const X_API = 'https://api.x.com/2';

const xProvider: ProviderAdapter = {
  provider: 'x',
  pkce: true,
  authorizeUrl: ({ clientId, redirectUri, state, codeChallenge }) => `https://x.com/i/oauth2/authorize?${form({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state,
    scope: 'tweet.read tweet.write users.read media.write offline.access',
    code_challenge: codeChallenge ?? '', code_challenge_method: 'S256',
  })}`,
  async exchange({ code, redirectUri, codeVerifier, clientId, clientSecret }) {
    const tok = await json(await fetch(`${X_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic(clientId, clientSecret) },
      body: form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier ?? '', client_id: clientId }),
    }), 'X token');
    const token = String(tok.access_token);
    const me = await json(await fetch(`${X_API}/users/me`, { headers: { Authorization: `Bearer ${token}` } }), 'X profile');
    const data = (me.data ?? {}) as { id?: string; username?: string };
    return [{
      platform: 'x', account_id: data.id ?? null, handle: data.username ? `@${data.username}` : null, access_token: token,
      refresh_token: tok.refresh_token ? String(tok.refresh_token) : null, expires_at: expiresIn(tok.expires_in), scopes: String(tok.scope ?? ''),
    }];
  },
};

const x: PlatformPublisher = {
  platform: 'x',
  async refresh(acct, env) {
    // X access tokens last ~2 hours; refresh tokens rotate on every use.
    if (!acct.refresh_token || (acct.expires_at && new Date(acct.expires_at).getTime() - Date.now() > 10 * 60_000)) return null;
    const tok = await json(await fetch(`${X_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basic(env.clientId, env.clientSecret) },
      body: form({ grant_type: 'refresh_token', refresh_token: acct.refresh_token, client_id: env.clientId }),
    }), 'X refresh');
    return {
      access_token: String(tok.access_token),
      refresh_token: tok.refresh_token ? String(tok.refresh_token) : acct.refresh_token,
      expires_at: expiresIn(tok.expires_in),
    };
  },
  async publish(acct, input) {
    const img = await fetch(input.imageUrls[0]);
    if (!img.ok) throw new Error(`Could not fetch the image (${img.status})`);
    const bytes = Buffer.from(await img.arrayBuffer());
    const fd = new FormData();
    fd.append('media', new Blob([bytes], { type: img.headers.get('content-type') ?? 'image/jpeg' }));
    fd.append('media_category', 'tweet_image');
    const up = await json(await fetch(`${X_API}/media/upload`, { method: 'POST', headers: { Authorization: `Bearer ${acct.access_token}` }, body: fd }), 'X media upload');
    const mediaId = String((up.data as { id?: string } | undefined)?.id ?? up.media_id_string ?? up.id);
    const tw = await json(await fetch(`${X_API}/tweets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${acct.access_token}` },
      body: JSON.stringify({ text: input.text, media: { media_ids: [mediaId] } }),
    }), 'X post');
    const id = String((tw.data as { id?: string } | undefined)?.id);
    return { remoteId: id, url: `https://x.com/${(acct.handle ?? 'wordocious').replace(/^@/, '')}/status/${id}` };
  },
};

/* --------------------------------------------------------------- TikTok */
// Content Posting API in MEDIA_UPLOAD (inbox / draft) mode only: the post lands in the TikTok app's inbox and a
// person finishes it there. Direct posting needs TikTok's app audit; until then this stays draft-only.
// PULL_FROM_URL photos require the image URL's domain to be verified in the TikTok developer portal.

const TT_API = 'https://open.tiktokapis.com/v2';

const tiktokProvider: ProviderAdapter = {
  provider: 'tiktok',
  pkce: false,
  authorizeUrl: ({ clientId, redirectUri, state }) => `https://www.tiktok.com/v2/auth/authorize/?${form({
    client_key: clientId, redirect_uri: redirectUri, state, response_type: 'code', scope: 'user.info.basic,video.upload',
  })}`,
  async exchange({ code, redirectUri, clientId, clientSecret }) {
    const tok = await json(await fetch(`${TT_API}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_key: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    }), 'TikTok token');
    const token = String(tok.access_token);
    const me = await json(await fetch(`${TT_API}/user/info/?fields=open_id,display_name`, { headers: { Authorization: `Bearer ${token}` } }), 'TikTok profile');
    const user = ((me.data as { user?: { open_id?: string; display_name?: string } } | undefined)?.user) ?? {};
    return [{
      platform: 'tiktok', account_id: user.open_id ?? String(tok.open_id ?? ''), handle: user.display_name ?? null, access_token: token,
      refresh_token: tok.refresh_token ? String(tok.refresh_token) : null, expires_at: expiresIn(tok.expires_in), scopes: String(tok.scope ?? ''),
    }];
  },
};

const tiktok: PlatformPublisher = {
  platform: 'tiktok',
  async refresh(acct, env) {
    if (!acct.refresh_token || (acct.expires_at && new Date(acct.expires_at).getTime() - Date.now() > 3600_000)) return null;
    const tok = await json(await fetch(`${TT_API}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_key: env.clientId, client_secret: env.clientSecret, grant_type: 'refresh_token', refresh_token: acct.refresh_token }),
    }), 'TikTok refresh');
    return {
      access_token: String(tok.access_token),
      refresh_token: tok.refresh_token ? String(tok.refresh_token) : acct.refresh_token,
      expires_at: expiresIn(tok.expires_in),
    };
  },
  async publish(acct, input) {
    const body = await json(await fetch(`${TT_API}/post/publish/content/init/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', Authorization: `Bearer ${acct.access_token}` },
      body: JSON.stringify({
        post_info: { title: input.title.slice(0, 90), description: input.text.slice(0, 4000) },
        source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: input.imageUrls.slice(0, 35) },
        post_mode: 'MEDIA_UPLOAD',
        media_type: 'PHOTO',
      }),
    }), 'TikTok inbox upload');
    const id = String((body.data as { publish_id?: string } | undefined)?.publish_id ?? '');
    return { remoteId: id, url: null, note: 'Sent to the TikTok inbox: open TikTok to finish posting.' };
  },
};

/* ------------------------------------------------------------- registry */

export const PROVIDER_ADAPTERS: Record<Provider, ProviderAdapter> = {
  meta, threads: threadsProvider, pinterest: pinterestProvider, x: xProvider, tiktok: tiktokProvider,
};

export const PUBLISHERS: Record<Platform, PlatformPublisher> = { instagram, facebook, threads, pinterest, x, tiktok };
