import { useEffect, useState } from 'react'

// iOS PWA ve gömülü önizlemelerde window.confirm/alert güvenilir değil; kendi pencere sistemimiz.
interface Req { id: number; message: string; title?: string; ok: string; cancel?: string; danger?: boolean; resolve: (v: boolean) => void }
let listener: ((r: Req) => void) | null = null
let seq = 0

export function ask(message: string, opts: { title?: string; ok?: string; cancel?: string; danger?: boolean } = {}) {
  return new Promise<boolean>((resolve) => {
    listener?.({ id: ++seq, message, title: opts.title, ok: opts.ok ?? 'Evet', cancel: opts.cancel ?? 'Vazgeç', danger: opts.danger, resolve })
  })
}
export function notify(message: string, title?: string) {
  return new Promise<boolean>((resolve) => listener?.({ id: ++seq, message, title, ok: 'Tamam', resolve }))
}

export function DialogHost() {
  const [queue, setQueue] = useState<Req[]>([])
  useEffect(() => { listener = (r) => setQueue((q) => [...q, r]); return () => { listener = null } }, [])
  const cur = queue[0]
  if (!cur) return null
  const close = (v: boolean) => { cur.resolve(v); setQueue((q) => q.slice(1)) }
  return (
    <div className="modal" onClick={() => cur.cancel && close(false)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog">
        {cur.title && <h3>{cur.title}</h3>}
        <p>{cur.message}</p>
        <div className="dialog-actions">
          {cur.cancel && <button className="btn" onClick={() => close(false)}>{cur.cancel}</button>}
          <button className={`btn ${cur.danger ? 'danger-fill' : 'primary'}`} onClick={() => close(true)}>{cur.ok}</button>
        </div>
      </div>
    </div>
  )
}
