import { format, formatDistanceToNow } from 'date-fns'

export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - dateObj.getTime()
  const hours = diff / (1000 * 60 * 60)

  if (hours < 24) {
    return format(dateObj, 'h:mm a')
  } else if (hours < 48) {
    return 'Yesterday'
  } else {
    return format(dateObj, 'MMM d')
  }
}

export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(dateObj, { addSuffix: true })
}

export function getDaysSince(date: Date | string): number {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24))
}
