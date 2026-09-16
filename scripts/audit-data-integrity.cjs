require('@next/env').loadEnvConfig(process.cwd());
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const normalize = value => (value || '').replace(/\s+/g, ' ').trim();

async function readAll(table, columns) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db.from(table).select(columns).range(start, start + 499);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

async function main() {
  const [registrations, students, groups, teachers] = await Promise.all([
    readAll('registrations', 'id,student_name,selected_course,teacher,assigned_day,assigned_time,group_id,status,registration_status'),
    readAll('students', 'id,name,group_id,is_active'),
    readAll('groups', 'id,name,teacher_id,group_schedules(day_of_week,start_time)'),
    readAll('teachers', 'id,name'),
  ]);
  const groupById = new Map(groups.map(group => [group.id, group]));
  const teacherById = new Map(teachers.map(teacher => [teacher.id, teacher.name]));
  const issues = [];
  for (const reg of registrations) {
    if (reg.status !== 'שובץ' || reg.registration_status === 'Cancelled') continue;
    const group = reg.group_id ? groupById.get(reg.group_id) : null;
    const label = { id: reg.id, student: reg.student_name, course: reg.selected_course };
    if (reg.group_id && !group) issues.push({ type: 'missing_group', ...label });
    if (!reg.teacher || !reg.assigned_time || reg.assigned_day == null) {
      issues.push({ type: 'assigned_without_complete_schedule', ...label });
    }
    if (!group) continue;
    const activeMember = students.some(student => student.group_id === group.id && student.is_active && normalize(student.name) === normalize(reg.student_name));
    if (!activeMember) issues.push({ type: 'attendance_not_active', ...label });
    const groupTeacher = teacherById.get(group.teacher_id);
    if (reg.teacher && groupTeacher && reg.teacher !== groupTeacher) issues.push({ type: 'teacher_mismatch', ...label, registrationTeacher: reg.teacher, attendanceTeacher: groupTeacher });
    if (reg.assigned_time && group.group_schedules?.length === 1 && group.group_schedules[0].start_time?.slice(0, 5) !== reg.assigned_time.slice(0, 5)) {
      issues.push({ type: 'time_mismatch', ...label });
    }
  }

  const unlinkedAttendance = [];
  for (const reg of registrations.filter(row => !row.teacher && !row.assigned_time && !row.group_id)) {
    const matches = groups.filter(group =>
      normalize(group.name) === normalize(reg.selected_course) &&
      group.teacher_id && group.group_schedules?.some(schedule => schedule.start_time) &&
      students.some(student => student.group_id === group.id && student.is_active && normalize(student.name) === normalize(reg.student_name))
    );
    if (matches.length) unlinkedAttendance.push({ id: reg.id, student: reg.student_name, course: reg.selected_course, matchingGroups: matches.length });
  }

  const counts = Object.fromEntries([...new Set(issues.map(issue => issue.type))].map(type => [type, issues.filter(issue => issue.type === type).length]));
  console.log(JSON.stringify({ checked: { registrations: registrations.length, students: students.length, groups: groups.length }, counts, issues, unlinkedAttendance }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
