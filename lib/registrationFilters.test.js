import { filterRegistrations } from './registrationFilters';

const baseRows = [
  {
    id: 1,
    student_name: 'דני כהן',
    parent_name: 'רותי כהן',
    parent_phone: '0501112222',
    status: 'חדש',
    instruments: ['piano'],
    teacher: 'משה לוי',
    registration_status: 'Confirmed',
  },
  {
    id: 2,
    student_name: 'יעל מזרחי',
    parent_name: 'אבי מזרחי',
    parent_phone: '0503334444',
    status: 'שובץ',
    instruments: ['guitar', 'violin'],
    teacher: 'שרה כהן',
    registration_status: 'Cancelled',
  },
  {
    id: 3,
    student_name: 'נועה לוי',
    parent_name: 'דוד לוי',
    parent_phone: '0505556666',
    status: 'שובץ',
    instruments: ['piano'],
    teacher: 'משה לוי',
    registration_status: null,
  },
];

describe('filterRegistrations', () => {
  test('returns all rows when no filters are set', () => {
    const result = filterRegistrations(baseRows, {});
    expect(result).toHaveLength(3);
  });

  test('filters by free-text search across student, parent name, and phone', () => {
    expect(filterRegistrations(baseRows, { search: 'דני' })).toEqual([baseRows[0]]);
    expect(filterRegistrations(baseRows, { search: 'אבי' })).toEqual([baseRows[1]]);
    expect(filterRegistrations(baseRows, { search: '0505556666' })).toEqual([baseRows[2]]);
  });

  test('filters by status', () => {
    const result = filterRegistrations(baseRows, { status: 'שובץ' });
    expect(result.map((r) => r.id)).toEqual([2, 3]);
  });

  test('filters by instrument code, checking the instruments array', () => {
    const result = filterRegistrations(baseRows, { instrument: 'piano' });
    expect(result.map((r) => r.id)).toEqual([1, 3]);
  });

  test('filters by teacher exact match', () => {
    const result = filterRegistrations(baseRows, { teacher: 'משה לוי' });
    expect(result.map((r) => r.id)).toEqual([1, 3]);
  });

  test('filters by payment status, treating missing registration_status as Pending', () => {
    expect(filterRegistrations(baseRows, { payment: 'Confirmed' }).map((r) => r.id)).toEqual([1]);
    expect(filterRegistrations(baseRows, { payment: 'Cancelled' }).map((r) => r.id)).toEqual([2]);
    expect(filterRegistrations(baseRows, { payment: 'Pending' }).map((r) => r.id)).toEqual([3]);
  });

  test('combines multiple filters with AND logic', () => {
    const result = filterRegistrations(baseRows, { status: 'שובץ', instrument: 'piano' });
    expect(result.map((r) => r.id)).toEqual([3]);
  });

  test('returns empty array when no row matches all filters', () => {
    const result = filterRegistrations(baseRows, { status: 'חדש', teacher: 'שרה כהן' });
    expect(result).toEqual([]);
  });
});
