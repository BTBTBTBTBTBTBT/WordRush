'use client';

import { Webhook, Activity } from 'lucide-react';
import { useDrill } from '../components/drill-panel';
import { TabIntro, ReloadButton, Section, ErrorNote, Empty, LoadingGrid, useAdminData } from '../components/admin-ui';

// Pro & Gifts > Store feed: the Apple / Google notification ledger. The one
// place for it (it used to be on Payments and on Ops Health).
interface FeedData {
  recent: { event_id: string; source: string; processed_at: string }[];
  byDay: { day: string; appstore: number; playstore: number }[];
}

export default function StoreFeedTab() {
  const drill = useDrill();
  const { data, error, loading, reload } = useAdminData<FeedData>('/api/admin/store-feed');
  return (
    <div className="space-y-6">
      <TabIntro actions={<ReloadButton onClick={reload} loading={loading} />}>
        Apple and Google purchase notifications as they arrive. If a user says &quot;I paid but have no Pro&quot; and nothing has landed here for a while, fulfillment is the problem, not the purchase.
      </TabIntro>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && loading && <LoadingGrid tiles={2} />}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section
            title="Store webhooks by day"
            icon={Webhook}
            note="The ledger records processed events only: a failing webhook shows up as silence here while subscriptions are active, not as an error row."
          >
            {data.byDay.length === 0 ? (
              <Empty>No webhook events recorded in the last 14 days.</Empty>
            ) : (
              <div className="space-y-1">
                {data.byDay.slice(0, 14).map((d) => (
                  <button type="button" key={d.day} onClick={() => drill({ metric: 'webhooks', day: d.day })}
                    className="w-full flex justify-between text-sm hover:bg-gray-50 rounded px-1 -mx-1 py-0.5">
                    <span className="font-bold text-gray-500">{d.day}</span>
                    <span className="font-black text-gray-900">{d.appstore} App Store · {d.playstore} Play</span>
                  </button>
                ))}
              </div>
            )}
          </Section>
          <Section title="Latest events" icon={Activity}>
            {data.recent.length === 0 ? (
              <Empty>No store notifications received yet.</Empty>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {data.recent.map((e) => (
                  <div key={e.event_id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50">
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${e.source === 'appstore' ? 'text-gray-700 bg-gray-100' : 'text-green-700 bg-green-50'}`}>{e.source}</span>
                    <span className="font-mono text-gray-500 text-[10px] truncate">{e.event_id}</span>
                    <span className="ml-auto text-gray-400 whitespace-nowrap">{new Date(e.processed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
