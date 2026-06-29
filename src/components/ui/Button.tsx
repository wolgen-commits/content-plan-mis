import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

const VARIANTS = {
  primary:   'bg-brand text-white border border-brand hover:bg-brand-hover hover:border-brand-hover disabled:opacity-40',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-40',
  ghost:     'bg-transparent text-gray-600 border border-transparent hover:bg-gray-100 hover:text-gray-800 disabled:opacity-40',
  danger:    'bg-danger text-white border border-danger hover:bg-red-700 disabled:opacity-40',
  success:   'bg-success text-white border border-success hover:bg-green-700 disabled:opacity-40',
};

const SIZES = {
  sm:   'h-7 px-3 text-xs gap-1.5',
  md:   'h-9 px-4 text-[13px] gap-1.5',
  lg:   'h-11 px-6 text-[15px] gap-2',
  icon: 'h-9 w-9 px-0 text-[13px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary', size = 'md', loading, disabled, className, children, ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center font-medium rounded-btn transition-all duration-150 whitespace-nowrap',
      'disabled:cursor-not-allowed',
      VARIANTS[variant], SIZES[size], className
    )}
    {...props}
  >
    {loading && (
      <svg className="animate-spin h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    )}
    {children}
  </button>
));
Button.displayName = 'Button';
