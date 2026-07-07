import { assignRowColors, DAY_COLOR_PALETTE, computeColumnWidths } from './excelExport';

function d(y, m, day, h = 8) {
  return new Date(y, m, day, h).toISOString();
}

describe('assignRowColors', () => {
  test('returns empty array for empty input', () => {
    expect(assignRowColors([])).toEqual([]);
  });

  test('rows from the same day all get the same color', () => {
    const rows = [
      { created_at: d(2026, 6, 7, 8) },
      { created_at: d(2026, 6, 7, 10) },
      { created_at: d(2026, 6, 7, 20) },
    ];
    expect(assignRowColors(rows)).toEqual([
      DAY_COLOR_PALETTE[0],
      DAY_COLOR_PALETTE[0],
      DAY_COLOR_PALETTE[0],
    ]);
  });

  test('color advances to the next palette entry when the day changes', () => {
    const rows = [
      { created_at: d(2026, 6, 5, 8) },
      { created_at: d(2026, 6, 6, 8) },
      { created_at: d(2026, 6, 6, 9) },
      { created_at: d(2026, 6, 7, 8) },
    ];
    expect(assignRowColors(rows)).toEqual([
      DAY_COLOR_PALETTE[0],
      DAY_COLOR_PALETTE[1],
      DAY_COLOR_PALETTE[1],
      DAY_COLOR_PALETTE[2],
    ]);
  });

  test('color advances again if the same day repeats non-consecutively', () => {
    const rows = [
      { created_at: d(2026, 6, 5, 8) },
      { created_at: d(2026, 6, 6, 8) },
      { created_at: d(2026, 6, 5, 9) },
    ];
    expect(assignRowColors(rows)).toEqual([
      DAY_COLOR_PALETTE[0],
      DAY_COLOR_PALETTE[1],
      DAY_COLOR_PALETTE[2],
    ]);
  });

  test('palette wraps around after 6 distinct consecutive days', () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ created_at: d(2026, 6, i + 1, 12) }));
    const colors = assignRowColors(rows);
    expect(colors[0]).toBe(DAY_COLOR_PALETTE[0]);
    expect(colors[6]).toBe(DAY_COLOR_PALETTE[0]);
  });

  test('a row with no created_at does not throw and still gets a color', () => {
    const rows = [{ created_at: d(2026, 6, 5, 8) }, { created_at: null }];
    const colors = assignRowColors(rows);
    expect(colors).toHaveLength(2);
    expect(colors[1]).toBe(DAY_COLOR_PALETTE[1]);
  });
});

describe('computeColumnWidths', () => {
  test('uses the header length (plus padding) when it is longer than any cell', () => {
    const headers = ['תלמיד/ה ולעוד תוספת', 'עמודה קצרה מאוד'];
    const rows = [['א', 'ב']];
    const widths = computeColumnWidths(headers, rows);
    expect(widths[0]).toBe(headers[0].length + 2);
    expect(widths[1]).toBe(headers[1].length + 2);
  });

  test('uses the longest cell value (plus padding) when it exceeds the header', () => {
    const headers = ['שם'];
    const rows = [['קצר'], ['שם ארוך בהרבה יותר משם']];
    const widths = computeColumnWidths(headers, rows);
    expect(widths[0]).toBe(rows[1][0].length + 2);
  });

  test('clamps width to a minimum of 10', () => {
    const headers = ['א'];
    const rows = [['ב']];
    expect(computeColumnWidths(headers, rows)[0]).toBe(10);
  });

  test('clamps width to a maximum of 40', () => {
    const headers = ['הערות'];
    const rows = [['x'.repeat(200)]];
    expect(computeColumnWidths(headers, rows)[0]).toBe(40);
  });

  test('treats missing/empty cell values as zero-length', () => {
    const headers = ['ארוך מספיק לקבוע את הרוחב'];
    const rows = [[null], [undefined], ['']];
    expect(computeColumnWidths(headers, rows)[0]).toBe(headers[0].length + 2);
  });

  test('returns one width per header, independent of row count (including zero rows)', () => {
    const headers = ['א', 'ב', 'ג'];
    expect(computeColumnWidths(headers, [])).toHaveLength(3);
  });
});
