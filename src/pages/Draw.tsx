import { useState, useCallback, useRef, useEffect } from 'react'
import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI, AppState, BinaryFiles } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).EXCALIDRAW_ASSET_PATH = '/'

const DRAWING_ID = 'default'
const SAVE_DEBOUNCE_MS = 2000
const API_BASE = '/api'

async function loadDrawing(id: string) {
  const res = await fetch(`${API_BASE}/drawings/${id}`)
  if (!res.ok) return null
  return res.json()
}

async function saveDrawing(id: string, elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) {
  const json = serializeAsJSON(elements, appState, files, 'local')
  await fetch(`${API_BASE}/drawings/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json,
  })
}

export default function Draw() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [initialData, setInitialData] = useState<Record<string, unknown> | null | undefined>(undefined)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    loadDrawing(DRAWING_ID).then(data => {
      if (isMounted.current) setInitialData(data)
    })
    return () => { isMounted.current = false }
  }, [])

  const handleChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveDrawing(DRAWING_ID, elements, appState, files)
    }, SAVE_DEBOUNCE_MS)
  }, [])

  // Don't render until we know whether there's saved data
  if (initialData === undefined) {
    return <div className="h-full w-full flex items-center justify-center text-text-secondary">Loading...</div>
  }

  return (
    <div className="h-full w-full">
      <Excalidraw
        theme="dark"
        excalidrawAPI={setApi}
        initialData={initialData || undefined}
        onChange={handleChange}
      />
    </div>
  )
}
