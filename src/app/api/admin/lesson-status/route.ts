import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request:Request){

  const body = await request.json()

  const {lessonId,status} = body

  const supabase = await createServerSupabaseClient()

  const {error} = await supabase
    .from('lessons')
    .update({status})
    .eq('id',lessonId)

  if(error){
    return NextResponse.json({error:error.message},{status:500})
  }

  return NextResponse.json({success:true})
}
