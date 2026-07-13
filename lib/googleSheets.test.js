jest.mock('google-spreadsheet', () => ({
  GoogleSpreadsheet: jest.fn(),
}));
jest.mock('google-auth-library', () => ({
  JWT: jest.fn(),
}));

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { replaceExportSheet } from './googleSheets';

function makeSheet(callOrder) {
  return {
    clear: jest.fn().mockImplementation(async () => { callOrder.push('clear'); }),
    setHeaderRow: jest.fn().mockImplementation(async () => { callOrder.push('setHeaderRow'); }),
    addRows: jest.fn().mockImplementation(async () => { callOrder.push('addRows'); }),
  };
}

beforeEach(() => {
  process.env.GOOGLE_EXPORT_SHEET_ID = 'export-sheet-id';
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'bot@example.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = 'fake-key';
  GoogleSpreadsheet.mockReset();
});

describe('replaceExportSheet', () => {
  test('connects to GOOGLE_EXPORT_SHEET_ID (not GOOGLE_SHEET_ID)', async () => {
    const callOrder = [];
    const sheet = makeSheet(callOrder);
    const doc = { loadInfo: jest.fn().mockResolvedValue(undefined), sheetsByIndex: [sheet] };
    GoogleSpreadsheet.mockImplementation(() => doc);

    await replaceExportSheet({ headers: ['א'], rows: [['1']] });

    expect(GoogleSpreadsheet).toHaveBeenCalledWith('export-sheet-id', expect.anything());
  });

  test('clears the sheet, then writes the header row, then writes the data rows, in that order', async () => {
    const callOrder = [];
    const sheet = makeSheet(callOrder);
    const doc = { loadInfo: jest.fn().mockResolvedValue(undefined), sheetsByIndex: [sheet] };
    GoogleSpreadsheet.mockImplementation(() => doc);

    await replaceExportSheet({ headers: ['תאריך', 'תלמיד/ה'], rows: [['01/01/2026', 'יוסי כהן']] });

    expect(callOrder).toEqual(['clear', 'setHeaderRow', 'addRows']);
    expect(sheet.setHeaderRow).toHaveBeenCalledWith(['תאריך', 'תלמיד/ה']);
    expect(sheet.addRows).toHaveBeenCalledWith([['01/01/2026', 'יוסי כהן']]);
  });

  test('writes just the header row when there are no data rows', async () => {
    const callOrder = [];
    const sheet = makeSheet(callOrder);
    const doc = { loadInfo: jest.fn().mockResolvedValue(undefined), sheetsByIndex: [sheet] };
    GoogleSpreadsheet.mockImplementation(() => doc);

    await replaceExportSheet({ headers: ['תאריך'], rows: [] });

    expect(sheet.addRows).toHaveBeenCalledWith([]);
  });

  test('propagates errors from the Google Sheets API instead of swallowing them', async () => {
    const doc = { loadInfo: jest.fn().mockRejectedValue(new Error('permission denied')), sheetsByIndex: [] };
    GoogleSpreadsheet.mockImplementation(() => doc);

    await expect(replaceExportSheet({ headers: [], rows: [] })).rejects.toThrow('permission denied');
  });
});
