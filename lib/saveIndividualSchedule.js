import { NextResponse } from 'next/server';
import { teacherCalendar, slotProblem, minutes, dayNumber, PRIVATE_TYPES, clockTime } from './teacherSchedulePicker';
import { getLessonDuration } from './lessonDuration';
import { getLessonTypeValue } from './groupNaming';
import { syncRegistrationToAttendance } from './syncToAttendance';

// This endpoint never creates registrations or sends parent notifications.
// Validate against fresh server data, not only the calendar in the browser.
export async function saveIndividualSchedule(supabase, body) {
  const { id, teacher: teacherName, assignedDay, assignedTime, assignedEndTime, selectedCourse } = body;
  const day = dayNumber(assignedDay), start = minutes(assignedTime);
  if (!teacherName || day == null || start == null) return NextResponse.json({ error: 'יש לבחור מורה, יום ושעה תקינים' }, { status: 400 });
  const { data: current, error: currentError } = await supabase.from('registrations').select('*').eq('id', id).maybeSingle();
  if (currentError) return NextResponse.json({ error: 'לא ניתן לבדוק את הרישום כרגע' }, { status: 503 });
  if (!current) return NextResponse.json({ error: 'הרישום לא נמצא' }, { status: 404 });
  const course = selectedCourse || current.selected_course;
  if (course !== current.selected_course && !PRIVATE_TYPES.includes(getLessonTypeValue(course))) return NextResponse.json({ error: 'יש לבחור סוג שיעור פרטני' }, { status: 400 });
  const end = assignedEndTime ? minutes(assignedEndTime) : start + getLessonDuration(course);
  const [teacherResult, groupsResult, rowsResult] = await Promise.all([
    supabase.from('teachers').select('id, name, available_hours, teacher_availability_ranges(day_of_week, start_time, end_time)').eq('name', teacherName).maybeSingle(),
    supabase.from('groups').select('id, name, teacher_id, lesson_type, group_schedules(id, day_of_week, start_time, end_time)'),
    supabase.from('registrations').select('id, teacher, group_id, student_name, status, registration_status, selected_course, assigned_day, assigned_time, assigned_end_time'),
  ]);
  if (teacherResult.error || groupsResult.error || rowsResult.error) return NextResponse.json({ error: 'לא ניתן לבדוק חפיפות כרגע. לא נשמר שינוי.' }, { status: 503 });
  if (!teacherResult.data) return NextResponse.json({ error: 'המורה לא נמצאה' }, { status: 400 });
  const groups = groupsResult.data || [], rows = rowsResult.data || [];
  const ownGroup = groups.find(g => String(g.id) === String(current.group_id));
  if (ownGroup && (!PRIVATE_TYPES.includes(ownGroup.lesson_type) || (ownGroup.group_schedules || []).length > 1 ||
    rows.some(r => r.id !== id && String(r.group_id) === String(ownGroup.id)))) {
    return NextResponse.json({ error: 'השיעור מקושר לקבוצה משותפת. יש לערוך את שעות הקבוצה בלשונית מורים.' }, { status: 409 });
  }
  const problem = slotProblem(teacherCalendar(teacherResult.data, rows, groups, current), day, start, end);
  if (problem) return NextResponse.json({ error: problem }, { status: problem.startsWith('חפיפה') ? 409 : 400 });
  const update = { teacher: teacherName, selected_course: course, assigned_day: day, assigned_time: clockTime(start), assigned_end_time: clockTime(end), status: 'שובץ', updated_at: new Date().toISOString() };
  const { error: saveError } = await supabase.from('registrations').update(update).eq('id', id);
  if (saveError) return NextResponse.json({ error: 'השיבוץ לא נשמר' }, { status: 500 });
  let warning;
  try {
    if (ownGroup) {
      // Reuse the existing one-student group so the old slot is released.
      const oldSchedule = ownGroup.group_schedules?.[0];
      const scheduleUpdate = { day_of_week: day, start_time: clockTime(start), end_time: clockTime(end) };
      const scheduleResult = oldSchedule
        ? await supabase.from('group_schedules').update(scheduleUpdate).eq('id', oldSchedule.id)
        : await supabase.from('group_schedules').insert({ group_id: ownGroup.id, ...scheduleUpdate });
      if (scheduleResult.error) throw Error(scheduleResult.error.message);
      const groupResult = await supabase.from('groups').update({ teacher_id: teacherResult.data.id, lesson_type: getLessonTypeValue(course) || ownGroup.lesson_type, ...(course !== current.selected_course ? { name: course } : {}) }).eq('id', ownGroup.id);
      if (groupResult.error) throw Error(groupResult.error.message);
    }
    await syncRegistrationToAttendance(supabase, { ...current, ...update }, ownGroup?.id || null);
  } catch (err) {
    console.error('Individual schedule attendance sync:', err.message);
    warning = 'השיבוץ נשמר ברישומים, אך עדכון מערכת הנוכחות לא הושלם. יש לבדוק את השעה בלשונית מורים.';
  }
  return NextResponse.json({ success: true, ...(warning ? { warning } : {}) });
}
