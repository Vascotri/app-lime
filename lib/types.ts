export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'

export type Category = 'groceries' | 'home' | 'kids' | 'other'

export type Assignee = 'vasco' | 'jennifer' | 'both'

export interface CalendarEvent {
  id: string
  title: string
  start_at: string       // ISO string
  end_at: string | null
  all_day: boolean
  recurrence: Recurrence
  notes: string | null
  created_by: string
  created_at: string
  // virtual — only present on expanded recurring instances
  instance_date?: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  assigned_to: Assignee
  due_date: string | null  // YYYY-MM-DD
  completed_at: string | null
  created_by: string
  created_at: string
}

export interface ShoppingItem {
  id: string
  name: string
  category: Category
  quantity: string | null
  checked_at: string | null
  added_by: string
  created_at: string
}

export const CATEGORY_LABELS: Record<Category, string> = {
  groceries: 'Groceries',
  home: 'Home',
  kids: 'Kids',
  other: 'Other',
}

export const ASSIGNEE_LABELS: Record<Assignee, string> = {
  vasco: 'Vasco',
  jennifer: 'Jennifer',
  both: 'Both',
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekdays: 'Every weekday (Mon–Fri)',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
}

export const ALLOWED_EMAILS = [
  'vascomoreira93@gmail.com',
  'jennifer.dias423@gmail.com',
]

export const EMAIL_TO_NAME: Record<string, string> = {
  'vascomoreira93@gmail.com': 'Vasco',
  'jennifer.dias423@gmail.com': 'Jennifer',
}
