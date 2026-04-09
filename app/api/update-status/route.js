import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';
import { sendToMake } from '../../../lib/makeWebhook';

export async function POST(request) {
  // Auth guard
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, newStatus, teacher, assignedDay, assignedTime, adminNotes, groupId } = body;

    if (!id || !newStatus) {
      return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Build update object
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (teacher !== undefined) updateData.teacher = teacher;
    if (assignedDay !== undefined) updateData.assigned_day = assignedDay;
    if (assignedTime !== undefined) updateData.assigned_time = assignedTime;
    if (adminNotes !== undefined) updateData.admin_notes = adminNotes;
    if (body.orchestra !== undefined) updateData.orchestra = body.orchestra;
    if (body.theoryDay !== undefined) updateData.theory_day = body.theoryDay;

    const { error: updateError } = await supabase
      .from('registrations')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Update error:', updateError.message);
      return NextResponse.json({ error: 'שגיאה בעדכון' }, { status: 500 });
    }

    // Log message
    await supabase.from('message_log').insert([
      {
        registration_id: id,
        action: `status_changed_to_${newStatus}`,
        status: 'pending',
      },
    ]);

    // If assigned, notify Make
    if (newStatus === 'שובץ') {
      const { data: reg } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', id)
        .single();

      if (reg) {
        await sendToMake('assigned', {
          registrationId: id,
          studentName: reg.student_name,
          parentName: reg.parent_name,
          parentPhone: reg.parent_phone,
          parentEmail: reg.parent_email,
          teacher: teacher || reg.teacher,
          assignedDay: assignedDay || reg.assigned_day,
          assignedTime: assignedTime || reg.assigned_time,
          instruments: reg.instruments,
        });

        // Update message_log status
        await supabase
          .from('message_log')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('registration_id', id)
          .eq('action', 'status_changed_to_שובץ');

        // Auto-add to students table if group selected
        if (groupId) {
          await supabase.from('students').insert({
            group_id: groupId,
            name: reg.student_name,
            instrument: Array.isArray(reg.instruments) ? reg.instruments[0] : reg.instruments || null,
            parent_phone: reg.parent_phone,
            is_active: true,
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update-status API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
