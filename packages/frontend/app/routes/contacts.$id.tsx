import { useState } from 'react'
import { useNavigate } from 'react-router'
import Avatar from '~/components/ui/Avatar'
import Button from '~/components/ui/Button'
import ContactForm from '~/components/contacts/ContactForm'
import Modal from '~/components/ui/Modal'
import Tag from '~/components/ui/Tag'
import { getContact } from '~/lib/api/mock'
import { formatRelativeTime } from '~/lib/utils/date'
import type { Route } from './+types/contacts.$id'

export function meta({ params }: Route.MetaArgs) {
  return [{ title: 'Contact - Orbital' }]
}

export async function loader({ params }: Route.LoaderArgs) {
  const contact = getContact(params.id!)
  if (!contact) {
    throw new Response('Contact not found', { status: 404 })
  }
  return { contact }
}

export default function ContactDetail({ loaderData }: Route.ComponentProps) {
  const { contact } = loaderData
  const navigate = useNavigate()
  const [isEditOpen, setIsEditOpen] = useState(false)

  const handleEdit = (data: any) => {
    console.log('Editing contact:', data)
    setIsEditOpen(false)
    // In a real app, this would save to backend
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this contact?')) {
      navigate('/contacts')
    }
  }

  return (
    <div
      className="min-h-screen pb-20"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="mx-auto max-w-container px-5 py-6">
        {/* Back button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/contacts')}
          className="mb-6"
        >
          ← Back to Contacts
        </Button>

        {/* Contact header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <Avatar name={contact.name} size={120} className="border-4 border-gray-100" />

          <div>
            <h1 className="text-3xl font-bold text-text-main">{contact.name}</h1>
            {contact.jobTitle && (
              <p className="mt-1 text-lg text-text-muted">{contact.jobTitle}</p>
            )}
            {contact.company && (
              <p className="text-sm text-text-muted">{contact.company}</p>
            )}
          </div>

          {contact.group && <Tag variant="outline">{contact.group}</Tag>}
        </div>

        {/* Contact details */}
        <div
          className="mt-6 rounded-card border p-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="space-y-4">
            {contact.email && (
              <div>
                <p className="text-sm text-text-muted">Email</p>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-primary hover:underline"
                >
                  {contact.email}
                </a>
              </div>
            )}

            {contact.notes && (
              <div>
                <p className="text-sm text-text-muted">Notes</p>
                <p className="text-text-main">{contact.notes}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-text-muted">Added</p>
              <p className="text-text-main">{formatRelativeTime(contact.createdAt)}</p>
            </div>

            {contact.lastInteractionAt && (
              <div>
                <p className="text-sm text-text-muted">Last interaction</p>
                <p className="text-text-main">
                  {formatRelativeTime(contact.lastInteractionAt)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex gap-3">
          <Button variant="primary" onClick={() => setIsEditOpen(true)}>
            Edit
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {/* Edit modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Contact"
      >
        <ContactForm contact={contact} onSubmit={handleEdit} />
      </Modal>
    </div>
  )
}
