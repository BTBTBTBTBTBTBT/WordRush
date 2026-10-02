import Image from 'next/image';
import { ART_SIZE, artSrc, type SceneName } from '@/lib/art';

// Scenes for the empty / error / done states (docs/ART_SPEC.md §7): one cast
// member with a prop (R asleep, R unplugged, U all done, O3 not found, I with
// an invite, D with no stats), in place of the plain bobbing host. ~140 px
// tall, never wider than ~60% of its box (height follows the file's real
// aspect ratio). Decorative: the state's one-line voice text under it says it.
// No hooks, so it renders in server components too.

interface ArtSceneProps {
  scene: SceneName;
  /** Rendered height in CSS px (§7: ~140). */
  height?: number;
  /** Widest share of the box it may take. */
  maxWidthPct?: number;
  /** Full-screen states (404, error) load eagerly. */
  priority?: boolean;
  /** Centers itself in a block box (off inside a row of other content). */
  center?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ArtScene({ scene, height = 140, maxWidthPct = 60, priority = false, center = true, className = '', style }: ArtSceneProps) {
  const name = `art-scene-${scene}` as const;
  const [w, h] = ART_SIZE[name];
  const width = Math.round((height * w) / h);
  return (
    <Image
      src={artSrc(name)}
      alt=""
      aria-hidden
      width={w}
      height={h}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      draggable={false}
      sizes={`${width}px`}
      className={`block shrink-0 ${center ? 'mx-auto' : ''} select-none pointer-events-none ${className}`}
      style={{ width, maxWidth: `${maxWidthPct}%`, height: 'auto', aspectRatio: `${w} / ${h}`, ...style }}
    />
  );
}

/** §7 empty state: the scene over its one-line voice. */
export function SceneEmptyState({ scene, line, height, className = '' }: { scene: SceneName; line: string; height?: number; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center w-full ${className}`}>
      <ArtScene scene={scene} height={height} />
      <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{line}</p>
    </div>
  );
}
