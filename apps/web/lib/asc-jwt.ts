import { createSign } from 'node:crypto';

// App Store Connect API auth: an ES256 JWT signed with the team's .p8 key.
// Pulled out of api/admin/revenue/route.ts so the signing path is unit-
// testable with a throwaway key (asc-jwt.test.ts) — the real .p8 lives only in
// Vercel env (ASC_PRIVATE_KEY) and on the founder's machine, never in the repo.
//
// The four env vars the revenue card needs, with where each comes from:
//   ASC_KEY_ID        App Store Connect → Users and Access → Integrations →
//                     App Store Connect API → the key's "Key ID"
//   ASC_ISSUER_ID     same page, "Issuer ID" (one per team, above the key list)
//   ASC_PRIVATE_KEY   the downloaded AuthKey_<KEY_ID>.p8 contents, BEGIN/END
//                     lines included — pasted multi-line or \n-escaped, either works
//   ASC_VENDOR_NUMBER App Store Connect → Payments and Financial Reports →
//                     the vendor number shown at the top ("Vendor #")

export const ASC_ENV_VARS = ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY', 'ASC_VENDOR_NUMBER'] as const;
export type AscEnvVar = (typeof ASC_ENV_VARS)[number];

/** Apple accepts tokens up to 20 minutes old; stay under that. */
export const ASC_JWT_TTL_SECONDS = 20 * 60;

/**
 * Make a PEM pasted into an env var usable by node:crypto. Vercel (and most
 * dashboards) keep whatever was pasted verbatim, so the key can arrive with
 * literal "\n" two-character sequences instead of newlines, wrapped in quotes,
 * with CRLF endings, or with stray whitespace. Node's parser needs real
 * newlines after the BEGIN line, so normalize all of that here.
 */
export function normalizePem(raw: string): string {
  let pem = raw.trim();
  // Wrapping quotes survive a paste of `"-----BEGIN…"` from a .env file.
  if ((pem.startsWith('"') && pem.endsWith('"')) || (pem.startsWith("'") && pem.endsWith("'"))) {
    pem = pem.slice(1, -1).trim();
  }
  pem = pem.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n?/g, '\n');
  // Tidy indentation a YAML/heredoc paste may have added to each line.
  pem = pem.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).join('\n');
  return `${pem}\n`;
}

/** Which of the four required env vars are absent or blank. */
export function missingAscEnv(env: Record<string, string | undefined> = process.env): AscEnvVar[] {
  return ASC_ENV_VARS.filter((name) => !(env[name] ?? '').trim());
}

/**
 * Build the bearer token for api.appstoreconnect.apple.com. JWS requires the
 * raw r||s (ieee-p1363) signature form — Node signs DER by default, which
 * Apple rejects as NOT_AUTHORIZED, hence the explicit dsaEncoding.
 */
export function buildAscJwt(opts: {
  keyId: string;
  issuerId: string;
  privateKey: string;
  /** Epoch milliseconds; defaults to Date.now(). Injectable for tests. */
  now?: number;
}): string {
  const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');
  const iat = Math.floor((opts.now ?? Date.now()) / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: opts.keyId.trim(), typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: opts.issuerId.trim(),
    iat,
    exp: iat + ASC_JWT_TTL_SECONDS,
    aud: 'appstoreconnect-v1',
  }));
  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign({ key: normalizePem(opts.privateKey), dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64url(sig)}`;
}
