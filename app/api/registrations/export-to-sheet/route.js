import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { replaceExportSheet } from '../../../../lib/googleSheets';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const { headers, rows } = await request.json();
    if (!Array.isArray(headers) || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'חסרים headers/rows' }, { status: 400 });
    }

    await replaceExportSheet({ headers, rows });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
