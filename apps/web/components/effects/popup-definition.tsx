import { alphaHex } from '@/lib/soft-surface';

/** The answer's definition under the popup's answer tiles (R1): a small part-of-speech chip + the line. */
export function PopupDefinition({ def, accent }: { def: { definition?: string | null; partOfSpeech?: string | null; phonetic?: string | null }; accent: string }) {
  if (!def.definition) return null;
  return (
    <div className="mt-2 text-left">
      <div className="flex items-center gap-1.5 flex-wrap">
        {def.partOfSpeech && (
          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: alphaHex(accent, 0.16), color: 'var(--color-text)', letterSpacing: '0.08em' }}>
            {def.partOfSpeech}
          </span>
        )}
        {def.phonetic && <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>{def.phonetic}</span>}
      </div>
      <p className="m-0 mt-1 text-[13px] font-medium leading-snug" style={{ color: 'var(--color-text-secondary)' }}>{def.definition}</p>
    </div>
  );
}
