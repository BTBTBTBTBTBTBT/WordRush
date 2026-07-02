# Release re-sign entitlements

Used by the TestFlight build pipeline after `xcodebuild -exportArchive`:
sign `PlugIns/WordociousWidget.appex` with `ent-widget.plist` FIRST, then the
app with `ent-app.plist` (cert `Apple Distribution: BRIAN MAXWELL TERCHIN`,
SHA-1 `E834629E4D8BE4C07579FAAEDDEFA363F437060B` = ASC cert `KJNTAMJMVC`).

Both include the `group.com.wordocious.app` app group (home-screen widget data).
The app group must be registered + assigned to BOTH identifiers
(`com.wordocious.app` = GHS2PNXATK, `com.wordocious.app.widgets` = FN4U457D34)
in the developer portal — the public ASC API cannot manage app groups. After
any identifier/capability change, regenerate the App Store profiles via the
ASC API (POST /v1/profiles, cert KJNTAMJMVC) and export with `signingStyle:
manual` + a `provisioningProfiles` map, since the API key lacks cloud-signing
profile creation.
