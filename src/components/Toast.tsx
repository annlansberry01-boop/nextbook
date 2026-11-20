import { useEffect, useState } from 'react'

// Shows short confirmations ("Logged · 4 stars") sent with toast() from lib/actions.
export default function Toast() {
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let t: number
    const on = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      setMsg(text)
      window.clearTimeout(t)
      // Longer messages stay up longer, so there's time to read them.
      t = window.setTimeout(() => setMsg(''), Math.max(2600, text.length * 60))
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
