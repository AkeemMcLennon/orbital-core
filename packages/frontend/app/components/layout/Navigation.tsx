import { Link } from 'react-router'

interface NavigationProps {
  onClose: () => void
}

export default function Navigation({ onClose }: NavigationProps) {
  const links = [
    { href: '/', label: 'Dashboard', icon: '🏠' },
    { href: '/contacts', label: 'Contacts', icon: '👥' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <nav
      className="fixed inset-0 top-24 z-30 w-full overflow-y-auto lg:hidden"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="space-y-2 px-5 py-4">
        {links.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-lg font-medium text-text-main hover:bg-gray-100"
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
