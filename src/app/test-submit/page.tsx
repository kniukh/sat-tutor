'use client'

export default function TestSubmit() {

  async function send() {

    const res = await fetch('/api/lesson/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        studentId: 'acf51f9d-0cb5-4ede-958e-ca43637fb5e1',
        lessonId: '3e9997ac-8d50-43bb-9c7f-628e96b65434',
        score: 1,
        totalQuestions: 1,
        accuracy: 1
      })
    })

    const data = await res.json()

    console.log(data)
    alert('Submitted')
  }

  return (
    <div style={{padding:40}}>
      <button onClick={send}>
        Submit test lesson
      </button>
    </div>
  )
}
