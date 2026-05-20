const HEBREW_TO_DAY = { 'א': 0, 'ב': 1, 'ג': 2, 'ד': 3, 'ה': 4, 'ו': 5, 'ז': 6 };

function toDayOfWeek(assignedDay) {
  if (assignedDay == null || assignedDay === '') return null;
  const num = Number(assignedDay);
  if (!isNaN(num) && num >= 0 && num <= 6) return num;
  return HEBREW_TO_DAY[assignedDay] ?? null;
}

function toLessonType(selectedCourse) {
  if (!selectedCourse) return 'individual_60';
  const c = selectedCourse;
  if (c.includes('90')) return 'individual_60';
  if (c.includes('45')) return 'individual_45';
  if (c.includes('תזמורת')) return 'orchestra';
  if (c.includes('אנסמבל')) return 'orchestra';
  if (c.includes('הזמיר')) return 'choir';
  if (c.includes('מקהלה')) return 'choir';
  if (c.includes('תיאוריה')) return 'theory';
  if (c.includes('מנגינות')) return 'melodies_group';
  if (c.includes('קבוצתי') || c.includes('קבוצ')) return 'group';
  return 'individual_60';
}

export async function syncRegistrationToAttendance(supabase, reg) {
  const {
    id,
    teacher,
    assigned_day,
    assigned_time,
    student_name,
    instruments,
    parent_phone,
    selected_course,
    status,
    registration_status,
    group_id: currentGroupId,
  } = reg;

  const excluded = ['בוטל', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות'];

  // If cancelled — deactivate student in current group
  if (excluded.includes(status) || registration_status === 'Cancelled') {
    if (currentGroupId && student_name) {
      await supabase
        .from('students')
        .update({ is_active: false })
        .eq('group_id', currentGroupId)
        .eq('name', student_name);
    }
    return;
  }

  if (!teacher || assigned_day == null || assigned_day === '' || !assigned_time) return;

  const dayNum = toDayOfWeek(assigned_day);
  if (dayNum === null) return;

  const { data: teacherRow } = await supabase
    .from('teachers')
    .select('id')
    .eq('name', teacher)
    .maybeSingle();
  if (!teacherRow) return;

  const lesson_type = toLessonType(selected_course);
  const groupName = selected_course || teacher;
  const timePrefix = assigned_time.slice(0, 5); // "HH:MM"

  // Find existing group: same teacher + name + day + start_time
  const { data: candidates } = await supabase
    .from('groups')
    .select('id, group_schedules(day_of_week, start_time)')
    .eq('teacher_id', teacherRow.id)
    .eq('name', groupName);

  let groupId = null;
  for (const g of (candidates || [])) {
    const match = (g.group_schedules || []).find(
      s => s.day_of_week === dayNum && s.start_time.startsWith(timePrefix)
    );
    if (match) { groupId = g.id; break; }
  }

  // Create group + schedule if none found
  if (!groupId) {
    const { data: newGroup, error: groupErr } = await supabase
      .from('groups')
      .insert({ teacher_id: teacherRow.id, name: groupName, lesson_type, is_mangan_school: false })
      .select('id')
      .single();
    if (groupErr || !newGroup) {
      console.error('syncToAttendance: create group error', groupErr?.message);
      return;
    }
    groupId = newGroup.id;

    const { error: schedErr } = await supabase
      .from('group_schedules')
      .insert({ group_id: groupId, day_of_week: dayNum, start_time: assigned_time });
    if (schedErr) console.error('syncToAttendance: create schedule error', schedErr?.message);
  }

  // If student moved to a different group — deactivate in old group
  if (currentGroupId && currentGroupId !== groupId) {
    await supabase
      .from('students')
      .update({ is_active: false })
      .eq('group_id', currentGroupId)
      .eq('name', student_name);
  }

  // Update registration.group_id
  if (currentGroupId !== groupId) {
    await supabase.from('registrations').update({ group_id: groupId }).eq('id', id);
  }

  // Add student to group if not already there
  const { data: existing } = await supabase
    .from('students')
    .select('id, is_active')
    .eq('group_id', groupId)
    .eq('name', student_name)
    .maybeSingle();

  if (!existing) {
    const { error: studErr } = await supabase.from('students').insert({
      group_id: groupId,
      name: student_name,
      instrument: Array.isArray(instruments) ? instruments[0] : instruments || null,
      parent_phone: parent_phone || null,
      is_active: true,
    });
    if (studErr) console.error('syncToAttendance: insert student error', studErr?.message);
  } else if (!existing.is_active) {
    await supabase.from('students').update({ is_active: true }).eq('id', existing.id);
  }
}
