'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';
import { candyClass } from '@/components/ui/candy-button';
import { toastSurface } from '@/components/ui/toast';

type ToasterProps = React.ComponentProps<typeof Sonner>;

// The sonner toaster in the same K1 look as components/ui/toaster.tsx: a
// tinted brand card (never white), Nunito Black title, candy action buttons.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        style: { ...toastSurface('default'), borderRadius: 20, color: 'var(--color-text)' },
        classNames: {
          toast: 'group toast',
          title: 'font-black',
          description: 'group-[.toast]:text-muted-foreground font-bold',
          actionButton: candyClass({ color: 'purple', size: 'sm' }),
          cancelButton: candyClass({ color: 'peach', size: 'sm' }),
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
