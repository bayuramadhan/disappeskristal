import { cn } from '@/lib/utils'

type Channel = 'PREORDER' | 'HOTLINE' | 'CANVAS' | 'ADMIN_INPUT'

const channelConfig: Record<Channel, { label: string; className: string }> = {
  PREORDER:    { label: 'PreOrder',    className: 'bg-violet-100 text-violet-700' },
  HOTLINE:     { label: 'Hotline',     className: 'bg-orange-100 text-orange-700' },
  CANVAS:      { label: 'Canvas',      className: 'bg-teal-100 text-teal-700' },
  ADMIN_INPUT: { label: 'Admin Input', className: 'bg-gray-100 text-gray-700' },
}

export function ChannelTag({ channel }: { channel: string }) {
  const cfg = channelConfig[channel as Channel] ?? { label: channel, className: 'bg-gray-100 text-gray-700' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}
