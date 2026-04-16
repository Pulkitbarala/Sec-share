import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { decryptFile, hashPassword, triggerDownload } from '../utils/crypto'
import { formatBytes, formatExpiry } from '../utils/formatters'
import ProgressBar from '../components/ProgressBar'
import CountdownTimer from '../components/CountdownTimer'
import { Toast, useToast } from '../components/Toast'
import { Download as DownloadIcon, Lock, Eye, EyeOff, Search, ShieldCheck, AlertTriangle, File, Calendar } from 'lucide-react'

const STAGE_IDLE = 'idle'
const STAGE_VALIDATING = 'validating'
const STAGE_PASSWORD = 'password'
const STAGE_DOWNLOADING = 'downloading'
const STAGE_DECRYPTING = 'decrypting'
const STAGE_DONE = 'done'

export default function Download() {
  const [searchParams] = useSearchParams()
  const { toast, showToast, clearToast } = useToast()

  const [code, setCode] = useState(searchParams.get('code') || '')
  const [fileData, setFileData] = useState(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [stage, setStage] = useState(STAGE_IDLE)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const autoLookupRan = useRef(false)
  const downloadInProgress = useRef(false)
  const decryptionKeyRef = useRef(null)

  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode && urlCode.length === 6 && !autoLookupRan.current) {
      autoLookupRan.current = true
      handleLookup(urlCode)
    }
  }, [])

  const setErr = (msg) => { setError(msg); setStage(STAGE_IDLE) }

  const handleLookup = async (lookupCode) => {
    const c = (lookupCode || code).trim()
    if (c.length !== 6 || !/^\d{6}$/.test(c)) return showToast('Please enter a valid 6-digit numeric code.', 'error')
    setError(null)
    setStage(STAGE_VALIDATING)
    try {
      const { data, error: dbError } = await supabase.from('files').select('*').eq('code', c).single()
      if (dbError || !data) return setErr('No file found for this code. It may have been deleted.')
      if (new Date(data.expiry_time) < new Date()) return setErr('This file has expired.')
      if (data.current_downloads >= data.max_downloads) return setErr('This file has reached its maximum download limit.')
      setFileData(data)
      setStage(data.is_password_protected ? STAGE_PASSWORD : STAGE_DOWNLOADING)
      if (!data.is_password_protected) await performDownload(data, c)
    } catch (err) {
      setErr(err.message || 'Something went wrong.')
    }
  }

  const handlePasswordSubmit = async () => {
    if (!password) return showToast('Please enter the password.', 'error')
    if (!fileData) return
    const inputHash = await hashPassword(password)
    if (inputHash !== fileData.password_hash) return showToast('Incorrect password. Please try again.', 'error')
    await performDownload(fileData, password)
  }

  const performDownload = async (data, decryptionKey) => {
    if (downloadInProgress.current) return
    downloadInProgress.current = true
    setStage(STAGE_DOWNLOADING)
    setProgress(10)
    setError(null)
    decryptionKeyRef.current = decryptionKey
    try {
      const { data: urlData, error: urlError } = await supabase.storage.from('secure_files').createSignedUrl(data.storage_path, 30)
      if (urlError || !urlData?.signedUrl) throw new Error('Could not get download URL.')
      setProgress(25)
      const response = await fetch(urlData.signedUrl)
      if (!response.ok) throw new Error('Failed to fetch file from storage.')
      const encryptedBuffer = await response.arrayBuffer()
      setProgress(60)
      setStage(STAGE_DECRYPTING)
      let decryptedBuffer
      try { decryptedBuffer = await decryptFile(encryptedBuffer, decryptionKey) }
      catch { throw new Error('Decryption failed. Wrong password or corrupted file.') }
      setProgress(85)
      const { error: rpcError } = await supabase.rpc('record_download', { file_id: data.id })
      if (rpcError) console.warn('Could not record download:', rpcError.message)
      setProgress(95)
      triggerDownload(decryptedBuffer, data.name)
      setProgress(100)
      setStage(STAGE_DONE)
      const { data: refreshed } = await supabase.from('files').select('current_downloads, max_downloads, expiry_time').eq('id', data.id).single()
      if (refreshed) setFileData((prev) => ({ ...prev, ...refreshed }))
    } catch (err) {
      showToast(err.message, 'error')
      setStage(data?.is_password_protected ? STAGE_PASSWORD : STAGE_IDLE)
      setProgress(0)
    } finally {
      downloadInProgress.current = false
    }
  }

  const isLookupStage = stage === STAGE_IDLE || stage === STAGE_VALIDATING
  const isDownloadingStage = stage === STAGE_DOWNLOADING || stage === STAGE_DECRYPTING

  return (
    <div className="page-wrapper fade-in-up">
      {/* Header */}
      <div className="page-header">
        <span className="eyebrow">Secure download</span>
        <h1>Download File</h1>
        <p className="subtitle">Enter your 6-digit code to retrieve and decrypt the file.</p>
      </div>

      <div className="two-col">
        {/* Left: main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Code lookup */}
          {isLookupStage && (
            <div className="card-strong card-body">
              <div style={{ marginBottom: error ? '1rem' : '0' }}>
                <label className="label" htmlFor="share-code">Share Code</label>
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                  <input
                    id="share-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="input"
                    style={{ textAlign: 'center', fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.35rem' }}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    disabled={stage === STAGE_VALIDATING}
                  />
                  <button
                    id="lookup-btn"
                    className="btn-primary"
                    onClick={() => handleLookup()}
                    disabled={stage === STAGE_VALIDATING || code.length !== 6}
                    style={{ flexShrink: 0, padding: '0 1.25rem' }}
                  >
                    {stage === STAGE_VALIDATING
                      ? <span className="animate-spin" style={{ width: '15px', height: '15px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', display: 'inline-block' }} />
                      : <Search size={17} />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="notice notice-red" style={{ borderRadius: '10px' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Password entry */}
          {stage === STAGE_PASSWORD && (
            <div className="card-strong card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="notice notice-amber" style={{ borderRadius: '10px' }}>
                <Lock size={14} style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>Password required to decrypt this file</span>
              </div>
              <div>
                <label className="label" htmlFor="dl-password">File Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(201,209,217,0.35)' }} />
                  <input
                    id="dl-password"
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(201,209,217,0.4)', display: 'flex' }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button id="decrypt-btn" className="btn-primary btn-lg" onClick={handlePasswordSubmit} style={{ width: '100%' }}>
                <ShieldCheck size={15} />
                Verify &amp; Download
              </button>
            </div>
          )}

          {/* Progress */}
          {isDownloadingStage && (
            <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#c9d1d9', fontWeight: 500 }}>
                {stage === STAGE_DOWNLOADING ? '☁️ Fetching encrypted file…' : '🔓 Decrypting in browser…'}
              </div>
              <ProgressBar progress={progress} />
            </div>
          )}

          {/* Done */}
          {stage === STAGE_DONE && (
            <div className="card card-body" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DownloadIcon size={24} color="#4ade80" />
              </div>
              <div>
                <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '1rem' }}>Download complete!</div>
                <div style={{ color: 'rgba(201,209,217,0.5)', fontSize: '0.83rem', marginTop: '0.25rem' }}>The file was decrypted and saved to your device.</div>
              </div>
              {fileData && fileData.current_downloads < fileData.max_downloads && (
                <button className="btn-secondary" onClick={() => performDownload(fileData, decryptionKeyRef.current)}>
                  <DownloadIcon size={14} />
                  Download Again
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: file details or how-it-works */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {fileData && !isLookupStage ? (
            <div className="card card-body">
              <div className="section-title">File Details</div>
              <div>
                <InfoRow icon={File} label="Filename" value={fileData.name} />
                <InfoRow icon={File} label="Size" value={formatBytes(fileData.size)} />
                <InfoRow icon={DownloadIcon} label="Downloads" value={`${fileData.current_downloads} / ${fileData.max_downloads}`} />
                <InfoRow icon={Lock} label="Protected" value={fileData.is_password_protected ? 'Yes' : 'No'} />
                <InfoRow icon={Calendar} label="Expires" value={formatExpiry(fileData.expiry_time)} />
              </div>
              <hr className="divider" />
              <CountdownTimer expiryTime={fileData.expiry_time} />
            </div>
          ) : (
            <div className="card card-body">
              <div className="section-title">How it works</div>
              <div className="step-list">
                <div className="step-item"><span className="step-num">1</span>Enter the 6-digit share code.</div>
                <div className="step-item"><span className="step-num">2</span>If required, enter the file password.</div>
                <div className="step-item"><span className="step-num">3</span>Decryption happens locally in your browser.</div>
              </div>
              <hr className="divider" />
              <div className="notice notice-brand" style={{ borderRadius: '10px' }}>
                <ShieldCheck size={13} color="#52bea6" style={{ flexShrink: 0 }} />
                <span>Files are decrypted entirely in your browser. We never see your file contents.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <Toast toast={toast} onClose={clearToast} />
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
