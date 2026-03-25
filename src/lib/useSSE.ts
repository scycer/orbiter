import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export function useSSE() {
  const qc = useQueryClient()

  useEffect(() => {
    const es = new EventSource('/api/events')

    const handle = () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    }

    es.addEventListener('task:created', handle)
    es.addEventListener('task:updated', handle)
    es.addEventListener('task:deleted', handle)

    es.onerror = () => {
      es.close()
      // Reconnect after 3s
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['tasks'] })
      }, 3000)
    }

    return () => es.close()
  }, [qc])
}
