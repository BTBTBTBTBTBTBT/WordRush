'use client';

import { CreditCard, Crown, Gift, Webhook, LifeBuoy } from 'lucide-react';
import { PageHeader } from '../components/admin-ui';
import { AdminTabs, useTabParam, type AdminTabDef } from '../components/admin-tabs';
import ProMembersTab from './members-tab';
import GiftsTab from './gifts-tab';
import StoreFeedTab from './feed-tab';

// admin > Monetization > Pro & Gifts: Pro & Payments + Referrals & Gifts + the
// store webhook feed. Old /admin/payments and /admin/referrals redirect here.
// The customer-service crib sheet stays above the tabs: it is the first thing
// an agent reads, whichever tab they are on.
const TABS: ReadonlyArray<AdminTabDef<'members' | 'gifts' | 'feed'>> = [
  { id: 'members', label: 'Pro members', icon: Crown },
  { id: 'gifts', label: 'Gifts', icon: Gift },
  { id: 'feed', label: 'Store feed', icon: Webhook },
];

export default function AdminProPage() {
  const [tab, setTab] = useTabParam(TABS.map((t) => t.id), 'members');
  return (
    <div className="space-y-6">
      <PageHeader title="Pro & Gifts" icon={CreditCard} subtitle="Who has Pro and through which rail, the gift-a-week invite program, and whether store purchases are arriving." />

      {/* CS crib sheet — where a request can actually be executed */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 font-medium">
        <div className="flex items-center gap-1.5 font-black uppercase tracking-wide mb-1"><LifeBuoy className="w-4 h-4" /> Handling requests</div>
        <ul className="space-y-0.5 list-disc ml-4">
          <li><b>Web (Stripe):</b> refunds and cancellations are executed in the Stripe dashboard — links on Pro members and on each user&apos;s Billing card.</li>
          <li><b>App Store / Google Play:</b> we cannot refund or cancel store purchases. Point users to the store&apos;s own flow; goodwill Pro time can be granted from their user page.</li>
          <li><b>Entitlement disputes</b> (&quot;I paid but no Pro&quot;): check the user&apos;s Billing card, then the Store feed tab — if events stopped arriving, fulfillment is the problem, not the purchase.</li>
        </ul>
      </div>

      <AdminTabs tabs={TABS} value={tab} onChange={setTab} label="Pro and gifts sections" />
      {tab === 'members' && <ProMembersTab />}
      {tab === 'gifts' && <GiftsTab />}
      {tab === 'feed' && <StoreFeedTab />}
    </div>
  );
}
