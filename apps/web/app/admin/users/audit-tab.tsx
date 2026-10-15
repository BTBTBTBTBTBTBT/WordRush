'use client';

import { History } from 'lucide-react';
import { TabIntro, ReloadButton, Section, Empty, ErrorNote, useAdminData } from '../components/admin-ui';

// Users & Moderation > Audit log: what admins did (bans, Pro grants, flag
// changes, campaign sends, ...), newest first.
export default function AuditTab() {
  const { data, error, loading, reload } = useAdminData<{ logs: any[] }>('/api/admin/audit-log?limit=30');
  const auditLog = data?.logs ?? [];
  return (
    <div className="space-y-6">
      <TabIntro actions={<ReloadButton onClick={reload} loading={loading} />}>
        Every admin action that changes something: bans, Pro grants, feature flags and push sends.
      </TabIntro>
      {error && <ErrorNote>Could not load the audit log: {error}</ErrorNote>}
      {!data && loading && <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />}
      {data && (
        <Section title="Admin activity log" icon={History}>
          {auditLog.length === 0 ? (
            <Empty>No admin actions recorded yet.</Empty>
          ) : (
            <div className="space-y-1.5 max-h-[36rem] overflow-y-auto">
              {auditLog.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 text-xs py-2 border-b border-gray-50">
                  <div className="min-w-0">
                    <span className="font-bold text-gray-700">{entry.action}</span>
                    {entry.target_user_id && (
                      <a href={`/admin/users/${entry.target_user_id}`} className="ml-2 text-purple-600 hover:underline">
                        {entry.target_user_id.slice(0, 8)}...
                      </a>
                    )}
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <span className="ml-2 text-gray-400 break-words">{JSON.stringify(entry.details).slice(0, 60)}</span>
                    )}
                  </div>
                  <span className="text-gray-400 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
