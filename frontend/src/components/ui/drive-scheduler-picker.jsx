import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// 6:00 AM – 10:00 PM in 30-minute steps
function generateTimeSlots() {
  const slots = []
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      const pad = (n) => n.toString().padStart(2, '0')
      const ampm = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 || 12
      slots.push({
        time24: `${pad(h)}:${pad(m)}`,
        time12: `${h12}:${pad(m)} ${ampm}`,
      })
    }
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

/**
 * DriveSchedulerPicker — two-panel date+time picker styled for DriveClique.
 *
 * Props
 *   selectedDate   Date | null      — currently selected date
 *   selectedTime   string           — currently selected time in "H:MM AM/PM" format
 *   onDateChange   (Date) => void   — called when user picks a date
 *   onTimeChange   (string) => void — called with "H:MM AM/PM" time string
 *   minDate        Date             — dates before this are disabled (defaults to today)
 */
export function DriveSchedulerPicker({
  selectedDate,
  selectedTime,
  onDateChange,
  onTimeChange,
  minDate,
}) {
  const now = new Date()
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth())
  const [calendarYear, setCalendarYear] = useState(now.getFullYear())
  const [timeFormat, setTimeFormat] = useState('12h')

  const min = minDate ?? now

  const isDisabled = (day) => {
    const d = new Date(calendarYear, calendarMonth, day)
    d.setHours(0, 0, 0, 0)
    const m = new Date(min)
    m.setHours(0, 0, 0, 0)
    return d < m
  }

  const isSelected = (day) => {
    if (!selectedDate) return false
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === calendarMonth &&
      selectedDate.getFullYear() === calendarYear
    )
  }

  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear((y) => y - 1) }
    else setCalendarMonth((m) => m - 1)
  }

  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear((y) => y + 1) }
    else setCalendarMonth((m) => m + 1)
  }

  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay()
  const calendarDays = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const selectedDayLabel = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Pick a date first'

  const displayTime = (slot) => (timeFormat === '24h' ? slot.time24 : slot.time12)

  return (
    <div className="flex flex-col sm:flex-row rounded-xl border border-zinc-700 overflow-hidden">

      {/* ── Calendar panel ── */}
      <div className="flex-1 bg-black p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <span className="text-sm font-medium text-white">
            {MONTH_NAMES[calendarMonth]}{' '}
            <span className="text-zinc-400">{calendarYear}</span>
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition"
          >
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] text-zinc-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="aspect-square" />
            const disabled = isDisabled(day)
            const selected = isSelected(day)
            return (
              <button
                key={day}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onDateChange(new Date(calendarYear, calendarMonth, day))}
                className={cn(
                  'aspect-square rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-center',
                  selected && 'bg-red-600 text-white shadow-lg scale-105',
                  !selected && !disabled && 'text-white hover:bg-zinc-800 hover:scale-105',
                  disabled && 'text-zinc-700 cursor-not-allowed',
                )}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Time slots panel ── */}
      <div className="w-full sm:w-52 border-t sm:border-t-0 sm:border-l border-zinc-700 bg-zinc-900 p-4 flex flex-col">
        {/* Header: selected day + 12h/24h toggle */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <span className="text-xs font-medium text-zinc-300 truncate">{selectedDayLabel}</span>
          <div className="flex shrink-0 gap-0.5 bg-zinc-800 rounded-lg p-0.5">
            {['12h', '24h'].map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setTimeFormat(fmt)}
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-md transition',
                  timeFormat === fmt
                    ? 'bg-zinc-600 text-white'
                    : 'text-zinc-400 hover:text-white',
                )}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable time slots */}
        <div className="overflow-y-auto space-y-1 max-h-52 sm:max-h-64 pr-1">
          {TIME_SLOTS.map((slot) => {
            const active = selectedTime === slot.time12
            return (
              <button
                key={slot.time24}
                type="button"
                onClick={() => onTimeChange(slot.time12)}
                className={cn(
                  'w-full py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150 text-left',
                  active
                    ? 'bg-red-600 text-white shadow'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white',
                )}
              >
                {displayTime(slot)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
