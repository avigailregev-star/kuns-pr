export const DAY_COLOR_PALETTE = [
  'FFFFFFFF', // white
  'FFE8F0FE', // light blue
  'FFE6F4EA', // light green
  'FFFFF4E5', // light orange
  'FFF3E8FD', // light purple
  'FFFCE8E6', // light pink
];

function dayKey(createdAt) {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return String(createdAt);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function assignRowColors(rows) {
  const colors = [];
  let colorIndex = 0;
  let prevKey = null;
  for (const row of rows) {
    const key = dayKey(row.created_at);
    if (prevKey !== null && key !== prevKey) {
      colorIndex = (colorIndex + 1) % DAY_COLOR_PALETTE.length;
    }
    colors.push(DAY_COLOR_PALETTE[colorIndex]);
    prevKey = key;
  }
  return colors;
}
