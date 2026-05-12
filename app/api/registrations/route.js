import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('registrations')
      .select('*, message_log(action, sent_at, status)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch registrations error:', error.message);
      return NextResponse.json({ error: 'שגיאה בשליפת נתונים' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Registrations API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  const PAYMENT_STATUS_MAP = { Pending: 'ממתין לתשלום', Confirmed: 'שולם', Cancelled: 'בוטל' };

  try {
    const { id, admin_notes, registration_status } = await request.json();
    const updateData = { updated_at: new Date().toISOString() };
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
    if (registration_status !== undefined) updateData.registration_status = registration_status;
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('registrations')
      .update(updateData)
      .eq('id', id);

    if (error) return NextResponse.json({ error: 'שגיאה' }, { status: 500 });

    // Sync payment status to students table in the attendance app
    if (registration_status !== undefined) {
      const hebrewStatus = PAYMENT_STATUS_MAP[registration_status];
      if (hebrewStatus) {
        const { data: reg } = await supabase
          .from('registrations').select('student_name').eq('id', id).single();
        if (reg?.student_name) {
          const studentUpdate = { registration_status: hebrewStatus };
          if (registration_status === 'Cancelled') studentUpdate.is_active = false;
          await supabase.from('students').update(studentUpdate).eq('name', reg.student_name);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
