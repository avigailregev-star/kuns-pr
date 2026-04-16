import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';
import { appendRegistrationRow } from '../../../lib/googleSheets';
import { sendToMake } from '../../../lib/makeWebhook';
import { sendConfirmationEmail } from '../../../lib/email';
import { getOrchestraForInstruments, getOrchestraFromCourse } from '../../../lib/autoAssign';

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
      continueTeacher,
      continueDay,
      continueTime,
      unavailableDays,
      preferredSlot,
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

    // ── Auto-assign orchestra/choir ──────────────────────────────────────────
    const orchestraGroup =
      type === 'continue'
        ? getOrchestraFromCourse(selectedCourse)
        : null;

    // ── Auto-assign continuing students ─────────────────────────────────────
    const autoAssign = type === 'continue' && continueTeacher;
    if (autoAssign) initialStatus = 'שובץ';

    // ── Save to Supabase ─────────────────────────────────────────────────────
    const supabase = getSupabaseClient();
    const { data, error: dbError } = await supabase
      .from('registrations')
      .insert([{
        student_name: studentName,
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
        status: initialStatus,
        orchestra: orchestraGroup || null,
        teacher: continueTeacher || null,
        assigned_day: continueDay || null,
        assigned_time: continueTime || null,
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
