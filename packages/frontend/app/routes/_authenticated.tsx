import { Outlet } from 'react-router'
import Header from '~/components/layout/Header'
import { mockUser } from '~/lib/api/mock'
import type { Route } from './+types/_authenticated'

export default function AuthenticatedLayout(_: Route.ComponentProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <Header user={mockUser} />
      <Outlet />
    </div>
  )
}
