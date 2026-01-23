import type { Route } from './+types/login'

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Login - Orbital' },
    { name: 'description', content: 'Sign in to your relationship manager' },
  ]
}

export default function Login() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-md rounded-card p-8 shadow"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <h1 className="text-2xl font-bold text-text-main">Sign In</h1>
        <p className="mt-2 text-text-muted">Login coming soon...</p>
      </div>
    </div>
  )
}
