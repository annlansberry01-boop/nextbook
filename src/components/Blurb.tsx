import { useEffect, useState } from 'react'
import { getBlurb, peekBlurb } from '../lib/blurb'

/** Three lines of description with More / Less. Shows a soft placeholder while it loads. */
export default function Blurb({ workKey, title, author }: { workKey: string; title: string; author: string }) {
  const [text, setText] = useState<string | undefined>(() => peekBlurb(workKey))
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
    const known = peekBlurb(workKey)
    setText(known)
    if (known !== undefined) return
    let live = true
    getBlurb(workKey, title, author).then((t) => live && setText(t))
    return () => {
      live = false
    }
  }, [workKey, title, author])

  if (text === undefined) {
    return (
      <div className="blurb loading" aria-label="Loading a description">
        <span />
        <span />
      </div>
    )
  }
  if (!text) return <p className="blurb none">No description available for this one.</p>

  const long = text.length > 180
  return (
    <div className="blurb">
      <p className={open || !long ? '' : 'clamped'}>{text}</p>
      {long && (
        <button className="inline-link" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Less' : 'More'}
        </button>
      )}
    </div>
  )
}
