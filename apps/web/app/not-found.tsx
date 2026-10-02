import Link from 'next/link';
import { Mascot } from '@/components/ui/mascot';
import { MASCOT_LINES, PAGE_HOSTS } from '@/lib/mascots';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="text-center">
        {/* O3, the cyclops, looked everywhere with his one big eye. */}
        <div className="flex justify-center mb-3">
          <Mascot id={PAGE_HOSTS.notFound} size={96} motion="bob" priority />
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--color-text)' }}>Page Not Found</h1>
        <p className="text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>{MASCOT_LINES.notFound}</p>
        <Link href="/">
          <button
            className="btn-3d px-6 py-2.5 rounded-xl text-white font-black text-sm"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
          >
            Back to Home
          </button>
        </Link>
      </div>
    </div>
  );
}
