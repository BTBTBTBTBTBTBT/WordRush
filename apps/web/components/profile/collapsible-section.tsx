'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, badge, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        className="w-full flex items-center justify-between py-2"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className="section-header">{title}</span>
          {badge && (
            <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{badge}</span>
          )}
        </div>
        <ChevronDown
          className="w-4 h-4 transition-transform duration-200"
          style={{ color: 'var(--color-text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? '9999px' : '0px', opacity: open ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  );
}
