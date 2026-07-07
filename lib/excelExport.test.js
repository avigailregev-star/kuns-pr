import { assignRowColors, DAY_COLOR_PALETTE } from './excelExport';

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
