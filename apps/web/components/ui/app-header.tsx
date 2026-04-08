'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="6" stroke="#D97706" strokeWidth="1" opacity="0.5"/>
      <text x="10" y="14" textAnchor="middle" fill="#92400E" fontSize="10" fontWeight="900">$</text>
    </svg>
  );
}

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

  const coins = (profile as any)?.coins ?? 0;
  const shields = (profile as any)?.streak_shields ?? 0;

  return (
    <header className="flex items-center justify-between px-4 py-3">
      <Link href="/" className="flex items-center">
        <span
          className="text-xl font-black bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
          }}
        >
          SPELLSTRIKE
        </span>
      </Link>

      {profile && (
        <div className="flex items-center gap-2">
          {/* Coin pill */}
          <Link href="/shop">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 font-extrabold text-sm"
              style={{
                background: '#fef9ec',
                border: '1.5px solid #fde68a',
                borderRadius: '20px',
                color: '#92400e',
              }}
            >
              <CoinIcon className="w-4 h-4" />
              <span>{coins.toLocaleString()}</span>
            </div>
          </Link>

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
