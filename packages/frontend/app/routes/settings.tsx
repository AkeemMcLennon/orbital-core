import type { Route } from './+types/settings'

export function meta(_: Route.MetaArgs) {
  return [{ title: 'Settings - Orbital' }]
}

export default function Settings() {
  return (
    <div className="mx-auto max-w-container px-5 py-8">
      <h1 className="text-2xl font-bold text-text-main">Settings</h1>
      <p className="mt-2 text-text-muted">Settings coming soon...</p>
    </div>
  )
}
