'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f8f7ff' }}>
      <div className="text-center">
        <div className="text-5xl mb-4">😵</div>
        <h1 className="text-2xl font-black mb-2" style={{ color: '#1a1a2e' }}>Something went wrong</h1>
        <p className="text-sm font-bold mb-6" style={{ color: '#9ca3af' }}>Don't worry, your streak is safe.</p>
        <button
          onClick={reset}
          className="btn-3d px-6 py-2.5 rounded-xl text-white font-black text-sm"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
