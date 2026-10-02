import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// FINISH_SPEC A8: every action button is the glossy candy pill
// (components/ui/candy-button.tsx; the look is globals.css `.candy*`). The
// shadcn variants map onto it — default purple, destructive pink, secondary /
// outline quiet peach; sizes default → md 40, sm → 32, lg → 52, icon → round.
// `ghost` and `link` stay flat (text-like controls), and `plain` /
// `plain-outline` keep the old flat shadcn look for anything that needs it
// (admin-style tables, the calendar's day grid).
const CANDY = ['default', 'destructive', 'secondary', 'outline'] as const;
const FLAT = ['ghost', 'link', 'plain', 'plain-outline'] as const;
const FLAT_BASE = 'rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'candy candy-purple',
        destructive: 'candy candy-pink',
        secondary: 'candy candy-peach',
        outline: 'candy candy-peach',
        ghost: `${FLAT_BASE} hover:bg-accent hover:text-accent-foreground`,
        link: `${FLAT_BASE} text-primary underline-offset-4 hover:underline`,
        plain: `${FLAT_BASE} bg-primary text-primary-foreground hover:bg-primary/90`,
        'plain-outline': `${FLAT_BASE} border border-input bg-background hover:bg-accent hover:text-accent-foreground`,
      },
      size: {
        default: '',
        sm: '',
        lg: '',
        icon: '',
      },
    },
    compoundVariants: [
      { variant: [...CANDY], size: 'default', class: 'candy-md' },
      { variant: [...CANDY], size: 'sm', class: 'candy-sm' },
      { variant: [...CANDY], size: 'icon', class: 'candy-round' },
      { variant: [...FLAT], size: 'default', class: 'h-10 px-4 py-2' },
      { variant: [...FLAT], size: 'sm', class: 'h-9 rounded-md px-3' },
      { variant: [...FLAT], size: 'lg', class: 'h-11 rounded-md px-8' },
      { variant: [...FLAT], size: 'icon', class: 'h-10 w-10' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
