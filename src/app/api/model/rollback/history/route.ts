import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('model_versions')
    .select('*')
    .order('version', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    )
  }

  return NextResponse.json({
    success: true,
    versions: data,
  })
}