Wordocious Edit Profile ("the Stage"): players can't change their profile photo. Today iOS/Android only open the Change Photo menu when switching SHOW to "My photo" while NO photo exists (EditProfileView.swift ~line 340, EditProfileScreen.kt ~line 492); once a photo exists there's no way to replace or remove it. On web (apps/web/components/profile/profile-edit-modal.tsx) "My photo" is disabled without a photo and there is no upload at all. Founder + partner both couldn't find it.

Start from branch `claude/wordocious-store-text-audit-f32609`; create a NEW branch `cloud/change-photo`, push only there, open a draft PR into the starting branch. Never push to main or the starting branch. No version changes.

FIX on iOS, Android and web (same behavior everywhere):
1. When SHOW = My photo: tapping the photo on the Stage opens the Change Photo menu, AND a small quiet "Change photo" button sits right under the SHOW toggle (family QuietButton style; no plain-text links, no bordered boxes).
2. The Change Photo menu (the existing FamilyActionMenu on iOS/Android; build the same family menu on web): Take photo (when a camera exists; web: file input with capture on mobile), Choose from library, Remove photo (when one is set → switches SHOW back to My mascot).
3. Web gets real upload: reuse the same storage bucket/path and the same resize/crop rules iOS and Android use for avatar photos (find them in AuthService / the photo upload code), update profiles.avatar_url the same way, with the same moderation/size limits; show the cast loading state while uploading (no bare spinner).
4. Choosing "My photo" with no photo opens the menu (as today on iOS/Android; add on web instead of disabling).
5. Tests for the shared logic (when the button/menu shows, remove → mascot), web vitest + tsc, Swift/Gradle tests if available (else say so). Note anything that needs an on-device check.
Report in the PR: what changed per platform and what to verify on devices.
