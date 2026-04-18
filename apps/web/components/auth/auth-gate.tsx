'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import { LoginScreen } from './login-screen';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';

const PUBLIC_PATHS = ['/privacy', '/terms', '/support', '/auth/callback'];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    ensureDictionaryInitialized();
  }, []);

  // Let public pages through without auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  // Branded loading spinner while checking auth
  if (loading) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ backgroundColor: '#f8f7ff' }}
      >
        <h1
          className="text-2xl font-black tracking-tight animate-pulse"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          WORDOCIOUS
        </h1>
      </div>
    );
  }

  // Not authenticated — show login screen
  if (!user) {
    return <LoginScreen />;
  }

  // Authenticated — render app
  return <>{children}</>;
}
