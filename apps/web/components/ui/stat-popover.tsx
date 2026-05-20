'use client';

import { useEffect, useRef } from 'react';

interface StatPopoverProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function StatPopover({ open, onClose, children }: StatPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }

    // Delay listener so the opening click doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          ref={ref}
          className="absolute right-0 top-full mt-2 z-50 animate-fade-in-scale"
          style={{
            width: '240px',
          }}
        >
          {/* Arrow */}
          <div
            className="absolute -top-1.5 right-6"
            style={{
              width: '12px',
              height: '12px',
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRight: 'none',
              borderBottom: 'none',
              transform: 'rotate(45deg)',
            }}
          />

          {/* Card */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRadius: '14px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
              padding: '14px 16px',
              position: 'relative',
            }}
          >
            {children}
          </div>
        </div>
      )}
    </>
  );
}
