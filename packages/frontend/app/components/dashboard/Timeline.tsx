import TimelineItem from './TimelineItem'
import { formatTime } from '~/lib/utils/date'
import type { TimelineEntry } from '~/lib/api/mock'

interface TimelineProps {
  items: TimelineEntry[]
}

export default function Timeline({ items }: TimelineProps) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-card p-6 text-center text-text-muted"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        No recent interactions
      </div>
    )
  }

  // Group by date
  const grouped = groupByDate(items)

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([dateLabel, entries]) => (
        <div key={dateLabel}>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">
            {dateLabel}
          </h3>
          <div className="space-y-4">
            {entries.map((entry, index) => (
              <TimelineItem
                key={entry.id}
                entry={entry}
                isLast={index === entries.length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function groupByDate(items: TimelineEntry[]): Record<string, TimelineEntry[]> {
  const groups: Record<string, TimelineEntry[]> = {}
  const now = new Date()

  items.forEach((item) => {
    const date = new Date(item.timestamp)
    const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    let label: string
    if (daysDiff === 0) label = 'Today'
    else if (daysDiff === 1) label = 'Yesterday'
    else if (daysDiff < 7) label = `${daysDiff} days ago`
    else label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  })

  return groups
}
