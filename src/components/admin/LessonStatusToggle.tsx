'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function LessonStatusToggle({
  lessonId,
  status
}:{
  lessonId:string
  status:string
}){

  const router = useRouter()
  const [pending,startTransition] = useTransition()

  async function toggle(){

    const newStatus = status === 'published' ? 'draft' : 'published'

    await fetch('/api/admin/lesson-status',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        lessonId,
        status:newStatus
      })
    })

    router.refresh()
  }

  return(
    <button
      onClick={()=>startTransition(toggle)}
      className="px-4 py-2 rounded-xl bg-black text-white"
    >
      {pending ? 'Updating...' :
       status === 'published' ? 'Unpublish' : 'Publish'}
    </button>
  )
}