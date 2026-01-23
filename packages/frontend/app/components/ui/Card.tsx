import { cn } from '~/lib/utils/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn('rounded-card border border-gray-200 shadow-sm', className)}
      style={{ backgroundColor: 'var(--bg-card)' }}
    >
      {children}
    </div>
  )
}
