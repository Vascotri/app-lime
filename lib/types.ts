export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'

/** Who a task is for, or who is attending an event. */
export type Person = 'vasco' | 'jennifer' | 'both'
export type Assignee = Person
export type Attendee = Person

export type ShoppingCategory = 'groceries' | 'home' | 'kids' | 'other'

export type TaskCategory =
  | 'home' | 'kids' | 'personal' | 'car' | 'dog' | 'travel' | 'gifts' | 'other'

export type EventCategory = 'home' | 'kids' | 'personal' | 'work' | 'other'

export interface CalendarEvent {
  id: string
  title: string
  start_at: string       // ISO string
  end_at: string | null
  all_day: boolean
  recurrence: Recurrence
  category: EventCategory
  attendees: Attendee
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
  category: TaskCategory
  due_date: string | null  // YYYY-MM-DD
  completed_at: string | null
  created_by: string
  created_at: string
}

export interface ShoppingItem {
  id: string
  name: string
  category: ShoppingCategory
  quantity: string | null
  checked_at: string | null
  added_by: string
  created_at: string
}

/*
 * Label maps double as the source of order in the pickers, so the key order
 * here is the order the buttons appear. "Other" is deliberately last.
 */

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  groceries: 'Groceries',
  home: 'Home',
  kids: 'Kids',
  other: 'Other',
}

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  home: 'Home',
  kids: 'Kids',
  personal: 'Personal',
  car: 'Car',
  dog: 'Dog',
  travel: 'Travel',
  gifts: 'Gifts',
  other: 'Other',
}

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  home: 'Home',
  kids: 'Kids',
  personal: 'Personal',
  work: 'Work',
  other: 'Other',
}

export const PERSON_LABELS: Record<Person, string> = {
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

/*
 * Chip styling.
 *
 * Category chips are a solid fill; person chips are a lighter fill with a ring.
 * The difference is structural, not just hue, so the two kinds stay tellable
 * apart when they sit side by side — and without relying on colour alone.
 */

const CATEGORY_TONES: Record<string, string> = {
  home: 'bg-amber-100 text-amber-800',
  kids: 'bg-teal-100 text-teal-800',
  personal: 'bg-rose-100 text-rose-800',
  car: 'bg-slate-200 text-slate-700',
  dog: 'bg-orange-100 text-orange-800',
  travel: 'bg-emerald-100 text-emerald-800',
  gifts: 'bg-pink-100 text-pink-800',
  work: 'bg-indigo-100 text-indigo-800',
  other: 'bg-gray-100 text-gray-600',
}

export function categoryTone(category: string): string {
  return CATEGORY_TONES[category] ?? CATEGORY_TONES.other
}

export const PERSON_TONES: Record<Person, string> = {
  vasco: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  jennifer: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  both: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200',
}

/** Left accent bar on a calendar row, keyed by event category. */
export const EVENT_CATEGORY_BARS: Record<EventCategory, string> = {
  home: 'bg-amber-400',
  kids: 'bg-teal-400',
  personal: 'bg-rose-400',
  work: 'bg-indigo-400',
  other: 'bg-gray-300',
}

export const ALLOWED_EMAILS = [
  'vascomoreira93@gmail.com',
  'jennifer.dias423@gmail.com',
]

export const EMAIL_TO_NAME: Record<string, string> = {
  'vascomoreira93@gmail.com': 'Vasco',
  'jennifer.dias423@gmail.com': 'Jennifer',
}
