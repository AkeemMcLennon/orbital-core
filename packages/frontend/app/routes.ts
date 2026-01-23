import { type RouteConfig, index, layout, route } from '@react-router/dev/routes'

export default [
  // Public routes
  route('login', 'routes/login.tsx'),

  // Protected routes (nested under _authenticated layout)
  layout('routes/_authenticated.tsx', [
    index('routes/_index.tsx'), // Dashboard
    route('contacts', 'routes/contacts._index.tsx'),
    route('contacts/new', 'routes/contacts.new.tsx'),
    route('contacts/:id', 'routes/contacts.$id.tsx'),
    route('settings', 'routes/settings.tsx'),
  ]),
] satisfies RouteConfig
