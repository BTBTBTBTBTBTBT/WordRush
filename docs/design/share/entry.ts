// Browser entry for render.mjs: draws every sample card with the real renderers.
import { generateShareImage } from '@/lib/share-image';
import { generateVsShareImage } from '@/lib/vs-share-image';
import { SHARE_EXTRA_SAMPLES, SHARE_SAMPLES, VS_SHARE_SAMPLE } from '@/lib/share-samples';
import { setShareSender, shareSenderFromProfile } from '@/lib/share-sender';

async function toDataUrl(blob: Blob | null): Promise<string | null> {
  if (!blob) return null;
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(blob);
  });
}

// withHero = a signed-in sender (the hero band under the title, item 46); false = a guest's card.
(window as unknown as { renderAll: (withHero: boolean) => Promise<Array<{ id: string; url: string | null }>> }).renderAll = async (withHero) => {
  setShareSender(withHero ? shareSenderFromProfile({ username: 'Brian' } as never) : null);
  const out: Array<{ id: string; url: string | null }> = [];
  for (const s of [...SHARE_SAMPLES, ...SHARE_EXTRA_SAMPLES]) out.push({ id: s.id, url: await toDataUrl(await generateShareImage(s.input)) });
  out.push({ id: 'vs-classic', url: await toDataUrl(await generateVsShareImage(VS_SHARE_SAMPLE)) });
  return out;
};
