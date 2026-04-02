import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../lib/supabase';
import { appendRegistrationRow } from '../../../lib/googleSheets';
import { sendToMake } from '../../../lib/makeWebhook';
import { sendConfirmationEmail } from '../../../lib/email';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      studentName,
      parentName,
      parentPhone,
      parentEmail,
      type,
      instruments,
      selectedCourse,
      unavailableDays,
      preferredSlot,
    } = body;

    // Basic validation
    if (!studentName || !parentName || !parentPhone || !parentEmail) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }

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
          instruments,
          selected_course: selectedCourse || null,
          unavailable_days: unavailableDays,
          preferred_slot: preferredSlot,
          status: 'חדש',
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
      await sendConfirmationEmail({ parentName, studentName, parentEmail, instruments, preferredSlot });
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
