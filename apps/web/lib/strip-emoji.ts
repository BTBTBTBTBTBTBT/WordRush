/**
 * Drop system emoji from a string that comes from a shared plain-text source
 * (packages/core copy written for push / share text) before it is shown in the
 * app UI — FINISH_SPEC AM3: no phone emoji anywhere on screen. Emoji
 * presentation characters, VS16 / ZWJ joiners, skin tones and the U+1F000 planes
 * go; typographic glyphs (✓ ★ → ©) stay. Whitespace left behind is tidied.
 */
// Built from code points, so the UI emoji scan (scripts/no-emoji-ui.test.ts) never sees an emoji literal here.
const cp = (n: number) => String.fromCodePoint(n);
const VS16 = cp(0xfe0f);
const ZWJ = cp(0x200d);
const EMOJI = new RegExp(
  `\\p{Emoji_Presentation}|\\p{Extended_Pictographic}${VS16}|[${cp(0x1f000)}-${cp(0x1faff)}]|[${VS16}${ZWJ}]`,
  'gu',
);

export function stripEmoji(text: string): string {
  return text.replace(EMOJI, '').replace(/\s{2,}/g, ' ').replace(/\s+([!?.,])/g, '$1').trim();
}
