import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { formatBytes, formatExpiry } from '../utils/formatters'
import CountdownTimer from '../components/CountdownTimer'
import CopyButton from '../components/CopyButton'
import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { CheckCircle2, Lock, Download, Calendar, File, Share2, ArrowLeft } from 'lucide-react'

export default function Share() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [fileData, setFileData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const shareUrl = `${window.location.origin}/download?code=${code}`

  useEffect(() => {
    if (!code) return navigate('/')
    const fetchFile = async () => {
      const { data, error } = await supabase
        .from('files')
        .select('name, size, expiry_time, max_downloads, current_downloads, is_password_protected')
        .eq('code', code)
        .single()
      if (error || !data) setError('File not found.')
      else setFileData(data)
      setLoading(false)
    }
    fetchFile()
  }, [code, navigate])

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid rgba(35,159,137,0.2)', borderTopColor: '#52bea6' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: '400px', margin: '0 auto', padding: '5rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: '#fca5a5', marginBottom: '1.5rem' }}>{error}</p>
        <Link to="/dashboard" className="btn-primary">Back to Dashboard</Link>
      </div>
    )
  }

  const downloadsLeft = fileData.max_downloads - fileData.current_downloads

  return (
    <div className="page-wrapper fade-in-up">
      {/* Header */}
      <div className="page-header" style={{ textAlign: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
        <span className="eyebrow">File shared</span>
        <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(16,185,129,0.35)' }}>
            <CheckCircle2 size={26} color="#fff" />
          </div>
        </div>
        <h1>File Shared Successfully</h1>
        <p className="subtitle">Share the code or link below — recipients can download immediately.</p>
      </div>

      <div className="two-col">
        {/* Left: code + QR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Code card */}
          <div className="card-strong card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(201,209,217,0.45)', marginBottom: '0.875rem' }}>
              Your 6-Digit Code
            </div>
            <div className="code-display" style={{ marginBottom: '1.25rem' }}>{code}</div>
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <CopyButton text={code}>Copy Code</CopyButton>
              <CopyButton text={shareUrl}>Copy Link</CopyButton>
            </div>
          </div>

          {/* QR card */}
          <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '0.82rem', color: 'rgba(201,209,217,0.5)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Share2 size={13} />
              Scan to download
            </div>
            <div style={{ padding: '12px', background: '#fff', borderRadius: '12px', display: 'inline-block' }}>
              <QRCode value={shareUrl} size={148} level="M" />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(201,209,217,0.35)', textAlign: 'center', wordBreak: 'break-all', maxWidth: '280px' }}>
              {shareUrl}
            </div>
          </div>
        </div>

        {/* Right: file info + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card card-body">
            <div className="section-title">File Info</div>
            <div>
              <InfoRow icon={File} label="Filename" value={fileData.name} />
              <InfoRow icon={File} label="Size" value={formatBytes(fileData.size)} />
              <InfoRow icon={Download} label="Downloads left" value={`${downloadsLeft} of ${fileData.max_downloads}`} />
              <InfoRow icon={Lock} label="Password" value={fileData.is_password_protected ? 'Protected' : 'None'} />
              <InfoRow icon={Calendar} label="Expires" value={formatExpiry(fileData.expiry_time)} />
            </div>
            <hr className="divider" />
            <CountdownTimer expiryTime={fileData.expiry_time} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <Link to="/dashboard" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
              <ArrowLeft size={15} />
              Dashboard
            </Link>
            <Link to={`/download?code=${code}`} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              <Download size={15} />
              Test Download
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="info-row">
      <div className="info-row-label"><Icon size={13} />{label}</div>
      <div className="info-row-value">{value}</div>
    </div>
  )
}
