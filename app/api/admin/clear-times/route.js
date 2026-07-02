import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../../lib/supabase';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('registrations')
    .update({ assigned_time: null })
    .eq('status', 'חדש')
    .not('assigned_time', 'is', null)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ cleared: data?.length ?? 0 });
}
