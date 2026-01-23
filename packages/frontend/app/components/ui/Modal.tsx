import { useEffect, useRef } from 'react'
import { cn } from '~/lib/utils/cn'
import Button from './Button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [isOpen])

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        'rounded-card border-0 p-0 shadow-2xl backdrop:bg-black/50',
        sizeClass[size]
      )}
      style={{ backgroundColor: 'var(--bg-card)' }}
    >
      {title && (
        <div
          className="border-b px-6 py-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <h2 className="text-xl font-bold text-text-main">{title}</h2>
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && (
        <div
          className="border-t px-6 py-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {footer}
        </div>
      )}
      {!footer && (
        <div
          className="border-t px-6 py-4 text-right"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </dialog>
  )
}
