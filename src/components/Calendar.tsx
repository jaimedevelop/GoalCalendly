import {
  addMonths,
  startOfDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
} from 'date-fns';

interface CalendarProps {
  practiceDays: string[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDayClick?: (date: Date) => void;
}

export function Calendar({ practiceDays, currentMonth, onMonthChange, onDayClick }: CalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const practiceDatesSet = new Set(practiceDays);

  const isPracticeDay = (date: Date) => {
    return practiceDatesSet.has(format(date, 'yyyy-MM-dd'));
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <button
          aria-label="Previous month"
          onClick={() => onMonthChange(addMonths(currentMonth, -1))}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          aria-label="Next month"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          →
        </button>
      </div>

      {onDayClick && <p className="text-xs text-gray-500 mb-3">Click a day to add time manually.</p>}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isPracticed = isPracticeDay(day);
          return (
            <button
              type="button"
              key={day.toString()}
              onClick={() => onDayClick?.(day)}
              disabled={!onDayClick || startOfDay(day) > startOfDay(new Date())}
              aria-label={`Add time for ${format(day, 'MMMM d, yyyy')}${isPracticed ? ', practiced' : ''}`}
              className={`
                h-10 flex items-center justify-center relative rounded-full enabled:hover:ring-2 enabled:hover:ring-blue-300 focus-visible:outline-blue-500 disabled:cursor-default
                ${!isSameMonth(day, currentMonth) ? 'text-gray-400' : 'text-gray-900'}
                ${isToday(day) ? 'font-bold' : ''}
              `}
            >
              <span className="z-10 relative">{format(day, 'd')}</span>
              {isPracticed && (
                <div className="absolute inset-1 bg-green-100 rounded-full" />
              )}
              {!isPracticed && isSameMonth(day, currentMonth) && day < new Date() && (
                <div className="absolute inset-1 bg-red-100 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
