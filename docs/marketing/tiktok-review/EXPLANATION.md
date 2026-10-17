# TikTok Production review: what we paste into the form (2026-10-16)

Demo video: `wordocious-tiktok-demo.mp4` (35 s, recorded on wordocious.com with the Sandbox app; 8 captioned steps).

## App explanation (paste into "Explain how each product and scope works within your app")

Wordocious (wordocious.com) is a daily word-game website and app by ShowLoud LLC. "Social Studio" is our own internal admin tool, used only by our team to post Wordocious content to our OWN brand account, @playwordocious. It is not offered to the public and no outside creators connect to it.

- **Login Kit / user.info.basic:** an admin clicks "Connect" for TikTok in Social Studio › Accounts and authorizes our @playwordocious account. We read only open_id and display_name to show which account is connected (the video shows the Connected state).
- **Content Posting API / video.upload:** our team writes posts and two reviewers approve each one. For TikTok, an admin opens a post and clicks "Send to TikTok drafts". We call /v2/post/publish/content/init/ with post_mode MEDIA_UPLOAD (photo post, images pulled from our verified URL prefix https://wordocious.com/). The post lands in the @playwordocious TikTok inbox as a private draft; a person on our team opens TikTok, finishes the post there and publishes it themselves. We never post directly.

Tokens are stored server-side only (never shown in the browser) and can be disconnected at any time from the same Accounts screen.

## Production app settings to mirror the Sandbox

Products: Login Kit + Content Posting API. Scopes: user.info.basic, video.upload. Redirect URI: https://wordocious.com/api/admin/studio/callback/tiktok. Web platform: https://wordocious.com/. URL properties: https://wordocious.com/ (URL prefix — production + sandbox each verified, files in apps/web/public/tiktok*.txt). Terms: https://wordocious.com/terms. Privacy: https://wordocious.com/privacy.

After approval: put the PRODUCTION client key/secret in Vercel (TIKTOK_CLIENT_KEY by CLI; TIKTOK_CLIENT_SECRET by the founder's pbpaste one-liner), redeploy, Studio › Accounts › TikTok › Connect again.
