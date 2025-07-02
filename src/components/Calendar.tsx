import React from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  isSameDay,
} from 'date-fns';

interface CalendarProps {
  practiceDays: string[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

export function Calendar({ practiceDays, currentMonth, onMonthChange }: CalendarProps) {
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
          onClick={() => onMonthChange(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => onMonthChange(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          →
        </button>
      </div>

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
            <div
              key={day.toString()}
              className={`
                h-10 flex items-center justify-center relative
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
            </div>
          );
        })}
      </div>
    </div>
  );
}