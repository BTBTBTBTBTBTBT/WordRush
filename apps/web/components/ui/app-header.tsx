'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ProBadge } from '@/components/ui/pro-badge';

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L3 5.5V10C3 14.5 6 17.5 10 19C14 17.5 17 14.5 17 10V5.5L10 2Z" fill="#A78BFA" stroke="#8B5CF6" strokeWidth="1"/>
      <path d="M8.5 10.5L9.5 11.5L12 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function AppHeader() {
  const { profile } = useAuth();

  const shields = (profile as any)?.streak_shields ?? 0;
  const isPro = (profile as any)?.is_pro ?? false;

  return (
    <header className="flex items-center justify-between px-4 py-3">
      <Link href="/" className="flex items-center gap-1.5">
        <span
          className="text-xl font-black bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
          }}
        >
          SPELLSTRIKE
        </span>
        {isPro && <ProBadge size="sm" />}
      </Link>

      {profile && (
        <div className="flex items-center gap-2">
          {/* Shield pill */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 font-extrabold text-sm"
            style={{
              background: '#f3f0ff',
              border: '1.5px solid #c4b5fd',
              borderRadius: '20px',
              color: '#5b21b6',
            }}
          >
            <ShieldIcon className="w-4 h-4" />
            <span>{shields}</span>
          </div>
        </div>
      )}
    </header>
  );
}
