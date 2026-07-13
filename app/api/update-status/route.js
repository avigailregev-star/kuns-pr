import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';
import { sendToMake } from '../../../lib/makeWebhook';
import { sendAssignmentEmail } from '../../../lib/email';
import { syncRegistrationToAttendance } from '../../../lib/syncToAttendance';
import { getLessonDuration } from '../../../lib/lessonDuration';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, newStatus, teacher, assignedDay, assignedTime, assignedEndTime, adminNotes, groupId } = body;

    if (!id || !newStatus) {
      return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Block overlapping schedules for the same teacher on the same day
    if (teacher && assignedDay != null && assignedDay !== '' && assignedTime) {
      const toM = t => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
      const dayNum = Number(assignedDay);
      const newStart = toM(assignedTime);
      const newEnd = assignedEndTime ? toM(assignedEndTime) : newStart + getLessonDuration(undefined);

      if (!isNaN(dayNum)) {
        const excludedStatuses = ['בוטל', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות'];

        const { data: otherRegs, error: otherRegsErr } = await supabase
          .from('registrations')
          .select('id, student_name, assigned_day, assigned_time, assigned_end_time, selected_course, status')
          .eq('teacher', teacher)
          .neq('id', id);
        if (otherRegsErr) console.error('schedule conflict check: registrations fetch error:', otherRegsErr.message);

        for (const reg of (otherRegs || [])) {
          if (excludedStatuses.includes(reg.status)) continue;
          if (reg.assigned_day == null || reg.assigned_day === '' || !reg.assigned_time) continue;
          if (Number(reg.assigned_day) !== dayNum) continue;
          const regStart = toM(reg.assigned_time);
          const regEnd = reg.assigned_end_time ? toM(reg.assigned_end_time) : regStart + getLessonDuration(reg.selected_course);
          if (newStart < regEnd && regStart < newEnd) {
            return NextResponse.json(
              { error: `חיפוף בזמנים עם ${reg.student_name} באותו יום (${reg.assigned_time.slice(0, 5)})` },
              { status: 409 }
            );
          }
        }

        const { data: teacherRow, error: teacherRowErr } = await supabase
          .from('teachers')
          .select('id')
          .eq('name', teacher)
          .maybeSingle();
        if (teacherRowErr) console.error('schedule conflict check: teacher lookup error:', teacherRowErr.message);

        if (teacherRow?.id) {
          const { data: currentReg, error: currentRegErr } = await supabase
            .from('registrations')
            .select('group_id')
            .eq('id', id)
            .maybeSingle();
          if (currentRegErr) console.error('schedule conflict check: current registration fetch error:', currentRegErr.message);
          const currentGroupId = currentReg?.group_id;

          const { data: teacherGroups, error: teacherGroupsErr } = await supabase
            .from('groups')
            .select('id, name, group_schedules(day_of_week, start_time, end_time)')
            .eq('teacher_id', teacherRow.id);
          if (teacherGroupsErr) console.error('schedule conflict check: teacher groups fetch error:', teacherGroupsErr.message);

          for (const g of (teacherGroups || [])) {
            if (currentGroupId && String(g.id) === String(currentGroupId)) continue;
            for (const sched of (g.group_schedules || [])) {
              if (Number(sched.day_of_week) !== dayNum || !sched.start_time) continue;
              const schedStart = toM(sched.start_time);
              const schedEnd = sched.end_time ? toM(sched.end_time) : schedStart + 60;
              if (newStart < schedEnd && schedStart < newEnd) {
                return NextResponse.json(
                  { error: `חיפוף בזמנים עם הקבוצה "${g.name}" באותו יום (${sched.start_time})` },
                  { status: 409 }
                );
              }
            }
          }
        }
      }
    }

    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (teacher !== undefined) updateData.teacher = teacher;
    if (assignedDay !== undefined) updateData.assigned_day = assignedDay;
    if (assignedTime !== undefined) updateData.assigned_time = assignedTime;
    if (assignedEndTime !== undefined) updateData.assigned_end_time = assignedEndTime;
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

    // Sync to attendance app
    try {
      const { data: updatedReg } = await supabase
        .from('registrations')
        .select('id, teacher, assigned_day, assigned_time, student_name, instruments, parent_phone, selected_course, status, registration_status, group_id')
        .eq('id', id)
        .single();
      if (updatedReg) await syncRegistrationToAttendance(supabase, updatedReg, groupId || null);
    } catch (syncErr) {
      console.error('Attendance sync error:', syncErr.message);
    }

    // ✅ תיקון 2: log רק אחרי שהעדכון הצליח
    await supabase.from('message_log').insert([
      {
        registration_id: id,
        action: `status_changed_to_${newStatus}`,
        status: 'pending',
      },
    ]);

    // ✅ תיקון 3: ביטול לפי שם + group_id ביחד
    if (newStatus === 'בוטל') {
      const { data: cancelledReg } = await supabase
        .from('registrations')
        .select('student_name, group_id')
        .eq('id', id)
        .single();

      if (cancelledReg?.student_name) {
        let query = supabase
          .from('students')
          .update({ is_active: false, registration_status: 'בוטל' })
          .eq('name', cancelledReg.student_name);

        if (cancelledReg.group_id) {
          query = query.eq('group_id', cancelledReg.group_id);
        }

        await query;
      }
    }

    if (groupId) {
      const { data: reg } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', id)
        .single();

      if (reg) {
        const { data: existing } = await supabase
          .from('students')
          .select('id')
          .eq('group_id', groupId)
          .eq('name', reg.student_name)
          .maybeSingle();

        if (!existing) {
          const { error: studentError } = await supabase.from('students').insert({
            group_id: groupId,
            name: reg.student_name,
            instrument: Array.isArray(reg.instruments) ? reg.instruments[0] : reg.instruments || null,
            parent_phone: reg.parent_phone,
            is_active: true,
          });
          if (studentError) {
            console.error('Students insert error:', studentError.message, studentError.details);
          }
        }

        // Update registration with group_id and group name as selected_course
        const { data: grp } = await supabase.from('groups').select('name').eq('id', groupId).single();
        await supabase.from('registrations').update({
          group_id: groupId,
          ...(grp?.name ? { selected_course: grp.name } : {}),
        }).eq('id', id);
      }
    }

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

        try {
          // ✅ תיקון: שולחים מייל רק אם יש מורה
          // מייל אישור שיבוץ כבוי כברירת מחדל. להפעיל ע"י הגדרת SEND_ASSIGNMENT_EMAIL=true
          const assignmentEmailEnabled = process.env.SEND_ASSIGNMENT_EMAIL === 'true';
          if (assignmentEmailEnabled && (teacher || reg.teacher)) {
            await sendAssignmentEmail({
              parentName: reg.parent_name,
              studentName: reg.student_name,
              parentEmail: reg.parent_email,
              teacher: teacher || reg.teacher,
              assignedDay: assignedDay || reg.assigned_day,
              assignedTime: assignedTime || reg.assigned_time,
              orchestra: reg.orchestra,
            });
          }
        } catch (emailErr) {
          console.error('Assignment email error:', emailErr.message);
        }

        await supabase
          .from('message_log')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('registration_id', id)
          .eq('action', 'status_changed_to_שובץ');
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update-status API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}