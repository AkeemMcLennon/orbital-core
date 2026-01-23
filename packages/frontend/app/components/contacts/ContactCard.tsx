import { Link } from 'react-router'
import Avatar from '~/components/ui/Avatar'
import Button from '~/components/ui/Button'
import Tag from '~/components/ui/Tag'
import type { Contact } from '~/lib/api/mock'

interface ContactCardProps {
  contact: Contact
  onDelete?: (id: string) => void
}

export default function ContactCard({ contact, onDelete }: ContactCardProps) {
  return (
    <div
      className="rounded-card border p-4 shadow-sm"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex items-start gap-4">
        <Avatar name={contact.name} size={56} className="border-2 border-gray-100" />

        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-text-main">{contact.name}</h3>
              {contact.jobTitle && (
                <p className="text-sm text-text-muted">{contact.jobTitle}</p>
              )}
              {contact.company && (
                <p className="text-xs text-text-muted">{contact.company}</p>
              )}
            </div>
            {contact.group && (
              <Tag variant="outline" className="ml-2">
                {contact.group}
              </Tag>
            )}
          </div>

          {contact.notes && (
            <p className="mt-2 text-sm text-text-muted">{contact.notes}</p>
          )}

          {contact.email && (
            <p className="mt-2 text-xs text-primary hover:underline">
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <Link to={`/contacts/${contact.id}`}>
              <Button variant="outline" size="sm">
                View
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete?.(contact.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
