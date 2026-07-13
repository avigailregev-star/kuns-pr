import { POST } from './route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('../../auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('../../../../lib/googleSheets', () => ({
  replaceExportSheet: jest.fn(),
}));

import { getServerSession } from 'next-auth';
import { replaceExportSheet } from '../../../../lib/googleSheets';

function makeRequest(body) {
  return { json: async () => body };
}

describe('POST /api/registrations/export-to-sheet', () => {
  test('rejects with 401 when there is no session', async () => {
    getServerSession.mockResolvedValue(null);

    const res = await POST(makeRequest({ headers: ['א'], rows: [] }));

    expect(res.status).toBe(401);
    expect(replaceExportSheet).not.toHaveBeenCalled();
  });

  test('rejects with 400 when headers or rows are missing', async () => {
    getServerSession.mockResolvedValue({ user: { name: 'admin' } });

    const res = await POST(makeRequest({ headers: ['א'] }));

    expect(res.status).toBe(400);
    expect(replaceExportSheet).not.toHaveBeenCalled();
  });

  test('calls replaceExportSheet with the request body and returns success', async () => {
    getServerSession.mockResolvedValue({ user: { name: 'admin' } });
    replaceExportSheet.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ headers: ['תאריך'], rows: [['01/01/2026']] }));
    const json = await res.json();

    expect(replaceExportSheet).toHaveBeenCalledWith({ headers: ['תאריך'], rows: [['01/01/2026']] });
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  test('returns 500 with the error message when replaceExportSheet throws', async () => {
    getServerSession.mockResolvedValue({ user: { name: 'admin' } });
    replaceExportSheet.mockRejectedValue(new Error('permission denied'));

    const res = await POST(makeRequest({ headers: ['א'], rows: [] }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toContain('permission denied');
  });
});
