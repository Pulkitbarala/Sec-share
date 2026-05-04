import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import JSZip from 'jszip'
import { supabase } from '../utils/supabase'
import { encryptFile, generateCode, hashPassword, readFileAsBuffer } from '../utils/crypto'
import { formatBytes, formatExpiry, formatTimeRemaining } from '../utils/formatters'
import { uploadWithProgress } from '../utils/network'
import ProgressBar from '../components/ProgressBar'
import { Toast, useToast } from '../components/Toast'
import { Upload, File, Lock, Clock, Download, Eye, EyeOff, X, ShieldCheck, Trash2, Copy, ExternalLink, CheckCircle2 } from 'lucide-react'

const MAX_FILE_SIZE = 50 * 1024 * 1024

export default function Dashboard() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const uploadInProgress = useRef(false)
  const { toast, showToast, clearToast } = useToast()

  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [expiryHours, setExpiryHours] = useState(24)
  const [maxDownloads, setMaxDownloads] = useState(5)
  const [usePassword, setUsePassword] = useState(false)
  const [filePassword, setFilePassword] = useState('')
  const [showFilePassword, setShowFilePassword] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadStats, setUploadStats] = useState(null)
  const [myFiles, setMyFiles] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [fileToDelete, setFileToDelete] = useState(null)

  const fetchMyFiles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setMyFiles(data || [])
    } catch (err) {
      console.error('Error fetching files:', err)
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => {
    fetchMyFiles()
  }, [])

  const confirmDelete = (file) => setFileToDelete(file)

  const proceedDelete = async () => {
    if (!fileToDelete) return
    try {
      const { error: storageError } = await supabase.storage.from('secure_files').remove([fileToDelete.storage_path])
      if (storageError) console.warn('Storage deletion warning:', storageError)

      const { error: dbError } = await supabase.from('files').delete().eq('id', fileToDelete.id)
      if (dbError) throw dbError

      showToast('File deleted successfully.', 'success')
      fetchMyFiles()
    } catch (err) {
      console.error(err)
      showToast('Failed to delete file.', 'error')
    } finally {
      setFileToDelete(null)
    }
  }

  const copyLink = (code) => {
    navigator.clipboard.writeText(`${window.location.origin}/download?code=${code}`)
    showToast('Link copied to clipboard!', 'success')
  }

  const validateAndSetFiles = (newFiles) => {
    if (!newFiles || newFiles.length === 0) return
    const validFiles = []
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i]
      if (f.size > MAX_FILE_SIZE) {
        showToast(`File "${f.name}" too large. Max size is ${formatBytes(MAX_FILE_SIZE)}.`, 'error')
      } else {
        validFiles.push(f)
      }
    }
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    validateAndSetFiles(e.dataTransfer.files)
  }, [])

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)

  const handleUpload = async () => {
    if (uploadInProgress.current) return
    if (files.length === 0) return showToast('Please select at least one file first.', 'error')
    if (usePassword && !filePassword) return showToast('Enter a password or disable password protection.', 'error')

    uploadInProgress.current = true
    setUploading(true)
    setProgress(0)
    setStage('encrypting')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const passwordHash = usePassword ? await hashPassword(filePassword) : null
      const code = generateCode()
      const encKey = usePassword ? filePassword : code

      let finalName, finalSize, finalBuffer;

      if (files.length === 1) {
        setStage('encrypting')
        setProgress(10)
        finalName = files[0].name
        finalSize = files[0].size
        finalBuffer = await readFileAsBuffer(files[0])
      } else {
        setStage('compressing')
        setProgress(10)
        const zip = new JSZip()
        for (const f of files) {
          zip.file(f.name, f)
        }
        setProgress(25)
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        finalName = 'Archive.zip'
        finalSize = zipBlob.size
        finalBuffer = await zipBlob.arrayBuffer()
      }

      setProgress(40)
      setStage('encrypting')
      const encryptedBuffer = await encryptFile(finalBuffer, encKey)

      setProgress(60)
      setStage('uploading')
      const storagePath = `${user.id}/${code}/${finalName}.enc`
      const blob = new Blob([encryptedBuffer], { type: 'application/octet-stream' })

      await uploadWithProgress('secure_files', storagePath, blob, (stats) => {
        // Stats: { percent, speed, timeRemaining, loaded, total }
        // Scale 60-95% for the upload part
        const scaledProgress = 60 + (stats.percent * 0.35)
        setProgress(Math.floor(scaledProgress))
        setUploadStats(stats)
      })
      
      setProgress(95)
      setStage('saving')
      const expiryTime = new Date(Date.now() + expiryHours * 3600000).toISOString()
      const { error: dbError } = await supabase.from('files').insert({
        code, name: finalName, size: finalSize, storage_path: storagePath,
        expiry_time: expiryTime, max_downloads: parseInt(maxDownloads),
        current_downloads: 0, is_password_protected: usePassword,
        password_hash: passwordHash, user_id: user.id,
      })
      if (dbError) throw dbError

      setProgress(100)
      fetchMyFiles()
      showToast(`${files.length > 1 ? files.length + ' files bundled and uploaded' : 'File uploaded'} successfully!`, 'success')
      
      // Reset staging
      setFiles([])
      setUsePassword(false)
      setFilePassword('')

      // Redirect to the share page
      navigate(`/share/${code}`)
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Upload failed. Please try again.', 'error')
    } finally {
      setUploading(false)
      setStage('')
      setProgress(0)
      setUploadStats(null)
      uploadInProgress.current = false
    }
  }

  return (
    <>
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
              multiple
              style={{ display: 'none' }}
              onChange={(e) => validateAndSetFiles(e.target.files)}
              disabled={uploading}
            />
            {files.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(35,159,137,0.15)', border: '1px solid rgba(35,159,137,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <File size={16} color="#52bea6" />
                    </div>
                    <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                      <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ color: 'rgba(201,209,217,0.5)', fontSize: '0.75rem' }}>{formatBytes(f.size)}</div>
                    </div>
                    {!uploading && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, idx) => idx !== i)) }}
                        style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(201,209,217,0.5)', flexShrink: 0 }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(35,159,137,0.08)', border: '1px solid rgba(35,159,137,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={22} color="#52bea6" />
                </div>
                <div>
                  <div style={{ color: '#c9d1d9', fontWeight: 600, fontSize: '0.9rem' }}>Drop your files here</div>
                  <div style={{ color: 'rgba(201,209,217,0.45)', fontSize: '0.8rem', marginTop: '0.2rem' }}>or click to browse · Max 50 MB per file</div>
                </div>
              </div>
            )}
          </div>

          {/* Progress */}
          {uploading && (
            <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: '#c9d1d9', fontWeight: 500 }}>
                  {stage === 'compressing' ? '🗜️ Bundling files into Zip…' : stage === 'encrypting' ? '🔐 Encrypting in browser…' : stage === 'saving' ? '💾 Finalizing save…' : '☁️ Uploading encrypted file…'}
                </span>
                <span style={{ color: 'rgba(201,209,217,0.45)' }}>{progress}%</span>
              </div>
              <ProgressBar progress={progress} />
              {uploadStats && stage === 'uploading' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(201,209,217,0.6)', marginTop: '0.2rem' }}>
                  <span>{formatBytes(uploadStats.speed)}/s</span>
                  <span>ETA: {formatTimeRemaining(uploadStats.timeRemaining)}</span>
                </div>
              )}
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
            disabled={uploading || files.length === 0}
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

      {/* My Files Section */}
      <div style={{ marginTop: '3rem' }}>
        <div className="page-header" style={{ marginBottom: '1.5rem', textAlign: 'left', alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f0f6fc', marginBottom: '0.25rem' }}>My Files</h2>
          <p className="subtitle" style={{ fontSize: '0.9rem', margin: 0 }}>Manage your uploaded files and track downloads.</p>
        </div>

        {loadingFiles ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="animate-spin" style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid rgba(35,159,137,0.2)', borderTopColor: '#52bea6', display: 'inline-block' }} />
          </div>
        ) : myFiles.length === 0 ? (
          <div className="card card-body" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <File size={32} color="rgba(201,209,217,0.2)" style={{ margin: '0 auto 1rem' }} />
            <div style={{ color: '#c9d1d9', fontWeight: 500 }}>No files uploaded yet</div>
            <div style={{ color: 'rgba(201,209,217,0.5)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Your uploaded files will appear here.</div>
          </div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(201,209,217,0.6)' }}>
                  <th style={{ padding: '1rem', fontWeight: 500 }}>File</th>
                  <th style={{ padding: '1rem', fontWeight: 500 }}>Status</th>
                  <th style={{ padding: '1rem', fontWeight: 500 }}>Downloads</th>
                  <th style={{ padding: '1rem', fontWeight: 500 }}>Expires</th>
                  <th style={{ padding: '1rem', fontWeight: 500, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myFiles.map(f => {
                  const isExpired = new Date(f.expiry_time) < new Date()
                  const isMaxed = f.current_downloads >= f.max_downloads
                  const isActive = !isExpired && !isMaxed

                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <File size={16} color={isActive ? '#52bea6' : 'rgba(201,209,217,0.3)'} />
                          <div>
                            <div style={{ fontWeight: 500, color: '#e6edf3', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(201,209,217,0.45)' }}>{formatBytes(f.size)} • Code: <span style={{ fontFamily: 'monospace' }}>{f.code}</span></div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {isActive ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', borderRadius: '100px', background: 'rgba(34,197,94,0.1)', color: '#4ade80', fontSize: '0.75rem', fontWeight: 600 }}>
                            <CheckCircle2 size={12} /> Active
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.5rem', borderRadius: '100px', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '0.75rem', fontWeight: 600 }}>
                            <X size={12} /> {isExpired ? 'Expired' : 'Limit Reached'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', color: '#c9d1d9' }}>
                        {f.current_downloads} / {f.max_downloads}
                      </td>
                      <td style={{ padding: '1rem', color: 'rgba(201,209,217,0.6)' }}>
                        {formatExpiry(f.expiry_time)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button onClick={() => copyLink(f.code)} className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} title="Copy Link" disabled={!isActive}>
                            <Copy size={14} />
                          </button>
                          <button onClick={() => navigate(`/share/${f.code}`)} className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }} title="Share Page" disabled={!isActive}>
                            <ExternalLink size={14} />
                          </button>
                          <button onClick={() => confirmDelete(f)} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', color: '#f87171', borderColor: 'rgba(248,113,113,0.2)' }} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {/* Delete Modal */}
      {fileToDelete && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card card-body fade-in-up" style={{ maxWidth: '400px', width: '100%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#f0f6fc', fontSize: '1.1rem' }}>Confirm Delete</h3>
            <p style={{ color: 'rgba(201,209,217,0.7)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Are you sure you want to delete "<strong>{fileToDelete.name}</strong>"? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setFileToDelete(null)} className="btn-secondary">Cancel</button>
              <button onClick={proceedDelete} className="btn-primary" style={{ background: '#f87171', color: '#111' }}>Delete File</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <Toast toast={toast} onClose={clearToast} />
    </>
  )
}
