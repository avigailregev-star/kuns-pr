import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, lesson_type, is_mangan_school, school_name, teacher_id, assigned_day, assigned_time, assigned_end_time, student_registration_ids } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'שם קבוצה הוא שדה חובה' }, { status: 400 });
    }
    if (!assigned_time) {
      return NextResponse.json({ error: 'יש לבחור שעה כדי ליצור שיעור' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Block overlapping group schedules for the same teacher on the same day
    if (teacher_id != null && assigned_day != null && assigned_time != null && assigned_time !== '') {
      const { data: existing } = await supabase
        .from('groups')
        .select('lesson_type, group_schedules(day_of_week, start_time, end_time)')
        .eq('teacher_id', teacher_id);

      const toM = t => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
      const ltDur = lt => (lt === 'individual_45' || lt === 'melodies_individual') ? 45 : 60;
      const newStart = toM(assigned_time);
      const newEnd = assigned_end_time ? toM(assigned_end_time) : newStart + ltDur(lesson_type);
      const dayNum = Number(assigned_day);

      for (const g of (existing || [])) {
        for (const sched of (g.group_schedules || [])) {
          if (Number(sched.day_of_week) !== dayNum || !sched.start_time) continue;
          const eStart = toM(sched.start_time);
          const eEnd = sched.end_time ? toM(sched.end_time) : eStart + ltDur(g.lesson_type);
          if (newStart < eEnd && eStart < newEnd) {
            return NextResponse.json(
              { error: `חיפוף בזמנים עם קבוצה קיימת באותו יום (${sched.start_time})` },
              { status: 409 }
            );
          }
        }
      }
    }

    const insertData = { name: name.trim() };
    if (lesson_type != null) insertData.lesson_type = lesson_type;
    if (school_name != null) insertData.school_name = school_name;
    if (teacher_id != null) insertData.teacher_id = teacher_id;
    insertData.is_mangan_school = !!is_mangan_school;

    const { data, error } = await supabase
      .from('groups')
      .insert(insertData)
      .select('id, name, lesson_type, is_mangan_school, school_name')
      .single();

    if (error) {
      console.error('Group create error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create group_schedules entry if day was provided
    if (assigned_day != null && assigned_time) {
      const { error: schedErr } = await supabase.from('group_schedules').insert({
        group_id: data.id,
        day_of_week: assigned_day,
        start_time: assigned_time,
        ...(assigned_end_time ? { end_time: assigned_end_time } : {}),
      });
      if (schedErr) console.error('group_schedules insert error:', schedErr.message);
    }

    // Attach selected students to the new group
    if (Array.isArray(student_registration_ids) && student_registration_ids.length > 0) {
      let teacherName = null;
      if (teacher_id != null) {
        const { data: teacherRow, error: teacherErr } = await supabase
          .from('teachers')
          .select('name')
          .eq('id', teacher_id)
          .maybeSingle();
        if (teacherErr) console.error('teachers lookup error:', teacherErr.message);
        teacherName = teacherRow?.name || null;
      }

      const { data: regsToAttach, error: regsErr } = await supabase
        .from('registrations')
        .select('id, student_name, instruments, parent_phone, group_id')
        .in('id', student_registration_ids);
      if (regsErr) console.error('registrations fetch error:', regsErr.message);

      for (const reg of (regsToAttach || [])) {
        if (reg.group_id && reg.group_id !== data.id) {
          const { error: deactivateErr } = await supabase
            .from('students')
            .update({ is_active: false })
            .eq('group_id', reg.group_id)
            .eq('name', reg.student_name);
          if (deactivateErr) console.error('students deactivate error:', deactivateErr.message);
        }

        const { error: updateRegErr } = await supabase
          .from('registrations')
          .update({ group_id: data.id, teacher: teacherName, selected_course: data.name })
          .eq('id', reg.id);
        if (updateRegErr) console.error('registrations update error:', updateRegErr.message);

        const { error: insertStudentErr } = await supabase.from('students').insert({
          group_id: data.id,
          name: reg.student_name,
          instrument: Array.isArray(reg.instruments) ? reg.instruments[0] : reg.instruments || null,
          parent_phone: reg.parent_phone || null,
          is_active: true,
        });
        if (insertStudentErr) console.error('students insert error:', insertStudentErr.message);
      }
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Groups POST error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'חסר מזהה קבוצה' }, { status: 400 });

    const supabase = getSupabaseClient();

    // Clear group_id from registrations (FK constraint)
    await supabase.from('registrations').update({ group_id: null }).eq('group_id', id);

    // Delete students in this group
    await supabase.from('students').delete().eq('group_id', id);

    // Delete lessons in this group (lessons_group_id_fkey)
    await supabase.from('lessons').delete().eq('group_id', id);

    // Delete group schedules
    await supabase.from('group_schedules').delete().eq('group_id', id);

    // Delete the group
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) {
      console.error('Group delete error:', error.message);
      return NextResponse.json({ error: `שגיאה במחיקת קבוצה: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Groups DELETE error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  try {
    const { id, name, assigned_day, assigned_time, assigned_end_time } = await request.json();
    if (!id || !name?.trim() || assigned_day == null || !assigned_time) {
      return NextResponse.json({ error: 'יש למלא שם, יום ושעת התחלה' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data: group, error: groupErr } = await supabase
      .from('groups').select('id, teacher_id, lesson_type').eq('id', id).maybeSingle();
    if (groupErr || !group) return NextResponse.json({ error: 'השיעור לא נמצא' }, { status: 404 });
    if (!['theory', 'choir', 'orchestra'].includes(group.lesson_type)) {
      return NextResponse.json({ error: 'ניתן לערוך כאן רק שיעור קבוצתי קבוע' }, { status: 400 });
    }

    const toMins = value => { const [hours, mins] = value.split(':').map(Number); return hours * 60 + (mins || 0); };
    const start = toMins(assigned_time);
    const end = assigned_end_time ? toMins(assigned_end_time) : start + 60;
    if (end <= start) return NextResponse.json({ error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה' }, { status: 400 });

    const { data: otherGroups } = await supabase
      .from('groups')
      .select('id, lesson_type, group_schedules(day_of_week, start_time, end_time)')
      .eq('teacher_id', group.teacher_id)
      .neq('id', id);
    for (const other of (otherGroups || [])) {
      for (const schedule of (other.group_schedules || [])) {
        if (Number(schedule.day_of_week) !== Number(assigned_day) || !schedule.start_time) continue;
        const otherStart = toMins(schedule.start_time);
        const otherDuration = ['individual_45', 'melodies_individual'].includes(other.lesson_type) ? 45 : 60;
        const otherEnd = schedule.end_time ? toMins(schedule.end_time) : otherStart + otherDuration;
        if (start < otherEnd && otherStart < end) {
          return NextResponse.json({ error: `חפיפה עם שיעור קיים בשעה ${schedule.start_time.slice(0, 5)}` }, { status: 409 });
        }
      }
    }

    const { error: nameErr } = await supabase.from('groups').update({ name: name.trim() }).eq('id', id);
    if (nameErr) return NextResponse.json({ error: 'שגיאה בעדכון שם השיעור' }, { status: 500 });

    const { data: schedules, error: schedulesErr } = await supabase
      .from('group_schedules').select('id').eq('group_id', id).order('id').limit(1);
    if (schedulesErr) return NextResponse.json({ error: 'שגיאה בקריאת שעות השיעור' }, { status: 500 });
    const scheduleData = { day_of_week: assigned_day, start_time: assigned_time, end_time: assigned_end_time || null };
    const scheduleResult = schedules?.[0]
      ? await supabase.from('group_schedules').update(scheduleData).eq('id', schedules[0].id)
      : await supabase.from('group_schedules').insert({ group_id: id, ...scheduleData });
    if (scheduleResult.error) return NextResponse.json({ error: 'שגיאה בעדכון שעות השיעור' }, { status: 500 });

    await supabase.from('registrations').update({
      selected_course: name.trim(),
      assigned_day,
      assigned_time,
      assigned_end_time: assigned_end_time || null,
    }).eq('group_id', id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Groups PATCH error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, lesson_type, is_mangan_school, school_name, teacher_id, group_schedules(day_of_week, start_time, end_time)')
      .order('name', { ascending: true });

    if (error) {
      console.error('Groups fetch error:', error.message);
      return NextResponse.json({ error: 'שגיאה בשליפת קבוצות' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error('Groups API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
