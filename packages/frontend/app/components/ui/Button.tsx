import { cn } from '~/lib/utils/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'success' | 'danger' | 'default'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export default function Button({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50',
        {
          'bg-primary text-white hover:bg-primary-dark': variant === 'primary',
          'border-2 border-primary text-primary hover:bg-primary-light': variant === 'outline',
          'bg-success text-white': variant === 'success',
          'bg-red-500 text-white': variant === 'danger',
          'bg-gray-100 text-gray-700 hover:bg-gray-200': variant === 'default',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-base': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
