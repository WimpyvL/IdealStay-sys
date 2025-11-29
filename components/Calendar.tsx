import React, { useState, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons/Icons';
import './Calendar.css';

interface CalendarProps {
  checkIn: Date | null;
  checkOut: Date | null;
  onDateSelect: (date: Date) => void;
  onClear: () => void;
  // Optional predicate to disable dates (e.g., booked dates). If returns true => date disabled
  isDateDisabled?: (date: Date) => boolean;
}

const Calendar: React.FC<CalendarProps> = ({ checkIn, checkOut, onDateSelect, onClear, isDateDisabled }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      grid.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push(new Date(year, month, i));
    }

    return grid;
  }, [currentDate]);

  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const today = new Date();
  today.setHours(0,0,0,0);

  return (
    <div className="calendar">
      <div className="calendar__header">
        <button onClick={handlePrevMonth} className="calendar__nav-button" aria-label="Previous month">
          <ChevronLeftIcon />
        </button>
        <div className="calendar__month-year">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </div>
        <button onClick={handleNextMonth} className="calendar__nav-button" aria-label="Next month">
          <ChevronRightIcon />
        </button>
      </div>

      <div className="calendar__days-of-week">
        {daysOfWeek.map(day => <div key={day}>{day}</div>)}
      </div>

      <div className="calendar__grid">
        {calendarGrid.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="calendar__day--empty"></div>;
          
          const isToday = isSameDay(date, today);
          const isCheckIn = checkIn && isSameDay(date, checkIn);
          const isCheckOut = checkOut && isSameDay(date, checkOut);
          const isInRange = checkIn && checkOut && date > checkIn && date < checkOut;
          // Base disabled rule (past dates) + external predicate
          const externallyDisabled = isDateDisabled ? isDateDisabled(date) : false;
          const isDisabled = date < today || externallyDisabled;

          const classNames = [
            'calendar__day',
            isToday ? 'calendar__day--today' : '',
            isCheckIn ? 'calendar__day--check-in' : '',
            isCheckOut ? 'calendar__day--check-out' : '',
            isInRange ? 'calendar__day--in-range' : '',
            isDisabled ? 'calendar__day--disabled' : '',
            externallyDisabled ? 'calendar__day--booked' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={date.toISOString()}
              className={classNames}
              onClick={() => onDateSelect(date)}
              disabled={isDisabled}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="calendar__footer">
        <button className="calendar__clear-button" onClick={onClear}>Clear Dates</button>
      </div>
    </div>
  );
};

export default Calendar;