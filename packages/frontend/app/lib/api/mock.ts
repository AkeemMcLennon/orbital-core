export interface Contact {
  id: string
  name: string
  email: string
  jobTitle?: string
  company?: string
  avatarUrl?: string
  group?: 'work' | 'personal' | 'friend'
  notes?: string
  lastInteractionAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

export interface TimelineEntry {
  id: string
  contactId: string
  contactName: string
  contactAvatar?: string
  type: 'meeting' | 'call' | 'email' | 'note'
  description: string
  timestamp: Date
}

export interface QuizQuestion {
  id: string
  contactId: string
  contactName: string
  contactAvatar?: string
  context: string
  options: string[]
  correctAnswer: string
}

// Mock users
export const mockUser: User = {
  id: 'user-1',
  name: 'Alex Chen',
  email: 'alex@example.com',
}

// Mock contacts
export const mockContacts: Contact[] = [
  {
    id: 'contact-1',
    name: 'Sarah Connor',
    email: 'sarah@example.com',
    jobTitle: 'Security Consultant',
    company: 'Cyberdyne',
    group: 'work',
    notes: 'Met at tech conference',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    updatedAt: new Date(),
  },
  {
    id: 'contact-2',
    name: 'Jordan Lee',
    email: 'jordan@example.com',
    jobTitle: 'Product Manager',
    company: 'Acme Corp',
    group: 'work',
    notes: 'Connected through LinkedIn',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
    updatedAt: new Date(),
  },
  {
    id: 'contact-3',
    name: 'Morgan Kelly',
    email: 'morgan@example.com',
    jobTitle: 'Designer',
    company: 'Creative Studios',
    group: 'work',
    notes: 'Collaborated on design system',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), // 1 day ago
    updatedAt: new Date(),
  },
  {
    id: 'contact-4',
    name: 'Alex Rivera',
    email: 'alex.r@example.com',
    jobTitle: 'Developer',
    company: 'Tech Startup',
    group: 'work',
    notes: 'Friend from university',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
    updatedAt: new Date(),
  },
  {
    id: 'contact-5',
    name: 'Casey Park',
    email: 'casey@example.com',
    group: 'personal',
    notes: 'College roommate',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
    updatedAt: new Date(),
  },
  {
    id: 'contact-6',
    name: 'Taylor Brown',
    email: 'taylor@example.com',
    jobTitle: 'Marketing Manager',
    company: 'Growth Inc',
    group: 'work',
    notes: 'Met at networking event',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15), // 15 days ago
    updatedAt: new Date(),
  },
]

// Mock timeline
export const mockTimeline: TimelineEntry[] = [
  {
    id: 'event-1',
    contactId: 'contact-1',
    contactName: 'Sarah Connor',
    type: 'meeting',
    description: 'Coffee meeting at downtown café',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
  {
    id: 'event-2',
    contactId: 'contact-2',
    contactName: 'Jordan Lee',
    type: 'email',
    description: 'Sent project proposal for review',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
  {
    id: 'event-3',
    contactId: 'contact-3',
    contactName: 'Morgan Kelly',
    type: 'call',
    description: 'Discussed new design direction',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
  },
  {
    id: 'event-4',
    contactId: 'contact-4',
    contactName: 'Alex Rivera',
    type: 'note',
    description: 'Connected on social media',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
  },
  {
    id: 'event-5',
    contactId: 'contact-6',
    contactName: 'Taylor Brown',
    type: 'meeting',
    description: 'Networking lunch at tech hub',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
  },
]

// Mock quiz questions
export const mockQuizQuestions: QuizQuestion[] = [
  {
    id: 'quiz-1',
    contactId: 'contact-1',
    contactName: 'Sarah Connor',
    context: 'tech conference in San Francisco',
    options: ['Sarah Connor', 'Sara Connor', 'Sally Connor', 'Sophie Connor'],
    correctAnswer: 'Sarah Connor',
  },
  {
    id: 'quiz-2',
    contactId: 'contact-2',
    contactName: 'Jordan Lee',
    context: 'Acme Corp product team',
    options: ['Jordan Lee', 'Justin Lee', 'Jeremy Lee', 'Jerry Lee'],
    correctAnswer: 'Jordan Lee',
  },
  {
    id: 'quiz-3',
    contactId: 'contact-3',
    contactName: 'Morgan Kelly',
    context: 'design workshop last month',
    options: ['Morgan Kelly', 'Marcus Kelly', 'Michael Kelly', 'Max Kelly'],
    correctAnswer: 'Morgan Kelly',
  },
]

// Get recent contacts (for Face Stream)
export function getRecentContacts(limit: number = 10): Contact[] {
  return mockContacts
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
}

// Get quiz of the day
export function getQuizOfTheDay(): QuizQuestion {
  const dayNumber = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  const index = dayNumber % mockQuizQuestions.length
  return mockQuizQuestions[index]
}

// Get timeline for dashboard
export function getTimelineEntries(limit: number = 10): TimelineEntry[] {
  return mockTimeline
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}

// Get all contacts with optional filtering
export function getAllContacts(group?: string): Contact[] {
  if (!group) return mockContacts
  return mockContacts.filter((c) => c.group === group)
}

// Get single contact
export function getContact(id: string): Contact | undefined {
  return mockContacts.find((c) => c.id === id)
}
