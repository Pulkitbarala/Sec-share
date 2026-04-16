import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { encryptFile, generateCode, hashPassword, readFileAsBuffer } from '../utils/crypto'
import { formatBytes } from '../utils/formatters'
import ProgressBar from '../components/ProgressBar'
import { Toast, useToast } from '../components/Toast'
import { Upload, File, Lock, Clock, Download, Eye, EyeOff, X, ShieldCheck } from 'lucide-react'

const MAX_FILE_SIZE = 50 * 1024 * 1024

export default function Dashboard() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const uploadInProgress = useRef(false)
  const { toast, showToast, clearToast } = useToast()

  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [expiryHours, setExpiryHours] = useState(24)
  const [maxDownloads, setMaxDownloads] = useState(5)
  const [usePassword, setUsePassword] = useState(false)
  const [filePassword, setFilePassword] = useState('')
  const [showFilePassword, setShowFilePassword] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [uploading, setUploading] = useState(false)

  const validateAndSetFile = (f) => {
    if (!f) return
    if (f.size > MAX_FILE_SIZE) {
      showToast(`File too large. Max size is ${formatBytes(MAX_FILE_SIZE)}.`, 'error')
      return
    }
    setFile(f)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    validateAndSetFile(e.dataTransfer.files[0])
  }, [])

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const handleUpload = async () => {
    if (uploadInProgress.current) return
    if (!file) return showToast('Please select a file first.', 'error')
    if (usePassword && !filePassword) return showToast('Enter a password or disable password protection.', 'error')

    uploadInProgress.current = true
    setUploading(true)
    setProgress(0)
    setStage('encrypting')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const code = generateCode()
      const encKey = usePassword ? filePassword : code
      const passwordHash = usePassword ? await hashPassword(filePassword) : null

      setProgress(10)
      const buffer = await readFileAsBuffer(file)
      setProgress(30)
      const encryptedBuffer = await encryptFile(buffer, encKey)
      setProgress(55)

      setStage('uploading')
      const storagePath = `${user.id}/${code}/${file.name}.enc`
      const blob = new Blob([encryptedBuffer], { type: 'application/octet-stream' })

      const { error: storageError } = await supabase.storage.from('secure_files').upload(storagePath, blob, { upsert: false })
      if (storageError) throw storageError
      setProgress(80)

      const expiryTime = new Date(Date.now() + expiryHours * 3600000).toISOString()
      const { error: dbError } = await supabase.from('files').insert({
        code, name: file.name, size: file.size, storage_path: storagePath,
        expiry_time: expiryTime, max_downloads: parseInt(maxDownloads),
        current_downloads: 0, is_password_protected: usePassword,
        password_hash: passwordHash, user_id: user.id,
      })
      if (dbError) throw dbError
      setProgress(100)
      setTimeout(() => navigate(`/share/${code}`), 400)
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Upload failed. Please try again.', 'error')
      setUploading(false)
      setStage('')
      setProgress(0)
    } finally {
      uploadInProgress.current = false
    }
  }

  return (
    <div className="page-wrapper fade-in-up">
      {/* Header */}
      <div className="page-header">
        <span className="eyebrow">Secure upload</span>
        <h1>Upload a File</h1>
        <p className="subtitle">Your file is encrypted in the browser before upload — we never see your data.</p>
      </div>

      {/* Two-column grid */}
      <div className="two-col">
        {/* Left: dropzone + progress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !uploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => validateAndSetFile(e.target.files[0])}
              disabled={uploading}
            />
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(35,159,137,0.15)', border: '1px solid rgba(35,159,137,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <File size={20} color="#52bea6" />
                </div>
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>{file.name}</div>
                  <div style={{ color: 'rgba(201,209,217,0.5)', fontSize: '0.8rem' }}>{formatBytes(file.size)}</div>
                </div>
                {!uploading && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    style={{ marginLeft: 'auto', width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(201,209,217,0.5)', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(35,159,137,0.08)', border: '1px solid rgba(35,159,137,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={22} color="#52bea6" />
                </div>
                <div>
                  <div style={{ color: '#c9d1d9', fontWeight: 600, fontSize: '0.9rem' }}>Drop your file here</div>
                  <div style={{ color: 'rgba(201,209,217,0.45)', fontSize: '0.8rem', marginTop: '0.2rem' }}>or click to browse · Max 50 MB</div>
                </div>
              </div>
            )}
          </div>

          {/* Progress */}
          {uploading && (
            <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#c9d1d9', fontWeight: 500 }}>
                  {stage === 'encrypting' ? '🔐 Encrypting in browser…' : '☁️ Uploading encrypted file…'}
                </span>
                <span style={{ color: 'rgba(201,209,217,0.45)' }}>{progress}%</span>
              </div>
              <ProgressBar progress={progress} />
            </div>
          )}
        </div>

        {/* Right: settings + button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card card-body">
            <div className="section-title">Share Settings</div>

            {/* Expiry + downloads */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="label" htmlFor="expiry">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={12} /> Expires (hours)</span>
                </label>
                <input id="expiry" type="number" className="input" value={expiryHours} onChange={(e) => setExpiryHours(e.target.value)} min={1} max={720} disabled={uploading} />
              </div>
              <div>
                <label className="label" htmlFor="max-downloads">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Download size={12} /> Max downloads</span>
                </label>
                <input id="max-downloads" type="number" className="input" value={maxDownloads} onChange={(e) => setMaxDownloads(e.target.value)} min={1} max={100} disabled={uploading} />
              </div>
            </div>

            {/* Password toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: usePassword ? '0.875rem' : '0' }}>
                <button
                  id="password-toggle"
                  type="button"
                  role="switch"
                  aria-checked={usePassword}
                  onClick={() => { setUsePassword(!usePassword); setFilePassword('') }}
                  disabled={uploading}
                  className={`toggle ${usePassword ? 'on' : ''}`}
                >
                  <span className="toggle-thumb" />
                </button>
                <span style={{ fontSize: '0.85rem', color: 'rgba(201,209,217,0.7)', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
                  onClick={() => !uploading && setUsePassword(!usePassword)}>
                  <Lock size={13} color="rgba(201,209,217,0.4)" />
                  Password protect
                </span>
              </div>

              {usePassword && (
                <div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(201,209,217,0.35)' }} />
                    <input
                      id="file-password"
                      type={showFilePassword ? 'text' : 'password'}
                      className="input"
                      style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                      placeholder="Enter file password"
                      value={filePassword}
                      onChange={(e) => setFilePassword(e.target.value)}
                      disabled={uploading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFilePassword(!showFilePassword)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(201,209,217,0.4)', display: 'flex', alignItems: 'center' }}
                    >
                      {showFilePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(201,209,217,0.4)', marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <ShieldCheck size={11} />
                    Recipients need this password to decrypt
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upload button */}
          <button
            id="upload-btn"
            onClick={handleUpload}
            disabled={uploading || !file}
            className="btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            {uploading ? (
              <>
                <span className="animate-spin" style={{ width: '15px', height: '15px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', display: 'inline-block' }} />
                {stage === 'encrypting' ? 'Encrypting…' : 'Uploading…'}
              </>
            ) : (
              <>
                <Upload size={16} />
                Encrypt &amp; Upload
              </>
            )}
          </button>

          {/* Security note */}
          <div className="notice notice-brand" style={{ borderRadius: '10px' }}>
            <ShieldCheck size={14} color="#52bea6" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>AES-256-GCM encryption happens <strong>in your browser</strong> — the server only receives ciphertext.</span>
          </div>
        </div>
      </div>

      <Toast toast={toast} onClose={clearToast} />
    </div>
  )
}
