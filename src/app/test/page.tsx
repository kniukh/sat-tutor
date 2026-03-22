import { getContentTree } from '@/services/content/content.service'

export default async function TestPage() {

  const data = await getContentTree()

  return (
    <div style={{padding:40}}>
      <h1>DB Test</h1>

      <pre>
        {JSON.stringify(data,null,2)}
      </pre>
    </div>
  )
}