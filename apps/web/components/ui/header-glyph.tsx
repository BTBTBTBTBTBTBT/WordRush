import Link from 'next/link';
import { Icon3D, type Icon3DName } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';

// Header controls (docs/FINISH_SPEC.md A3): the soft 3D icons drawn bare — no
// circle or pill behind them — 23 px tall, numbers in 17 px soft type, a full
// 44 px tap area (the control is at least 44 × 44), and the icon squish on
// press (.86 / .80, components/ui/squish-host.tsx). Used for the Home streak / shield /
// flawless counters, help, settings, back, and the game screens' home / sound
// / help. No hooks: renders in server components too.

/** The approved glyph height (px). */
export const GLYPH_SIZE = 23;
/** The approved number size (px). */
export const GLYPH_NUM_SIZE = 17;
/** The tap area (px): the control is at least this big, so neighbors never share a target. */
export const TAP = 44;

interface HeaderGlyphProps {
  icon: Icon3DName;
  /** Accessible name (the art is decorative). */
  label: string;
  /** A count beside the icon (streak, shields). */
  value?: number | string;
  onClick?: () => void;
  href?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Extra art drawn over the icon (the muted sound slash). */
  overlay?: React.ReactNode;
  iconStyle?: React.CSSProperties;
  disabled?: boolean;
  'aria-expanded'?: boolean;
  'aria-pressed'?: boolean;
}

export function HeaderGlyph({
  icon, label, value, onClick, href, size = GLYPH_SIZE, className = '', style, overlay, iconStyle, disabled, ...aria
}: HeaderGlyphProps) {
  const body = (
    <>
      <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <Icon3D name={icon} size={size} priority style={iconStyle} />
        {overlay}
      </span>
      {value != null && <SoftNum size={GLYPH_NUM_SIZE}>{value}</SoftNum>}
    </>
  );
  const cls = `hdr-glyph ${className}`;
  if (href) {
    return (
      <Link href={href} onClick={onClick} aria-label={label} className={cls} style={{ minWidth: TAP, minHeight: TAP, ...style }}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cls} style={{ minWidth: TAP, minHeight: TAP, ...style }} disabled={disabled} {...aria}>
      {body}
    </button>
  );
}
