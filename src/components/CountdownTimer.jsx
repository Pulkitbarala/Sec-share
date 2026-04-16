import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { formatDuration } from '../utils/formatters'

export default function CountdownTimer({ expiryTime }) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!expiryTime) return
    const calc = () => {
      const diff = Math.floor((new Date(expiryTime) - Date.now()) / 1000)
      setRemaining(diff)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [expiryTime])

  if (remaining === null) return null

  const isExpired = remaining <= 0
  const isWarning = remaining < 3600

  const colors = isExpired
    ? { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', color: '#fca5a5' }
    : isWarning
    ? { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', color: '#fde68a' }
    : { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', color: '#6ee7b7' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700,
      padding: '0.4rem 0.75rem', borderRadius: '8px',
      background: colors.bg, border: `1px solid ${colors.border}`,
      color: colors.color,
    }}>
      <Clock size={13} />
      {isExpired ? 'Expired' : `Expires in ${formatDuration(remaining)}`}
    </div>
  )
}
