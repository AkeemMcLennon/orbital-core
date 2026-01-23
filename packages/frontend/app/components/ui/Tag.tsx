import { cn } from '~/lib/utils/cn'

interface TagProps {
  children: React.ReactNode
  variant?: 'primary' | 'success' | 'outline' | 'default'
  className?: string
}

export default function Tag({ children, variant = 'default', className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-3 py-1 text-xs font-semibold',
        {
          'bg-primary text-white': variant === 'primary',
          'bg-success text-white': variant === 'success',
          'border border-gray-300 text-gray-700': variant === 'outline',
          'bg-gray-100 text-gray-700': variant === 'default',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
