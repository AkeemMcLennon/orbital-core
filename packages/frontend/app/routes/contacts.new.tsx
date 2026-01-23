import { useNavigate } from 'react-router'
import Button from '~/components/ui/Button'
import ContactForm from '~/components/contacts/ContactForm'
import type { Route } from './+types/contacts.new'

export function meta(_: Route.MetaArgs) {
  return [{ title: 'New Contact - Orbital' }]
}

export default function NewContact() {
  const navigate = useNavigate()

  const handleSubmit = (data: any) => {
    console.log('Creating contact:', data)
    navigate('/contacts')
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

        <h1 className="mb-6 text-2xl font-bold text-text-main">Add New Contact</h1>

        <div
          className="rounded-card border p-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-color)',
          }}
        >
          <ContactForm onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  )
}
