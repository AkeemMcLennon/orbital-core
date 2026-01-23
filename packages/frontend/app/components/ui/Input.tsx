import { forwardRef, type ComponentProps } from 'react'
import { cn } from '~/lib/utils/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  suffix?: React.ReactNode
  prefix?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, suffix, prefix, className, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="mb-2 block text-sm font-medium text-text-main">{label}</label>
        )}
        <div className="relative flex items-center">
          {prefix && <div className="absolute left-3">{prefix}</div>}
          <input
            ref={ref}
            className={cn(
              'w-full rounded-lg border border-gray-300 px-4 py-2 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20',
              {
                'border-red-500 focus:border-red-500 focus:ring-red-500': error,
                'pl-10': prefix,
                'pr-10': suffix,
              },
              className
            )}
            style={{ backgroundColor: 'var(--bg-card)' }}
            {...props}
          />
          {suffix && <div className="absolute right-3">{suffix}</div>}
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
