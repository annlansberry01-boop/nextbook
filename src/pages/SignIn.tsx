import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import './SignIn.css'

type Phase = 'idle' | 'sending' | 'sent' | 'error'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')

  async function send(e: FormEvent) {
    e.preventDefault()
    setPhase('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // Send the link back to whichever address you opened the app on (laptop or phone).
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setPhase('error')
      setMessage(
        error.status === 429
          ? 'Too many sign-in emails for now. Wait a few minutes and try again.'
          : error.message,
      )
    } else {
      setPhase('sent')
    }
  }

  return (
    <main className="signin">
      <div className="signin-stack" aria-hidden="true">
        <div style={{ background: '#3B4A5C', transform: 'rotate(-10deg)', left: 0, top: 10 }} />
        <div style={{ background: '#6B3A3A', transform: 'rotate(-2deg)', left: 28, top: 4 }} />
        <div style={{ background: '#D9B46A', transform: 'rotate(8deg)', left: 56, top: 8 }} />
      </div>
      <h1 className="signin-title">Next Book</h1>
      <p className="signin-lede">Log, rate and choose your next book.</p>

      {phase === 'sent' ? (
        <div className="signin-sent" role="status">
          <strong>Check your email.</strong>
          <span>
            We sent a sign-in link to {email}. Open it on this device and you're in.
          </span>
          <button className="link-btn" onClick={() => setPhase('idle')}>
            Use a different email
          </button>
        </div>
      ) : (
        <form className="signin-form" onSubmit={send}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button type="submit" className="primary-btn" disabled={phase === 'sending'}>
            {phase === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
          {phase === 'error' && (
            <p className="signin-error" role="alert">
              {message}
            </p>
          )}
          <p className="signin-hint">No password. We'll email you a link that signs you in.</p>
        </form>
      )}
    </main>
  )
}
