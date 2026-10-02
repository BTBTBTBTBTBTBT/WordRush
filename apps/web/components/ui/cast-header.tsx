'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { CAST, mascotSrc, type MascotId } from '@/lib/mascots';
import { CAST_FIRST_MOVE, CAST_MOVES, castAspect, castTrimLayout, nextCastDelay, pickCastMove } from '@/lib/cast-moves';
import { prefersReducedMotion } from '@/lib/motion';
import { Icon3D } from '@/components/ui/icon3d';

// The living cast header (docs/FINISH_SPEC.md A5, option A; mockup
// game-kit.html §5 `.castrow`): the ten cast heroes (/mascots/<id>.png) as
// separate images in a row spelling WORDOCIOUS, edge to edge, each trimmed to
// its art box so all ten stand at one height. Every 2.6–5 s ONE random
// character (never the same twice in a row) plays its personality move
// (lib/cast-moves.ts; keyframes in globals.css `.cm.act-*`). Off with Reduce
// Motion (OS or the in-app toggle) and while the tab is hidden. Decorative:
// aria-hidden, never takes a tap. Pro: W wears the 3D crown.
// The cold-start intro (components/providers/cold-start-intro.tsx) glides into
// the row marked `data-cast-row`.

export function CastHeader({ crown = false, className = '', style }: { crown?: boolean; className?: string; style?: React.CSSProperties }) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let last: MascotId | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const row = rowRef.current;
      if (row && document.visibilityState === 'visible' && !prefersReducedMotion()) {
        const id = pickCastMove(last);
        last = id;
        const el = row.querySelector<HTMLElement>(`[data-cast="${id}"]`);
        const cls = CAST_MOVES[id].cls;
        if (el) {
          el.classList.remove(cls);
          void el.offsetWidth;
          el.classList.add(cls);
          el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
        }
      }
      timer = setTimeout(tick, nextCastDelay());
    };
    timer = setTimeout(tick, CAST_FIRST_MOVE);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={rowRef}
      aria-hidden="true"
      data-cast-row=""
      className={`castrow pointer-events-none select-none ${className}`}
      style={{ paddingTop: crown ? '5%' : 4, ...style }}
    >
      {CAST.map((id) => {
        const aspect = castAspect(id);
        const trim = castTrimLayout(id);
        return (
          <span
            key={id}
            data-cast={id}
            className="cm"
            style={{ flex: `${aspect.toFixed(3)} 1 0`, aspectRatio: `${aspect.toFixed(4)}` }}
          >
            <Image
              src={mascotSrc(id)}
              alt=""
              width={512}
              height={512}
              priority
              draggable={false}
              sizes="20vw"
              style={{ width: trim.width, height: 'auto', left: trim.left, top: trim.top }}
            />
            {crown && id === 'w' && (
              <Icon3D
                name="crown"
                size={24}
                priority
                className="absolute left-1/2"
                style={{ width: '48%', height: 'auto', aspectRatio: '1 / 1', top: '-30%', transform: 'translateX(-50%) rotate(-8deg)', filter: 'drop-shadow(0 1px 1px rgba(146, 64, 14, 0.3))' }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
