interface ChipProps {
  label: string
  tone: string
}

/** Small inline tag used for categories and people in the panel rows. */
export function Chip({ label, tone }: ChipProps) {
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium whitespace-nowrap ${tone}`}>
      {label}
    </span>
  )
}

interface PickerProps<T extends string> {
  label: string
  options: Record<T, string>
  value: T
  onChange: (value: T) => void
  columns?: 2 | 3 | 4
}

/** Button-grid picker — used for category, assignee and attendee selection. */
export function Picker<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 3,
}: PickerProps<T>) {
  const gridClass =
    columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-4' : 'grid-cols-3'

  return (
    // A fieldset/legend names the whole group for a screen reader. A bare
    // <label> cannot: it points at one control, and this is a set of them.
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-1">{label}</legend>
      <div className={`grid ${gridClass} gap-2`}>
        {(Object.entries(options) as [T, string][]).map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            aria-pressed={value === optionValue}
            onClick={() => onChange(optionValue)}
            className={`rounded-lg border py-2 px-1 text-sm font-medium transition-colors min-h-[44px] ${
              value === optionValue
                ? 'border-lime-500 bg-lime-50 text-lime-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
