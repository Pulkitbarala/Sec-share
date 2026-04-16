import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CopyButton({ text, children }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.5rem 1rem', borderRadius: '8px',
        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.18s',
        background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
        border: copied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)',
        color: copied ? '#6ee7b7' : '#c9d1d9',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {children ?? (copied ? 'Copied!' : 'Copy')}
    </button>
  )
}
