import { useState } from 'react'
import Button from '~/components/ui/Button'
import Input from '~/components/ui/Input'
import type { Contact } from '~/lib/api/mock'

interface ContactFormProps {
  contact?: Contact
  onSubmit: (data: Partial<Contact>) => void
  isLoading?: boolean
}

export default function ContactForm({ contact, onSubmit, isLoading }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: contact?.name || '',
    email: contact?.email || '',
    jobTitle: contact?.jobTitle || '',
    company: contact?.company || '',
    group: contact?.group || 'personal',
    notes: contact?.notes || '',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name *"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
      />

      <Input
        label="Email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
      />

      <Input
        label="Job Title"
        name="jobTitle"
        value={formData.jobTitle}
        onChange={handleChange}
      />

      <Input
        label="Company"
        name="company"
        value={formData.company}
        onChange={handleChange}
      />

      <div>
        <label className="mb-2 block text-sm font-medium text-text-main">Group</label>
        <select
          name="group"
          value={formData.group}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20"
          style={{ backgroundColor: 'var(--bg-card)' }}
        >
          <option value="personal">Personal</option>
          <option value="work">Work</option>
          <option value="friend">Friend</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-text-main">Notes</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={4}
          placeholder="Add any notes about this person..."
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20"
          style={{ backgroundColor: 'var(--bg-card)' }}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Contact'}
        </Button>
      </div>
    </form>
  )
}
