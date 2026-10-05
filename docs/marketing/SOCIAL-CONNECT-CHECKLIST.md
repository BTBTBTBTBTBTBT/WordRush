# Social Studio: connect the accounts

Social Studio (admin > Growth > Social Studio) posts approved posts by itself. Each platform stays **Not connected**, and nothing posts there, until you finish its steps below. You only do this once per platform.

The pattern is the same everywhere:

1. Create a developer app on the platform, signed in as the account that owns the handle.
2. Paste our **redirect URL** into the app.
3. Ask for the **permissions** listed.
4. Add the **env vars** in Vercel (Project > Settings > Environment Variables, Production), then redeploy (push to main, or Redeploy in Vercel).
5. Open Social Studio > Accounts and click **Connect**. Approve on the platform's screen. You land back on the Studio with "Connected".

Tokens are stored on the server only (table `social_accounts`, service role only). They are never shown in the page.

Pause switch: **Pause all posting** at the top of the Studio stops everything, right away.

---

## Instagram + Facebook Page (one Meta app, one Connect)

Handles: Instagram @wordocious2, the Wordocious Facebook Page.

Before you start: Instagram must be a **Business or Creator** account, **linked to the Wordocious Facebook Page** (Instagram app > Settings > Account type and tools; then link the Page in Meta Business Suite). Instagram posting through the API does not work for personal accounts.

1. Go to developers.facebook.com > My Apps > Create App. Pick the "Business" type (Meta renames these choices often; pick the one that offers Facebook Login and the Instagram Graph API).
2. Add the products **Facebook Login for Business** (or Facebook Login) and **Instagram Graph API**.
3. Facebook Login > Settings > Valid OAuth Redirect URIs:
   `https://wordocious.com/api/admin/studio/callback/meta`
4. Permissions to request: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`.
   While the app is in Development mode these work for you (an app admin) without App Review. For anyone else, and possibly for live posting, Meta may require App Review. Plan on it, but try first.
5. Vercel env vars:
   - `META_APP_ID` (App settings > Basic > App ID)
   - `META_APP_SECRET` (App settings > Basic > App Secret)
   - optional `META_PAGE_ID`: only if you manage more than one Page (otherwise the first Page is used)
6. Connect "Instagram + Facebook Page". On Meta's screen, tick the Wordocious Page and the Instagram account.

Limits worth knowing: Instagram takes JPEG images by URL (our images are JPEG); roughly 25 to 50 API posts per 24 hours (plenty).

## Threads

Handle: @wordocious2 (it rides on the Instagram account).

1. developers.facebook.com > Create App > pick the **Threads API** use case (it is its own app type).
2. Threads API > Settings > Redirect Callback URLs:
   `https://wordocious.com/api/admin/studio/callback/threads`
   (Meta also asks for Uninstall and Delete callback URLs; the same URL is fine for now.)
3. Permissions: `threads_basic`, `threads_content_publish`.
4. In Development mode, add @wordocious2 as a **Threads tester** (App roles > Roles), then accept the invite in the Threads/Instagram app (Settings > Account > Website permissions; Meta moves this).
5. Vercel env vars: `THREADS_APP_ID`, `THREADS_APP_SECRET` (Threads API > Settings, not the main app's ID).
6. Connect "Threads". The token lasts about 60 days; the Studio refreshes it automatically before it runs out.

## Pinterest

Handle: the Wordocious Pinterest account.

1. Make sure the account is a **business account** and has at least one board (for example "Wordocious"). Pins go to that board.
2. developers.pinterest.com > My apps > Connect app. Pinterest reviews new apps before you get full access (it may start in "Trial" access, which can only create pins visible to you; request Standard access when it asks).
3. Redirect URI:
   `https://wordocious.com/api/admin/studio/callback/pinterest`
4. Scopes: `boards:read`, `pins:read`, `pins:write`, `user_accounts:read`.
5. Vercel env vars:
   - `PINTEREST_APP_ID`
   - `PINTEREST_APP_SECRET`
   - optional `PINTEREST_BOARD_ID`: the board to pin to (otherwise the first board)
6. Connect "Pinterest".

## X

Handle: @wordocious.

1. developer.x.com > sign in as @wordocious > create a Project and an App.
2. App > User authentication settings > Set up:
   - App permissions: **Read and write**
   - Type of App: **Web App, Automated App or Bot** (confidential client)
   - Callback URI: `https://wordocious.com/api/admin/studio/callback/x`
   - Website URL: `https://wordocious.com`
3. Scopes the Studio asks for: `tweet.read`, `tweet.write`, `users.read`, `media.write`, `offline.access`.
4. Vercel env vars: `X_CLIENT_ID`, `X_CLIENT_SECRET` (Keys and tokens > **OAuth 2.0** Client ID and Client Secret, not the API Key / Secret).
5. Connect "X".

Limits, honestly: X's API tiers change often. The Free tier has historically allowed a small number of posts per month (around 500) and may or may not include image upload with OAuth 2.0; if posting fails with a 403 about access level, the app needs the paid Basic tier. The Studio shows the exact error on the post.

## TikTok (drafts only)

Handle: @wordocious2.

TikTok only allows **direct** posting from apps that pass its audit. Until then the Studio sends each post to the **TikTok inbox as a draft**: you get a notification in the TikTok app and finish the post there (sound, then Post). Images only for now; video comes later.

1. developers.tiktok.com > Manage apps > Connect an app.
2. Add the products **Login Kit** and **Content Posting API**.
3. Redirect URI: `https://wordocious.com/api/admin/studio/callback/tiktok`
4. Scopes: `user.info.basic`, `video.upload` (the draft/inbox scope).
5. Content Posting API > **verify the domain** `wordocious.com` (TikTok pulls our images from a URL and only from verified domains).
6. Submit the app for review if TikTok asks (it usually does before anyone but the developer can log in).
7. Vercel env vars: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.
8. Connect "TikTok (drafts to inbox)".

---

## Env var summary (Vercel, Production)

| Platform | Variables |
| --- | --- |
| Instagram + Facebook | `META_APP_ID`, `META_APP_SECRET`, optional `META_PAGE_ID` |
| Threads | `THREADS_APP_ID`, `THREADS_APP_SECRET` |
| Pinterest | `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, optional `PINTEREST_BOARD_ID` |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |

`CRON_SECRET` already exists (the publisher uses it like the other crons). The publisher runs every 15 minutes.

## If something goes wrong

- A post that fails is retried twice more (15 minutes, then an hour later). After 3 failures it turns **red** with the platform's error.
- If a post was interrupted mid-send, the Studio marks it failed instead of retrying, so nothing posts twice. Check the platform, then fix it by hand.
- To disconnect: Accounts > Disconnect, and also remove the app from the platform's "connected apps" settings.
