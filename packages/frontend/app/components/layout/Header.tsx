import { useState } from 'react'
import { Link } from 'react-router'
import Avatar from '~/components/ui/Avatar'
import Input from '~/components/ui/Input'
import Navigation from './Navigation'

interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

interface HeaderProps {
  user?: User
  onSearch?: (query: string) => void
}

export default function Header({ user, onSearch }: HeaderProps) {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    onSearch?.(e.target.value)
  }

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: 'var(--border-color)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="mx-auto max-w-container px-5 py-4">
          {/* Top row: logo + hamburger + avatar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsNavOpen(!isNavOpen)}
                className="rounded-lg p-2 hover:bg-gray-100 lg:hidden"
                aria-label="Toggle menu"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <Link to="/" className="text-xl font-bold text-primary">
                Orbital
              </Link>
            </div>

            <div className="hidden items-center gap-4 lg:flex">
              {user && (
                <Avatar
                  src={user.avatarUrl}
                  name={user.name}
                  size={32}
                  className="border-2 border-gray-200"
                />
              )}
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-3">
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full"
              prefix={
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              }
            />
          </div>
        </div>
      </header>

      {/* Navigation drawer */}
      {isNavOpen && <Navigation onClose={() => setIsNavOpen(false)} />}
    </>
  )
}
