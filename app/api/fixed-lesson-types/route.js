import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';
import { BUILTIN_FIXED_LESSON_TYPES, isValidFixedLessonCategory } from '../../../lib/fixedLessonTypes';

export async function GET() {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  const { data, error } = await getSupabaseClient().from('fixed_lesson_types').select('id, label, category, sort_order').order('sort_order').order('label');
  if (error) return NextResponse.json({ data: [], migrationRequired: true });
  return NextResponse.json({ data: data || [] });
}

export async function POST(request) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  const body = await request.json();
  const label = body.label?.trim().replace(/\s+/g, ' ');
  if (!label) return NextResponse.json({ error: 'יש להזין שם לסוג השיעור' }, { status: 400 });
  if (BUILTIN_FIXED_LESSON_TYPES.some(type => type.label === label)) return NextResponse.json({ error: 'סוג שיעור בשם זה כבר קיים' }, { status: 409 });
  if (!isValidFixedLessonCategory(body.category)) return NextResponse.json({ error: 'יש לבחור קטגוריה תקינה' }, { status: 400 });

  const { data, error } = await getSupabaseClient().from('fixed_lesson_types')
    .insert({ label, category: body.category }).select('id, label, category, sort_order').single();
  if (error) {
    const missing = error.code === '42P01' || error.code === 'PGRST205';
    return NextResponse.json({ error: missing ? 'יש להפעיל תחילה את עדכון מסד הנתונים לסוגי שיעורים קבועים' : 'סוג שיעור בשם זה כבר קיים' }, { status: missing ? 503 : 409 });
  }
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(request) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'חסר מזהה סוג שיעור' }, { status: 400 });
  const { error } = await getSupabaseClient().from('fixed_lesson_types').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'שגיאה במחיקת סוג השיעור' }, { status: 500 });
  return NextResponse.json({ success: true });
}
