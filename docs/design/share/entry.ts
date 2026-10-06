// Browser entry for render.mjs: draws every sample card with the real renderers.
import { generateShareImage } from '@/lib/share-image';
import { generateVsShareImage } from '@/lib/vs-share-image';
import { SHARE_SAMPLES, VS_SHARE_SAMPLE } from '@/lib/share-samples';

async function toDataUrl(blob: Blob | null): Promise<string | null> {
  if (!blob) return null;
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(blob);
  });
}

(window as unknown as { renderAll: () => Promise<Array<{ id: string; url: string | null }>> }).renderAll = async () => {
  const out: Array<{ id: string; url: string | null }> = [];
  for (const s of SHARE_SAMPLES) out.push({ id: s.id, url: await toDataUrl(await generateShareImage(s.input)) });
  out.push({ id: 'vs-classic', url: await toDataUrl(await generateVsShareImage(VS_SHARE_SAMPLE)) });
  return out;
};
