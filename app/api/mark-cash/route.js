import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';

export async function POST(request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 });

    const supabase = getSupabaseClient();

    const { data: reg } = await supabase
      .from('registrations')
      .select('admin_notes')
      .eq('id', id)
      .single();

    const existing = reg?.admin_notes;
    const cashNote = 'נרשם ומתכנן לשלם במזומן';
    const newNotes = existing ? `${existing} | ${cashNote}` : cashNote;

    const { error } = await supabase
      .from('registrations')
      .update({ admin_notes: newNotes })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
