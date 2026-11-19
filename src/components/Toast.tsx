import { useEffect, useState } from 'react'

// Shows short confirmations ("Logged · 4 stars") sent with toast() from lib/actions.
export default function Toast() {
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let t: number
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail)
      window.clearTimeout(t)
      t = window.setTimeout(() => setMsg(''), 2600)
    }
    window.addEventListener('nb-toast', on)
    return () => {
      window.removeEventListener('nb-toast', on)
      window.clearTimeout(t)
    }
  }, [])

  return (
    <div className={`toast${msg ? ' show' : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  )
}
