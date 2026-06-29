import { cn } from '@/lib/utils';
import Image from 'next/image';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function Avatar({ name, avatarUrl, size = 'md', className }: AvatarProps) {
  const sizeClass = SIZES[size];

  if (avatarUrl) {
    return (
      <div className={cn('relative rounded-full overflow-hidden flex-shrink-0', sizeClass, className)}>
        <Image src={avatarUrl} alt={name} fill className="object-cover" />
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-full bg-brand-light text-brand font-semibold flex items-center justify-center flex-shrink-0',
      sizeClass, className
    )}>
      {getInitials(name)}
    </div>
  );
}
