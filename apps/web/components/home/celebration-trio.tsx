import { ART_SIZE, artSrc } from '@/lib/art';

// Founder 10-09 (iOS CelebrationTrio): the Flawless banner's celebrating cast, alive. Three cheer poses (D, O, I) on one floor
// under a small bunting, each bouncing, swaying and squashing on its own offset beat; the bunting sways a touch from its
// center and four gold sparkles twinkle. All CSS (transform + opacity), so a frame never touches React; Reduce Motion (OS or
// the in-app toggle) holds the same scene still. The box is a size container, so everything scales with the slot it fills.

const CAST = ['d', 'o2', 'i'] as const;
/** The figure's side: 74% of the slot's height, and never so wide that the three overlap the slot's edges. */
const FIG = 'min(74cqh, calc(100cqw / 3.2))';
const SPARKLES: ReadonlyArray<readonly [number, number]> = [[0.22, 0.30], [0.78, 0.26], [0.35, 0.12], [0.66, 0.10]];

export function CelebrationTrio({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div aria-hidden="true" className={`trio relative ${className}`} style={{ containerType: 'size', ...style }}>
      {/* the bunting, swaying a touch from its top center */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/age-check/bunting.webp" alt="" width={209} height={116} draggable={false}
        className="trio-bunting absolute select-none pointer-events-none"
        style={{ width: 'min(40cqw, 150px)', height: '30cqh', objectFit: 'contain', left: '50%', top: '2cqh', marginLeft: 'calc(min(40cqw, 150px) / -2)' }}
      />
      {/* one shared floor shadow */}
      <span
        className="absolute"
        style={{
          left: '50%', width: `calc(${FIG} * 3.2)`, marginLeft: `calc(${FIG} * -1.6)`, bottom: -1, height: 14,
          background: 'radial-gradient(ellipse at center, rgba(46, 16, 101, 0.28), rgba(46, 16, 101, 0) 70%)',
        }}
      />
      {CAST.map((id, i) => {
        const name = `art-pose-${id}-cheer` as const;
        return (
          <span
            key={id}
            className="absolute"
            style={{ width: FIG, height: FIG, bottom: 4, left: '50%', marginLeft: `calc(${FIG} * ${(i - 1) * 0.95 - 0.5})` }}
          >
            <span className="trio-bounce block" style={{ width: '100%', height: '100%', animationDelay: `${(-i * 0.9) / 2.2}s` }}>
              <span className="trio-sway block" style={{ width: '100%', height: '100%', animationDelay: `${(-i * 0.9) / 1.7}s` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={artSrc(name)} alt="" width={ART_SIZE[name][0]} height={ART_SIZE[name][1]} draggable={false}
                  className="select-none pointer-events-none" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </span>
            </span>
          </span>
        );
      })}
      {SPARKLES.map(([x, y], k) => (
        <svg
          key={k} viewBox="0 0 20 20" width={9} height={9} className="trio-sparkle absolute"
          style={{ left: `calc(${x * 100}% - 4.5px)`, top: `calc(${y * 100}% - 4.5px)`, animationDelay: `${-k / 1.9}s` }}
        >
          <path d="M10 0 C11 6 14 9 20 10 C14 11 11 14 10 20 C9 14 6 11 0 10 C6 9 9 6 10 0 Z" fill="#f5a524" />
          <path d="M10 4 C10.6 7.4 12.6 9.4 16 10 C12.6 10.6 10.6 12.6 10 16 C9.4 12.6 7.4 10.6 4 10 C7.4 9.4 9.4 7.4 10 4 Z" fill="#ffe7a3" />
        </svg>
      ))}
    </div>
  );
}
