export interface Contact {
  id: string;
  name: string;
  avatar: string;
  isNew?: boolean;
}

export interface TimelineItem {
  id: string;
  contactName: string;
  avatar: string;
  time: string;
  description: string;
  type: 'interaction' | 'action' | 'event';
}

// Sample directory contacts for the "Face Stream" horizontal list
export const directoryContacts: Contact[] = [
  {
    id: '1',
    name: 'Alice',
    avatar: 'https://ui-avatars.com/api/?name=Alice&background=4F46E5&color=fff',
  },
  {
    id: '2',
    name: 'Bob',
    avatar: 'https://ui-avatars.com/api/?name=Bob&background=10B981&color=fff',
    isNew: true,
  },
  {
    id: '3',
    name: 'Carol',
    avatar: 'https://ui-avatars.com/api/?name=Carol&background=F59E0B&color=fff',
  },
  {
    id: '4',
    name: 'David',
    avatar: 'https://ui-avatars.com/api/?name=David&background=EF4444&color=fff',
  },
  {
    id: '5',
    name: 'Emma',
    avatar: 'https://ui-avatars.com/api/?name=Emma&background=8B5CF6&color=fff',
    isNew: true,
  },
  {
    id: '6',
    name: 'Frank',
    avatar: 'https://ui-avatars.com/api/?name=Frank&background=06B6D4&color=fff',
  },
];

// Sample timeline items for the vertical timeline
export const timelineItems: TimelineItem[] = [
  {
    id: '1',
    contactName: 'Sarah Chen',
    avatar: 'https://ui-avatars.com/api/?name=Sarah+Chen&background=4F46E5&color=fff',
    time: '2 hours ago',
    description: 'Had coffee and discussed the new product roadmap',
    type: 'interaction',
  },
  {
    id: '2',
    contactName: 'James Wilson',
    avatar: 'https://ui-avatars.com/api/?name=James+Wilson&background=10B981&color=fff',
    time: '1 day ago',
    description: 'Sent the proposal for review',
    type: 'action',
  },
  {
    id: '3',
    contactName: 'Maria Garcia',
    avatar: 'https://ui-avatars.com/api/?name=Maria+Garcia&background=F59E0B&color=fff',
    time: '3 days ago',
    description: 'Birthday celebration next week',
    type: 'event',
  },
  {
    id: '4',
    contactName: 'Alex Thompson',
    avatar: 'https://ui-avatars.com/api/?name=Alex+Thompson&background=EF4444&color=fff',
    time: '1 week ago',
    description: 'Connected on LinkedIn',
    type: 'interaction',
  },
  {
    id: '5',
    contactName: 'Nicole Lee',
    avatar: 'https://ui-avatars.com/api/?name=Nicole+Lee&background=8B5CF6&color=fff',
    time: '2 weeks ago',
    description: 'Follow up on partnership discussion',
    type: 'action',
  },
];

// Mock search results for the Add Contact modal
export const searchResults: Contact[] = [
  {
    id: '101',
    name: 'John Smith',
    avatar: 'https://ui-avatars.com/api/?name=John+Smith&background=4F46E5&color=fff',
  },
  {
    id: '102',
    name: 'Jane Doe',
    avatar: 'https://ui-avatars.com/api/?name=Jane+Doe&background=10B981&color=fff',
  },
  {
    id: '103',
    name: 'Jack Johnson',
    avatar: 'https://ui-avatars.com/api/?name=Jack+Johnson&background=F59E0B&color=fff',
  },
];
