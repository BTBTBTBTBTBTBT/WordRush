'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Wordocious
        </Link>

        <h1 className="text-3xl font-black mb-1 text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>Privacy Policy</h1>
        <p className="text-xs font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>Effective April 14, 2026</p>

        <div className="space-y-4">
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Introduction</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Wordocious (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is a word puzzle game. We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains what information we collect, how we use it, and your rights regarding that information.
            </p>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Information We Collect</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              When you create an account or use Wordocious, we may collect the following information:
            </p>
            <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Email address</strong> &mdash; provided during sign-up or via Google OAuth</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Username / display name</strong> &mdash; chosen by you when creating your profile</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Game statistics</strong> &mdash; scores, win/loss records, completion times, and performance data across all game modes</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Streak data</strong> &mdash; daily streak counts and history</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Device and usage information</strong> &mdash; browser type, general usage patterns, and anonymous analytics to help us improve the app</span></li>
            </ul>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>How We Use Your Information</h2>
            <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>To create and manage your Wordocious account</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>To track your game progress, streaks, and statistics</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>To display leaderboards and records</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>To improve and maintain the app experience</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>To communicate important updates about the service</span></li>
            </ul>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Third-Party Services</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Wordocious relies on the following trusted third-party services to operate:
            </p>
            <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Supabase</strong> &mdash; used for user authentication and secure data storage. Your account data and game statistics are stored in Supabase&apos;s infrastructure.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Vercel</strong> &mdash; used for web hosting and serving the Wordocious application.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Google OAuth</strong> &mdash; available as a sign-in option. When you sign in with Google, we receive your email address and display name from Google. We do not access any other Google account data.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Google AdSense</strong> &mdash; used to display advertisements to free-tier users. Ad-related data collection is governed by Google&apos;s privacy policies. Pro subscribers are not shown ads.</span></li>
            </ul>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Advertising &amp; Data Sharing</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Wordocious displays interstitial advertisements to free-tier users before game sessions. These ads are served by Google AdSense and are subject to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#7c3aed' }}>Google&apos;s Privacy Policy</a>. Pro subscribers enjoy a completely ad-free experience. We do <strong>not</strong> sell, rent, or share your personal data with third parties for marketing purposes beyond what is necessary for ad delivery.
            </p>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Data Security</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              We take reasonable measures to protect your personal information. Authentication is handled securely through Supabase, and all data is transmitted over encrypted connections (HTTPS). However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Your Rights</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              You may request access to, correction of, or deletion of your personal data at any time. You can delete your account through your profile settings or by contacting us directly. Upon account deletion, your personal data will be removed from our systems.
            </p>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Children&apos;s Privacy</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Wordocious is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal data, please contact us so we can remove it.
            </p>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Changes to This Policy</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. Continued use of Wordocious after changes are posted constitutes acceptance of the revised policy.
            </p>
          </div>

          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Contact Us</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              If you have any questions or concerns about this Privacy Policy or your personal data, please contact us at{' '}
              <a href="mailto:privacy@wordocious.com" className="font-bold" style={{ color: '#7c3aed' }}>privacy@wordocious.com</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
