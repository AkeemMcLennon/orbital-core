import {
  differenceInDays,
  format,
  parseISO,
  addMonths,
  isAfter,
  isBefore
} from 'date-fns';

export function daysSince(date: Date | string): number {
  const targetDate = typeof date === 'string' ? parseISO(date) : date;
  return differenceInDays(new Date(), targetDate);
}

export function formatDate(date: Date | string, formatStr: string = 'yyyy-MM-dd'): string {
  const targetDate = typeof date === 'string' ? parseISO(date) : date;
  return format(targetDate, formatStr);
}

export function addMonthsToDate(date: Date | string, months: number): Date {
  const targetDate = typeof date === 'string' ? parseISO(date) : date;
  return addMonths(targetDate, months);
}

export function isDateAfter(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isAfter(d1, d2);
}

export function isDateBefore(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isBefore(d1, d2);
}
