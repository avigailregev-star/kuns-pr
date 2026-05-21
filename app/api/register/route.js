import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';
import { appendRegistrationRow } from '../../../lib/googleSheets';
import { sendToMake } from '../../../lib/makeWebhook';
import { sendConfirmationEmail } from '../../../lib/email';
import { getOrchestraForInstruments, getOrchestraFromCourse } from '../../../lib/autoAssign';
import { getLessonDuration } from '../../../lib/lessonDuration';
import { buildUsedMinutesMap, freeMinutesOnDay } from '../../../lib/teacherCapacity';

/**
 * Parse a preferredSlot string like "ימי ב' בין 15:00–18:00"
 * Returns { day: "ב", from: "15:00", to: "18:00" } or null if unparseable.
 */
function parseSlot(slot) {
  if (!slot) return null;
  const dayMatch = slot.match(/ימי\s+([א-ו])/);
  const timeMatch = slot.match(/(\d{1,2}:\d{2})[–\-](\d{1,2}:\d{2})/);
  if (!dayMatch || !timeMatch) return null;
  return { day: dayMatch[1], from: timeMatch[1], to: timeMatch[2] };
}

/**
 * Returns true if teacher's available window overlaps with slot time range on the same day.
 */
function teacherOverlapsSlot(teacher, parsedSlot) {
  if (!parsedSlot) return false;
  const { day, from, to } = parsedSlot;
  if (!(teacher.available_days || []).includes(day)) return false;
  const hours = (teacher.available_hours || {})[day];
  if (!hours?.from || !hours?.to) return false;
  return hours.from < to && hours.to > from;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      studentName,
      studentPhone,
      parentName,
      parentPhone,
      parentEmail,
      type,
      birthdate,
      grade,
      schoolName,
      hasAccommodations,
      instruments,
      orchestraConfirmed,
      attendedOpenDay,
      selectedCourse,
      selectedTeacher,
      selectedDay,
      selectedTime,
      unavailableDays,
      preferredSlot,
      availabilityNotes,
    } = body;

    if (!studentName || !parentName || !parentPhone || !parentEmail) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }

    // ── Open Day early exit ──────────────────────────────────────────────────
    if (type === 'new' && attendedOpenDay === false) {
      const supabase = getSupabaseClient();
      const { data, error: dbError } = await supabase
        .from('registrations')
        .insert([{
          student_name: studentName,
          student_phone: studentPhone || null,
          parent_name: parentName,
          parent_phone: parentPhone,
          parent_email: parentEmail,
          type,
          birthdate: birthdate || null,
          grade: grade || null,
          school_name: schoolName || null,
          has_accommodations: hasAccommodations || false,
          attended_open_day: false,
          preferred_slot: preferredSlot || null,
          availability_notes: availabilityNotes || null,
          status: 'ממתין לשיחת היכרות',
          instruments: [],
          unavailable_days: [],
        }])
        .select('id')
        .single();

      if (dbError) {
        console.error('Supabase error:', dbError.message);
        return NextResponse.json({ error: 'שגיאה בשמירת הנתונים' }, { status: 500 });
      }
      return NextResponse.json({ success: true, id: data?.id });
    }

    // ── Quota check (new / adult / trial only — continue is exempt) ──────────
    let initialStatus = 'חדש';
    let adminNotes = '';

    if (['new', 'adult', 'trial'].includes(type) && instruments?.length > 0) {
      const supabase = getSupabaseClient();
      const primaryInstrument = instruments[0];

      const { data: matchingTeachers } = await supabase
        .from('teachers')
        .select('id, name, instrument_type, available_days, available_hours, max_students')
        .eq('instrument_type', primaryInstrument);

      if (!matchingTeachers || matchingTeachers.length === 0) {
        initialStatus = 'רשימת המתנה';
      } else {
        let hasAvailableTeacher = false;
        for (const teacher of matchingTeachers) {
          if (teacher.max_students == null) {
            hasAvailableTeacher = true;
            break;
          }
          const { count } = await supabase
            .from('registrations')
            .select('id', { count: 'exact', head: true })
            .eq('teacher', teacher.name)
            .neq('type', 'continue')
            .not('status', 'in', '("בוטל","ממתין לשיחת היכרות")');

          if (count < teacher.max_students) {
            hasAvailableTeacher = true;
            break;
          }
        }
        if (!hasAvailableTeacher) {
          initialStatus = 'רשימת המתנה';
        }

        if (initialStatus === 'חדש' && preferredSlot) {
          const parsedSlot = parseSlot(preferredSlot);
          const anyOverlap = matchingTeachers.some((t) =>
            teacherOverlapsSlot(t, parsedSlot)
          );
          if (!anyOverlap) {
            adminNotes = '⚠️ אין חפיפה בין זמינות התלמיד לזמינות המורים';
          }
        }
      }
    }

    // ── Day capacity check (when a specific day was selected) ─────────────────
    if (selectedTeacher && selectedDay != null && selectedDay !== '') {
      const supabase = getSupabaseClient();
      const usedMap = await buildUsedMinutesMap(supabase);
      const lessonDuration = getLessonDuration(selectedCourse);
      const usedMins = usedMap[selectedTeacher]?.[selectedDay] || 0;

      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('available_hours, teacher_availability_ranges(day_of_week, start_time, end_time)')
        .eq('name', selectedTeacher)
        .single();

      const dayNum = Number(selectedDay);
      const isNumericDay = !isNaN(dayNum) && String(dayNum) === String(selectedDay);
      let free;

      if (isNumericDay) {
        const range = (teacherRow?.teacher_availability_ranges || [])
          .find(r => r.day_of_week === dayNum);
        if (range?.start_time && range?.end_time) {
          const [sh, sm] = range.start_time.split(':').map(Number);
          const [eh, em] = range.end_time.split(':').map(Number);
          free = (eh * 60 + em) - (sh * 60 + sm) - usedMins;
        }
      } else {
        free = freeMinutesOnDay(teacherRow?.available_hours || {}, selectedDay, usedMins);
      }

      if (free != null && free < lessonDuration) {
        initialStatus = 'רשימת המתנה';
        adminNotes = (adminNotes ? adminNotes + ' | ' : '') +
          `⚠️ יום ${selectedDay} מלא אצל ${selectedTeacher} — הוכנס לרשימת המתנה`;
      }
    }

    // ── All-days-full check (teacher detected but parent couldn't pick a day) ─
    if (selectedTeacher && (selectedDay == null || selectedDay === '') && type !== 'trial') {
      const supabase = getSupabaseClient();
      const { data: teacherFull } = await supabase
        .from('teachers')
        .select('available_days, available_hours, teacher_availability_ranges(day_of_week, start_time, end_time)')
        .eq('name', selectedTeacher)
        .single();

      if (teacherFull) {
        const usedMapFull = await buildUsedMinutesMap(supabase);
        const lessonDur = getLessonDuration(selectedCourse);
        const ranges = teacherFull.teacher_availability_ranges || [];
        const oldDays = teacherFull.available_days || [];

        if (ranges.length > 0 || oldDays.length > 0) {
          let allFull = true;
          if (ranges.length > 0) {
            for (const r of ranges) {
              const used = (usedMapFull[selectedTeacher] || {})[r.day_of_week] || 0;
              if (!r.start_time || !r.end_time) { allFull = false; break; }
              const [sh, sm] = r.start_time.split(':').map(Number);
              const [eh, em] = r.end_time.split(':').map(Number);
              if ((eh * 60 + em) - (sh * 60 + sm) - used >= lessonDur) { allFull = false; break; }
            }
          } else {
            for (const day of oldDays) {
              const used = (usedMapFull[selectedTeacher] || {})[day] || 0;
              if (freeMinutesOnDay(teacherFull.available_hours || {}, day, used) >= lessonDur) {
                allFull = false; break;
              }
            }
          }
          if (allFull) {
            initialStatus = 'רשימת המתנה';
            adminNotes = (adminNotes ? adminNotes + ' | ' : '') +
              `⚠️ כל הימים מלאים אצל ${selectedTeacher} — הוכנס לרשימת המתנה`;
          }
        }
      }
    }

    // ── Auto-assign orchestra/choir ──────────────────────────────────────────
    const orchestraGroup =
      type === 'continue'
        ? getOrchestraFromCourse(selectedCourse)
        : null;

    // ── Auto-assign continuing students ─────────────────────────────────────
    const autoAssign = type === 'continue' && selectedTeacher;
    if (autoAssign && initialStatus !== 'רשימת המתנה') initialStatus = 'שובץ';

    // ── Save to Supabase ─────────────────────────────────────────────────────
    const supabase = getSupabaseClient();
    const { data, error: dbError } = await supabase
      .from('registrations')
      .insert([{
        student_name: studentName,
        student_phone: studentPhone || null,
        parent_name: parentName,
        parent_phone: parentPhone,
        parent_email: parentEmail,
        type,
        birthdate: birthdate || null,
        grade: grade || null,
        school_name: schoolName || null,
        has_accommodations: hasAccommodations || false,
        orchestra_confirmed: orchestraConfirmed ?? null,
        attended_open_day: attendedOpenDay ?? null,
        instruments: instruments || [],
        selected_course: selectedCourse || null,
        unavailable_days: unavailableDays || [],
        preferred_slot: preferredSlot || null,
        availability_notes: availabilityNotes || null,
        status: initialStatus,
        orchestra: orchestraGroup || null,
        teacher: selectedTeacher || null,
        assigned_day: selectedDay || null,
        assigned_time: selectedTime || null,
        admin_notes: adminNotes || null,
      }])
      .select('id')
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError.message);
      return NextResponse.json({ error: 'שגיאה בשמירת הנתונים' }, { status: 500 });
    }

    const registrationId = data?.id;

    try {
      await sendConfirmationEmail({
        parentName,
        studentName,
        parentEmail,
        instruments,
        selectedCourse: selectedCourse || null,
        preferredSlot,
        orchestra: orchestraGroup,
      });
    } catch (emailError) {
      console.error('Email error:', emailError.message);
    }

    try {
      await appendRegistrationRow(body);
    } catch (sheetsError) {
      console.error('Google Sheets error:', sheetsError.message);
    }

    await sendToMake('new_registration', {
      registrationId,
      studentName,
      parentName,
      parentPhone,
      parentEmail,
      type,
      instruments,
      preferredSlot,
      status: initialStatus,
    });

    return NextResponse.json({ success: true, id: registrationId });
  } catch (err) {
    console.error('Register API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
