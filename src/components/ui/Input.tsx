import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

// Matches design system: h-9, border-gray-300, focus ring magenta, font-size 13px
const baseClass = [
  'w-full h-9 px-3',
  'font-sans text-[13px] text-gray-800 placeholder-gray-400',
  'bg-white border border-gray-300 rounded-btn',
  'outline-none transition-all duration-150',
  'hover:border-gray-400',
  'focus:border-brand focus:shadow-[0_0_0_3px_rgba(187,38,73,0.1)]',
  'disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed',
].join(' ');

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseClass, className)} {...props} />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={3}
      className={cn(
        baseClass.replace('h-9 ', ''),
        'h-auto py-2 resize-none',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        baseClass,
        'bg-white cursor-pointer appearance-none',
        'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23A1A1AA\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")]',
        'bg-no-repeat bg-[right_10px_center]',
        'pr-8',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';
