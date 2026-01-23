import { cn } from '~/lib/utils/cn'
import { getAvatarUrl } from '~/lib/utils/avatar'

interface AvatarProps {
  src?: string | null
  name: string
  size?: number
  className?: string
}

export default function Avatar({ src, name, size = 40, className }: AvatarProps) {
  const avatarUrl = src || getAvatarUrl(name)

  return (
    <img
      src={avatarUrl}
      alt={name}
      className={cn('rounded-full object-cover', className)}
      style={{ width: size, height: size }}
    />
  )
}
