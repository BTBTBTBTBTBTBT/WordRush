import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f8f7ff' }}>
      <div className="text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-black mb-2" style={{ color: '#1a1a2e' }}>Page Not Found</h1>
        <p className="text-sm font-bold mb-6" style={{ color: '#9ca3af' }}>That word isn't in our dictionary.</p>
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
