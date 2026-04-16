import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/supabase';

// Public endpoint — no auth required
export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('id, name, instrument_type, available_days, available_hours, max_students')
    .order('name');

  if (error) return NextResponse.json({ data: [] });
  return NextResponse.json({ data: data || [] });
}
