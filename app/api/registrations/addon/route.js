import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../../lib/supabase';
import { matchesGroupLabel, groupBaseLabel } from '../../../../lib/groupNaming';

const EXCLUDED_STATUSES = ['נדחה', 'בוטל'];

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const { sourceId, groupId, kind } = await request.json();

    if (!sourceId) {
      return NextResponse.json({ error: 'חסר מזהה תלמיד/ה' }, { status: 400 });
    }
    if (!groupId && kind !== 'individual') {
      return NextResponse.json({ error: 'יש לבחור קבוצה' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data: source, error: sourceErr } = await supabase
      .from('registrations')
      .select('student_name, student_phone, parent_name, parent_phone, parent_email, birthdate, grade, school_name, has_accommodations, type, instruments, group_id, status, registration_status')
      .eq('id', sourceId)
      .maybeSingle();
    if (sourceErr || !source) {
      return NextResponse.json({ error: 'תלמיד/ה לא נמצא/ה' }, { status: 404 });
    }

    if (kind === 'individual') {
      const { data: newReg, error: insertErr } = await supabase
        .from('registrations')
        .insert({
          ...source,
          selected_course: null,
          linked_registration_id: sourceId,
          status: 'חדש',
        })
        .select('*')
        .single();
      if (insertErr || !newReg) {
        console.error('addon: individual insert error', insertErr?.message);
        return NextResponse.json({ error: 'שגיאה ביצירת רישום פרטני' }, { status: 500 });
      }
      return NextResponse.json({ data: newReg });
    }

    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .select('id, name, teacher_id, lesson_type, group_schedules(day_of_week, start_time, end_time)')
      .eq('id', groupId)
      .maybeSingle();
    if (groupErr || !group) {
      return NextResponse.json({ error: 'קבוצה לא נמצאה' }, { status: 404 });
    }

    if (String(source.group_id || '') === String(group.id)) {
      return NextResponse.json({ error: 'לתלמיד/ה כבר יש שיבוץ פעיל בקבוצה זו' }, { status: 409 });
    }

    const allowedTypes = kind === 'theory' ? ['theory'] : kind === 'ensemble' ? ['orchestra', 'choir'] : ['theory', 'orchestra', 'choir'];
    if (!allowedTypes.includes(group.lesson_type)) {
      return NextResponse.json({ error: 'יש לבחור שיבוץ מהתחום המתאים בלבד' }, { status: 400 });
    }

    if (group.lesson_type === 'theory') {
      const baseLabel = groupBaseLabel(group.name);
      const { data: existingLinked, error: existingErr } = await supabase
        .from('registrations')
        .select('id, status, selected_course')
        .eq('linked_registration_id', sourceId);
      if (existingErr) {
        console.error('addon: existing-linked check error', existingErr.message);
        return NextResponse.json({ error: 'שגיאה בבדיקת רישום' }, { status: 500 });
      }
      const hasActiveSameLabel = (existingLinked || []).some(r =>
        !EXCLUDED_STATUSES.includes(r.status) && matchesGroupLabel(r.selected_course, baseLabel)
      );
      if (hasActiveSameLabel) {
        return NextResponse.json({ error: 'לתלמיד/ה כבר יש שיבוץ פעיל מסוג זה' }, { status: 409 });
      }
    }

    const insertData = {
      student_name: source.student_name,
      student_phone: source.student_phone,
      parent_name: source.parent_name,
      parent_phone: source.parent_phone,
      parent_email: source.parent_email,
      birthdate: source.birthdate,
      grade: source.grade,
      school_name: source.school_name,
      has_accommodations: source.has_accommodations || false,
      type: source.type,
      instruments: source.instruments || [],
      selected_course: group.name,
      linked_registration_id: sourceId,
      status: 'חדש',
    };

    let teacherName = null;
    if (group.teacher_id != null) {
      const { data: teacherRow, error: teacherErr } = await supabase
        .from('teachers')
        .select('name')
        .eq('id', group.teacher_id)
        .maybeSingle();
      if (teacherErr) console.error('addon: teacher lookup error', teacherErr.message);
      teacherName = teacherRow?.name || null;
    }

    const schedules = (group.group_schedules || [])
      .filter(s => s.start_time)
      .sort((a, b) => a.day_of_week - b.day_of_week);
    const first = schedules[0] || null;

    insertData.status = 'שובץ';
    insertData.teacher = teacherName;
    insertData.assigned_day = first ? first.day_of_week : null;
    insertData.assigned_time = first ? first.start_time : null;
    insertData.assigned_end_time = first ? (first.end_time || null) : null;
    insertData.group_id = group.id;

    const { data: newReg, error: insertErr } = await supabase
      .from('registrations')
      .insert(insertData)
      .select('*')
      .single();
    if (insertErr || !newReg) {
      console.error('addon: insert error', insertErr?.message);
      return NextResponse.json({ error: 'שגיאה ביצירת רישום' }, { status: 500 });
    }

    const { data: existingStudent, error: existingStudentErr } = await supabase
      .from('students')
      .select('id')
      .eq('group_id', group.id)
      .eq('name', source.student_name)
      .maybeSingle();
    if (existingStudentErr) console.error('addon: existing student check error', existingStudentErr.message);
    if (!existingStudentErr && !existingStudent) {
      const { error: studentErr } = await supabase.from('students').insert({
        group_id: group.id,
        name: source.student_name,
        instrument: Array.isArray(source.instruments) ? source.instruments[0] : source.instruments || null,
        parent_phone: source.parent_phone || null,
        is_active: true,
      });
      if (studentErr) console.error('addon: student insert error', studentErr.message);
    }

    return NextResponse.json({ data: newReg });
  } catch (err) {
    console.error('Registrations addon API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
