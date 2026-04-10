'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: -4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-full mt-2 z-50"
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
              background: '#ffffff',
              border: '1.5px solid #ede9f6',
              borderRight: 'none',
              borderBottom: 'none',
              transform: 'rotate(45deg)',
            }}
          />

          {/* Card */}
          <div
            style={{
              background: '#ffffff',
              border: '1.5px solid #ede9f6',
              borderRadius: '14px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
              padding: '14px 16px',
              position: 'relative',
            }}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
