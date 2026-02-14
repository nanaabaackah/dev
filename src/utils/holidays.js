export const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatHolidayLabel = (holiday) => `${holiday.region}: ${holiday.label}`;

const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const getNthWeekday = (year, monthIndex, weekday, occurrence) => {
  const date = new Date(year, monthIndex, 1);
  const offset = (weekday - date.getDay() + 7) % 7;
  date.setDate(1 + offset + 7 * (occurrence - 1));
  return date;
};

const getLastWeekdayBefore = (year, monthIndex, dayOfMonth, weekday) => {
  const date = new Date(year, monthIndex, dayOfMonth);
  const offset = (date.getDay() - weekday + 7) % 7;
  date.setDate(dayOfMonth - offset);
  return date;
};

export const buildHolidayList = (year) => {
  const easter = getEasterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  return [
    { date: new Date(year, 0, 1), label: "New Year's Day", region: "CA" },
    { date: goodFriday, label: "Good Friday", region: "CA" },
    { date: getLastWeekdayBefore(year, 4, 25, 1), label: "Victoria Day", region: "CA" },
    { date: new Date(year, 6, 1), label: "Canada Day", region: "CA" },
    { date: getNthWeekday(year, 8, 1, 1), label: "Labour Day", region: "CA" },
    { date: getNthWeekday(year, 9, 1, 2), label: "Thanksgiving", region: "CA" },
    { date: new Date(year, 11, 25), label: "Christmas Day", region: "CA" },
    { date: new Date(year, 11, 26), label: "Boxing Day", region: "CA" },
    { date: new Date(year, 0, 1), label: "New Year's Day", region: "GH" },
    { date: new Date(year, 2, 6), label: "Independence Day", region: "GH" },
    { date: goodFriday, label: "Good Friday", region: "GH" },
    { date: easterMonday, label: "Easter Monday", region: "GH" },
    { date: new Date(year, 4, 1), label: "May Day", region: "GH" },
    { date: new Date(year, 8, 21), label: "Founders' Day", region: "GH" },
    { date: getNthWeekday(year, 11, 5, 1), label: "Farmers' Day", region: "GH" },
    { date: new Date(year, 11, 25), label: "Christmas Day", region: "GH" },
    { date: new Date(year, 11, 26), label: "Boxing Day", region: "GH" },
  ];
};

export const buildHolidayMapForDays = (days) => {
  const years = Array.from(new Set(days.map((day) => day.date.getFullYear())));
  const holidayMap = new Map();

  years.forEach((year) => {
    buildHolidayList(year).forEach((holiday) => {
      const key = toDateKey(holiday.date);
      const list = holidayMap.get(key) || [];
      list.push(formatHolidayLabel(holiday));
      holidayMap.set(key, list);
    });
  });

  return holidayMap;
};

export const getHolidayLabelsForDate = (date) => {
  if (!date || Number.isNaN(date.getTime())) return [];
  const key = toDateKey(date);
  const holidays = buildHolidayList(date.getFullYear());
  return holidays.filter((holiday) => toDateKey(holiday.date) === key).map(formatHolidayLabel);
};

export const listUpcomingHolidays = ({ startDate = new Date(), days = 45 } = {}) => {
  if (!startDate || Number.isNaN(startDate.getTime())) return [];
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + Math.max(Number(days) || 0, 0));
  end.setHours(23, 59, 59, 999);

  const years = new Set([start.getFullYear(), end.getFullYear()]);
  const grouped = new Map();

  Array.from(years).forEach((year) => {
    buildHolidayList(year).forEach((holiday) => {
      const date = new Date(holiday.date);
      date.setHours(0, 0, 0, 0);
      if (date < start || date > end) return;
      const key = toDateKey(date);
      const existing = grouped.get(key) || {
        key,
        date,
        dateLabel: date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        labels: [],
      };
      existing.labels.push(formatHolidayLabel(holiday));
      grouped.set(key, existing);
    });
  });

  return Array.from(grouped.values()).sort((left, right) => left.date - right.date);
};
