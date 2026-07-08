export const DAY_COLOR_PALETTE = [
  'FFFFFFFF', // white
  'FFE8F0FE', // light blue
  'FFE6F4EA', // light green
  'FFFFF4E5', // light orange
  'FFF3E8FD', // light purple
  'FFFCE8E6', // light pink
];

const PAYMENT_STATUS_LABELS = {
  Confirmed: 'שולם',
  Pending: 'ממתין',
  Cancelled: 'בוטל',
};

export function paymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[status] || PAYMENT_STATUS_LABELS.Pending;
}

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

export function computeColumnWidths(headers, rows) {
  return headers.map((header, col) => {
    const maxLen = rows.reduce((max, row) => Math.max(max, String(row[col] ?? '').length), header.length);
    return Math.min(Math.max(maxLen + 2, 10), 40);
  });
}

export async function downloadExcelFile({ sheetName, headers, rows, rowColors, filename }) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: true }] });

  sheet.columns = computeColumnWidths(headers, rows).map(width => ({ width }));

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };

  rows.forEach((rowValues, i) => {
    const row = sheet.addRow(rowValues);
    const color = rowColors[i];
    if (!color) return;
    for (let col = 1; col <= headers.length; col++) {
      row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
