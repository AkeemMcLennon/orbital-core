import { Link } from 'react-router'
import Avatar from '~/components/ui/Avatar'
import { getDaysSince } from '~/lib/utils/date'
import type { Contact } from '~/lib/api/mock'

interface FaceStreamProps {
  contacts: Contact[]
}

export default function FaceStream({ contacts }: FaceStreamProps) {
  return (
    <div className="hide-scrollbar smooth-scroll flex gap-4 overflow-x-auto px-5 py-4">
      {/* Add Contact Button */}
      <Link
        to="/contacts"
        className="flex min-w-[68px] flex-col items-center transition-all active:scale-95"
      >
        <div
          className="mb-1.5 flex h-[60px] w-[60px] items-center justify-center rounded-full text-white shadow-md"
          style={{ backgroundColor: 'var(--text-main)' }}
        >
          <span className="text-2xl">+</span>
        </div>
        <span className="text-xs font-medium text-text-main">Add</span>
      </Link>

      {/* Contact Faces */}
      {contacts.map((contact) => (
        <Link
          key={contact.id}
          to={`/contacts/${contact.id}`}
          className="flex min-w-[68px] flex-col items-center transition-all active:scale-95"
        >
          <div className="relative mb-1.5">
            <Avatar name={contact.name} size={60} className="border-2 border-white" />
            {/* Green dot indicator for recent contacts (created < 24h ago) */}
            {getDaysSince(contact.createdAt) < 1 && (
              <div
                className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white"
                style={{ backgroundColor: 'var(--success)' }}
              />
            )}
          </div>
          <span className="text-center text-xs font-medium text-text-main">
            {contact.name.split(' ')[0]}
          </span>
        </Link>
      ))}
    </div>
  )
}
