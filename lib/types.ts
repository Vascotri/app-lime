export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'

/** Who a task is for, or who is attending an event. */
export type Person = 'vasco' | 'jennifer' | 'both'
export type Assignee = Person
export type Attendee = Person

export type ShoppingCategory =
  | 'groceries' | 'home' | 'kids' | 'pharmacy' | 'gifts' | 'dog' | 'other'

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
  // virtual — only present on expanded recurring instances
  instance_date?: string
  /**
   * This instance belongs to a repeating series. Set when the series rule
   * itself isn't available — Google expands instances server-side and keeps
   * the rule on the parent event.
   */
  recurring?: boolean
  /**
   * Which calendar this came from. 'family' events are ours to manage;
   * 'personal' ones are read-only — the app holds only read scope on them and
   * must never offer to edit or delete something it cannot touch.
   */
  origin?: 'family' | 'personal'
  /**
   * Details withheld because the event belongs to the other person and is
   * marked private or confidential. Redaction happens server-side, so the real
   * title never reaches the browser.
   */
  busy?: boolean
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
  pharmacy: 'Pharmacy',
  gifts: 'Gifts',
  dog: 'Dog',
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
  vasco: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  jennifer: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  both: 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-300',
}

/**
 * Left accent bar on a calendar row, keyed by WHO — not by category.
 *
 * Google Calendar can only colour an event one way, and we use it for the
 * assignee, since "who is doing the school run" is the question this calendar
 * exists to answer. The bar matches that colour so the app and Google read the
 * same way; category stays a labelled chip, which needs no colour to be clear.
 */
export const PERSON_BARS: Record<Person, string> = {
  vasco: 'bg-green-500',
  jennifer: 'bg-blue-500',
  both: 'bg-yellow-400',
}

/**
 * Google Calendar event colour IDs.
 * Reference: Basil = 10 (green), Peacock = 7 (blue), Banana = 5 (yellow).
 */
export const PERSON_GOOGLE_COLOR_IDS: Record<Person, string> = {
  vasco: '10',
  jennifer: '7',
  both: '5',
}

export const ALLOWED_EMAILS = [
  'vascomoreira93@gmail.com',
  'jennifer.dias423@gmail.com',
]

export const EMAIL_TO_NAME: Record<string, string> = {
  'vascomoreira93@gmail.com': 'Vasco',
  'jennifer.dias423@gmail.com': 'Jennifer',
}
