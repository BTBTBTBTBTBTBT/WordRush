import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPageLayout, SectionCard } from '@/components/ui/info-page';
import { SOFT_INK } from '@/lib/soft-surface';

export const metadata: Metadata = {
  title: 'Delete your Wordocious account',
  description:
    'How to permanently delete your Wordocious account and what data is removed or kept.',
};

/**
 * Public account-deletion page — required by Google Play.
 *
 * Play's Data safety form takes a "Delete account URL" and validates it. It
 * rejected https://wordocious.com/settings, and correctly: the console states
 * the link must name the app, prominently show the STEPS to request deletion,
 * and specify what data is deleted or kept plus any retention period. The
 * settings page is a signed-in control surface, not an explanation, and a
 * reviewer hitting it signed-out sees nothing at all.
 *
 * Deliberately a server component with no auth gate: Play's reviewer opens
 * this URL without an account, so anything behind a session check fails review.
 * The actual deletion still requires being signed in — this page explains and
 * links to it.
 *
 * The table below is generated from the real endpoint
 * (app/api/account/delete/route.ts). If that endpoint changes, change this.
 */
const DELETED = [
  ['Profile', 'Username, avatar, bio, social links, accent color, favorite mode'],
  ['Game statistics', 'Every mode’s wins, losses, streaks, best times and averages'],
  ['Daily results', 'All daily puzzle results and their leaderboard entries'],
  ['Medals', 'Gold, silver and bronze daily medals'],
  ['Achievements', 'Every unlocked achievement'],
  ['Purchase records', 'Your record of Pro purchases and subscription status'],
  ['Notification tokens', 'The device tokens used to send you push notifications'],
  ['Uploaded images', 'Your avatar and any share images generated from your games'],
  ['Login credentials', 'Your email address, password and any linked Google or Apple sign-in'],
];

export default function DeleteAccountPage() {
  return (
    <InfoPageLayout title="Delete Account" art="art-titlecast-deleteaccount">
        <SectionCard accent="#7c3aed" heading="Deleting your Wordocious account">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Wordocious is published by ShowLoud, LLC. You can permanently delete your
            account and its data at any time, from the app or from this website. Deletion
            is immediate and cannot be undone.
          </p>
        </SectionCard>

        <SectionCard accent="#7c3aed" heading="How to delete your account">
          <ol className="text-xs leading-relaxed space-y-2.5" style={{ color: 'var(--color-text-secondary)' }}>
            <li className="flex gap-2.5">
              <span className="font-black" style={{ color: SOFT_INK.value }}>1.</span>
              <span>Sign in to Wordocious — in the Android or iOS app, or at{' '}
                <Link href="/" className="underline" style={{ color: SOFT_INK.value }}>wordocious.com</Link>.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-black" style={{ color: SOFT_INK.value }}>2.</span>
              <span>Open <strong>Settings</strong> (the gear icon in the top-right of the home screen).</span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-black" style={{ color: SOFT_INK.value }}>3.</span>
              <span>Scroll to the <strong>Account</strong> section and tap <strong>Delete Account</strong>.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-black" style={{ color: SOFT_INK.value }}>4.</span>
              <span>Confirm. Your account and the data below are removed immediately.</span>
            </li>
          </ol>
          <p className="text-xs leading-relaxed mt-4" style={{ color: 'var(--color-text-muted)' }}>
            Can’t sign in? Email <a href="mailto:support@wordocious.com" className="underline" style={{ color: SOFT_INK.value }}>support@wordocious.com</a>{' '}
            from the address on the account and we will delete it for you.
          </p>
        </SectionCard>

        <SectionCard accent="#7c3aed" heading="What is deleted">
          <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            {DELETED.map(([label, detail]) => (
              <li key={label} className="flex gap-2">
                <span style={{ color: SOFT_INK.value }}>&#8226;</span>
                <span><strong>{label}</strong> &mdash; {detail}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard accent="#7c3aed" heading="What is kept, and for how long">
          <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            <li className="flex gap-2">
              <span style={{ color: SOFT_INK.value }}>&#8226;</span>
              <span><strong>Head-to-head match records</strong> &mdash; a completed VS match belongs to two players, so the match result is kept for your opponent. Your name is removed from it and it no longer links to you.</span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: SOFT_INK.value }}>&#8226;</span>
              <span><strong>Payment records</strong> &mdash; Apple, Google and Stripe keep their own transaction records for tax and accounting purposes, for as long as the law requires. We cannot delete those on your behalf; contact the store you purchased through.</span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: SOFT_INK.value }}>&#8226;</span>
              <span><strong>Crash reports</strong> &mdash; anonymous diagnostic reports already sent are retained for up to <strong>90 days</strong> and then deleted automatically.</span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: SOFT_INK.value }}>&#8226;</span>
              <span><strong>Backups</strong> &mdash; encrypted database backups roll off within <strong>30 days</strong>. Deleted data may persist in a backup until then, and is never restored to a live account.</span>
            </li>
          </ul>
        </SectionCard>

        <SectionCard accent="#e11d48" heading={<span style={{ color: 'var(--color-loss-text)' }}>Cancel your subscription first</span>}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Deleting your Wordocious account does <strong>not</strong> cancel an active Pro
            subscription, because the subscription is held by the app store, not by us.
            Cancel it in your <strong>Google Play</strong> or <strong>Apple Account</strong>{' '}
            subscription settings — or, if you subscribed on the website, through the
            billing portal — before deleting your account.
          </p>
        </SectionCard>

        <p className="text-xs font-bold text-center" style={{ color: 'var(--color-text-muted)' }}>
          See our <Link href="/privacy" className="underline" style={{ color: SOFT_INK.value }}>Privacy Policy</Link> for
          how we handle data generally.
        </p>
    </InfoPageLayout>
  );
}
