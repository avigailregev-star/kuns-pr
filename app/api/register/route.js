import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';
import { appendRegistrationRow } from '../../../lib/googleSheets';
import { sendToMake } from '../../../lib/makeWebhook';
import { sendConfirmationEmail } from '../../../lib/email';
import { getOrchestraForInstruments, getOrchestraFromCourse } from '../../../lib/autoAssign';

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
      selectedCourse,
      continueTeacher,
      continueDay,
      continueTime,
      unavailableDays,
      preferredSlot,
    } = body;

    // Basic validation
    if (!studentName || !parentName || !parentPhone || !parentEmail) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }

    // Auto-assign orchestra/choir for continuing students (by course name, since they don't pick instruments)
    const orchestra = type === 'continue' ? getOrchestraFromCourse(selectedCourse) : null;

    // Auto-assign for continuing students who provided their teacher/day/time
    const autoAssign = type === 'continue' && continueTeacher;
    const initialStatus = autoAssign ? 'שובץ' : 'חדש';

    // 1. Save to Supabase
    const supabase = getSupabaseClient();
    const { data, error: dbError } = await supabase
      .from('registrations')
      .insert([
        {
          student_name: studentName,
          parent_name: parentName,
          parent_phone: parentPhone,
          parent_email: parentEmail,
          type,
          birthdate: birthdate || null,
          grade: grade || null,
          school_name: schoolName || null,
          has_accommodations: hasAccommodations || false,
          instruments,
          selected_course: selectedCourse || null,
          unavailable_days: unavailableDays,
          preferred_slot: preferredSlot || null,
          status: initialStatus,
          orchestra: orchestra || null,
          teacher: continueTeacher || null,
          assigned_day: continueDay || null,
          assigned_time: continueTime || null,
        },
      ])
      .select('id')
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError.message);
      return NextResponse.json({ error: 'שגיאה בשמירת הנתונים' }, { status: 500 });
    }

    const registrationId = data?.id;

    // 2. Send confirmation email
    try {
      await sendConfirmationEmail({ parentName, studentName, parentEmail, instruments, preferredSlot, orchestra });
    } catch (emailError) {
      console.error('Email error:', emailError.message);
    }

    // 4. Save to Google Sheets (non-blocking – log error but don't fail)
    try {
      await appendRegistrationRow(body);
    } catch (sheetsError) {
      console.error('Google Sheets error:', sheetsError.message);
    }

    // 5. Notify Make webhook
    await sendToMake('new_registration', {
      registrationId,
      studentName,
      parentName,
      parentPhone,
      parentEmail,
      type,
      instruments,
      preferredSlot,
    });

    return NextResponse.json({ success: true, id: registrationId });
  } catch (err) {
    console.error('Register API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
