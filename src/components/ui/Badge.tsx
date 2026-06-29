import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_COLORS, CHANNEL_COLORS } from '@/lib/utils';
import { ContentStatus, Channel } from '@/types';

interface BadgeProps {
  label: string;
  className?: string;
  dot?: boolean;
}

export function Badge({ label, className, dot = true }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-[5px] px-[10px] py-[2px] rounded-full text-[11px] font-semibold tracking-[0.3px]',
      className
    )}>
      {dot && (
        <span className="w-[5px] h-[5px] rounded-full bg-current flex-shrink-0" />
      )}
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <Badge label={STATUS_LABELS[status] ?? status} className={STATUS_COLORS[status]} />
  );
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <Badge label={channel} className={CHANNEL_COLORS[channel]} dot={false} />
  );
}
