'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

/**
 * The portal's one tab row for merged pages. The active tab lives in the URL
 * (`?tab=`), so every tab is deep-linkable and the old single-page URLs can
 * redirect straight to the right one. Pages render ONLY the active tab's
 * component, so each tab fetches its own data when opened (a merged page never
 * loads every tab's API at once). The look matches the Social Studio switcher.
 */
export interface AdminTabDef<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Small count after the label (a queue length, a banned total). */
  count?: number | null;
}

export function useTabParam<T extends string>(ids: readonly T[], fallback: T): [T, (t: T) => void] {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const fromUrl = (): T => {
    const t = params?.get('tab');
    return (ids as readonly string[]).includes(t ?? '') ? (t as T) : fallback;
  };
  const [tab, setTabState] = useState<T>(fromUrl);
  const urlTab = params?.get('tab') ?? '';
  // A sidebar click or a pasted link changes the URL under us: follow it.
  useEffect(() => { setTabState(fromUrl()); }, [urlTab]); // eslint-disable-line react-hooks/exhaustive-deps
  const setTab = useCallback((next: T) => {
    setTabState(next);
    const sp = new URLSearchParams(params?.toString() ?? '');
    if (next === fallback) sp.delete('tab'); else sp.set('tab', next);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [fallback, params, pathname, router]);
  return [tab, setTab];
}

export function AdminTabs<T extends string>({ tabs, value, onChange, label = 'Sections' }: {
  tabs: ReadonlyArray<AdminTabDef<T>>;
  value: T;
  onChange: (t: T) => void;
  label?: string;
}) {
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="inline-flex rounded-xl bg-white shadow-sm p-1" role="tablist" aria-label={label}>
        {tabs.map(({ id, label: text, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={value === id}
            onClick={() => onChange(id)}
            className={`h-9 shrink-0 rounded-lg px-3.5 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap ${value === id ? 'bg-purple-600 text-white' : 'text-purple-700 hover:bg-purple-50'}`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {text}
            {count != null && <span className={`tabular-nums ${value === id ? 'text-purple-200' : 'text-purple-400'}`}>{count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
