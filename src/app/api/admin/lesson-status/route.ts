import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminApiAuthError, requireAdminApi } from '@/lib/auth/admin'

export async function POST(request:Request){
  try {
    await requireAdminApi()
  } catch (error) {
    if (isAdminApiAuthError(error)) {
      return NextResponse.json({error:error.message},{status:error.status})
    }
    throw error
  }

  const body = await request.json()

  const {lessonId,status} = body

  if (!lessonId || !['draft', 'published', 'archived'].includes(status)) {
    return NextResponse.json({error:'Invalid lessonId or status'},{status:400})
  }

  const supabase = await createServerSupabaseClient()

  if (status === 'published') {
    const { count, error: questionError } = await supabase
      .from('question_bank')
      .select('id', { count: 'exact', head: true })
      .eq('lesson_id', lessonId)
      .eq('review_status', 'approved')

    if (questionError) {
      return NextResponse.json({error:questionError.message},{status:500})
    }

    if ((count ?? 0) < 4) {
      return NextResponse.json(
        {error:'Approve at least 4 questions before publishing this lesson'},
        {status:409},
      )
    }
  }

  const {error} = await supabase
    .from('lessons')
    .update({status})
    .eq('id',lessonId)

  if(error){
    return NextResponse.json({error:error.message},{status:500})
  }

  return NextResponse.json({success:true})
}
