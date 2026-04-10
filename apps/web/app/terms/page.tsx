'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: '#f8f7ff' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to SpellStrike
        </Link>

        <h1 className="text-3xl font-black mb-1" style={{ color: '#1a1a2e' }}>Terms of Service</h1>
        <p className="text-xs font-bold mb-6" style={{ color: '#9ca3af' }}>Effective April 10, 2026</p>

        <div className="space-y-4">
          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Agreement to Terms</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              By accessing or using SpellStrike (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. We reserve the right to update these terms at any time, and continued use of SpellStrike constitutes acceptance of any changes.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Eligibility</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              You must be at least <strong>13 years of age</strong> to create an account and use SpellStrike. By using the Service, you represent and warrant that you meet this age requirement. If you are under 18, you confirm that you have the consent of a parent or legal guardian.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Your Account</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              You are responsible for maintaining the security of your account and all activity that occurs under it. You agree to choose an appropriate username and not impersonate others. We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Acceptable Use</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: '#6b7280' }}>
              When using SpellStrike, you agree <strong>not</strong> to:
            </p>
            <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: '#6b7280' }}>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Use automated tools, bots, scripts, or any form of cheating to gain an unfair advantage</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Exploit bugs or vulnerabilities instead of reporting them</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Harass, threaten, or abuse other players</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Use offensive, hateful, or inappropriate usernames</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Attempt to access other users&apos; accounts or private data</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Interfere with or disrupt the Service or its infrastructure</span></li>
            </ul>
            <p className="text-xs leading-relaxed mt-3" style={{ color: '#6b7280' }}>
              Violation of these rules may result in temporary or permanent suspension of your account.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Free Tier &amp; Pro Subscription</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: '#6b7280' }}>
              SpellStrike is free to play. We also offer an optional <strong>Pro subscription</strong> that unlocks additional features and game modes.
            </p>
            <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: '#6b7280' }}>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Pro subscriptions are billed through <strong>Stripe</strong>, our payment processor. By subscribing, you agree to Stripe&apos;s terms of service.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>You may <strong>cancel your subscription at any time</strong>. Upon cancellation, you will retain Pro access through the end of your current billing period.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Subscription prices may change with advance notice. Existing subscribers will be notified before any price change takes effect.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Refund requests are handled on a case-by-case basis. Contact us if you believe you were charged in error.</span></li>
            </ul>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Intellectual Property</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              All content, design, graphics, and code that make up SpellStrike are owned by us and protected by applicable intellectual property laws. You may not copy, modify, distribute, or reverse-engineer any part of the Service without our written permission.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Disclaimer of Warranties</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              SpellStrike is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or free of harmful components.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Limitation of Liability</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              To the fullest extent permitted by law, SpellStrike and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service, including loss of data or game progress.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Termination</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              We reserve the right to suspend or terminate your account at any time for violations of these terms or for any other reason at our discretion. You may also delete your account at any time through your profile settings.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Contact Us</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:legal@spellstrike.com" className="font-bold" style={{ color: '#7c3aed' }}>legal@spellstrike.com</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
