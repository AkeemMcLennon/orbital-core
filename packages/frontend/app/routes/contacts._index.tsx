import { useState } from 'react'
import { data } from 'react-router'
import { Link } from 'react-router'
import ContactCard from '~/components/contacts/ContactCard'
import Button from '~/components/ui/Button'
import { getAllContacts } from '~/lib/api/mock'
import type { Route } from './+types/contacts._index'

export function meta(_: Route.MetaArgs) {
  return [{ title: 'Contacts - Orbital' }]
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const group = url.searchParams.get('group') || undefined

  const contacts = getAllContacts(group)

  return data({ contacts, group })
}

export default function ContactsList({ loaderData }: Route.ComponentProps) {
  const { contacts, group } = loaderData
  const [contactsList, setContactsList] = useState(contacts)

  const handleDelete = (id: string) => {
    setContactsList(contactsList.filter((c) => c.id !== id))
  }

  return (
    <div
      className="min-h-screen pb-20"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="mx-auto max-w-container px-5 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-main">Contacts</h1>
          <Link to="/contacts/new">
            <Button variant="primary">Add Contact</Button>
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex gap-2">
          <Link to="/contacts">
            <Button
              variant={!group ? 'primary' : 'outline'}
              size="sm"
            >
              All ({contacts.length})
            </Button>
          </Link>
          <Link to="/contacts?group=work">
            <Button
              variant={group === 'work' ? 'primary' : 'outline'}
              size="sm"
            >
              Work ({contacts.filter((c) => c.group === 'work').length})
            </Button>
          </Link>
          <Link to="/contacts?group=personal">
            <Button
              variant={group === 'personal' ? 'primary' : 'outline'}
              size="sm"
            >
              Personal ({contacts.filter((c) => c.group === 'personal').length})
            </Button>
          </Link>
        </div>

        {/* Contacts grid */}
        <div className="space-y-4">
          {contactsList.length > 0 ? (
            contactsList.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div
              className="rounded-card p-8 text-center text-text-muted"
              style={{ backgroundColor: 'var(--bg-card)' }}
            >
              No contacts found. Add your first contact to get started!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
