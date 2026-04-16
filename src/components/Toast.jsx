import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Info } from 'lucide-react'

export function useToast() {
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'info') => {
    setToast({ message, type })
  }

  const clearToast = () => setToast(null)

  return { toast, showToast, clearToast }
}

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onClose, 4000)
    return () => clearTimeout(id)
  }, [toast, onClose])

  if (!toast) return null

  const icons = {
    success: <CheckCircle size={16} />,
    error: <XCircle size={16} />,
    info: <Info size={16} />,
  }

  return (
    <div className={`toast ${toast.type}`} role="alert">
      {icons[toast.type]}
      <span>{toast.message}</span>
    </div>
  )
}
