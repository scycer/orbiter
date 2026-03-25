import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).EXCALIDRAW_ASSET_PATH = '/'

export default function Draw() {
  return (
    <div className="h-full w-full">
      <Excalidraw
        theme="dark"
      />
    </div>
  )
}
