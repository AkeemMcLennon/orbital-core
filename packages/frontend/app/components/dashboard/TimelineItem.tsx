import Avatar from '~/components/ui/Avatar'
import { formatTime } from '~/lib/utils/date'
import type { TimelineEntry } from '~/lib/api/mock'

interface TimelineItemProps {
  entry: TimelineEntry
  isLast: boolean
}

const typeIcons: Record<string, string> = {
  meeting: '☕',
  call: '☎️',
  email: '📧',
  note: '📝',
}

export default function TimelineItem({ entry, isLast }: TimelineItemProps) {
  return (
    <div className="relative flex">
      {/* Connecting line */}
      {!isLast && (
        <div
          className="absolute left-[21px] top-[45px] w-0.5"
          style={{
            bottom: '-25px',
            backgroundColor: 'var(--border-color)',
          }}
        />
      )}

      {/* Avatar */}
      <div className="z-10 pb-2">
        <Avatar name={entry.contactName} size={42} className="border-3 border-white" />
      </div>

      {/* Content Card */}
      <div
        className="ml-4 flex-1 rounded-2xl border p-4 shadow-sm"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="mb-1 flex items-baseline justify-between">
          <h4 className="font-bold text-text-main">{entry.contactName}</h4>
          <span className="text-xs text-text-muted">{formatTime(entry.timestamp)}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-lg">{typeIcons[entry.type] || '📌'}</span>
          <p className="flex-1 text-sm leading-relaxed text-text-muted">{entry.description}</p>
        </div>
      </div>
    </div>
  )
}
