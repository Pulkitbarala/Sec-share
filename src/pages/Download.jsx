import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { decryptFile, hashPassword, triggerDownload } from '../utils/crypto'
import { formatBytes, formatTimeRemaining } from '../utils/formatters'
import { downloadWithProgress } from '../utils/network'
import ProgressBar from '../components/ProgressBar'
import { Toast, useToast } from '../components/Toast'
import { Download as DownloadIcon, Lock, Eye, EyeOff, Search, AlertTriangle, File, X, ShieldCheck } from 'lucide-react'

const STAGE_IDLE = 'idle'
const STAGE_PASSWORD = 'password'
const STAGE_DOWNLOADING = 'downloading'
const STAGE_DECRYPTING = 'decrypting'
const STAGE_DONE = 'done'

export default function Download() {
  const [searchParams] = useSearchParams()
  const { toast, showToast, clearToast } = useToast()

  const [codeInput, setCodeInput] = useState(searchParams.get('code') || '')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [filesMap, setFilesMap] = useState({})

  const autoLookupRan = useRef(false)

  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode && urlCode.length === 6 && !autoLookupRan.current) {
      autoLookupRan.current = true
      handleLookup(urlCode)
    }
  }, [])

  const handleLookup = async (lookupCode) => {
    const c = (lookupCode || codeInput).trim()
    if (c.length !== 6 || !/^\d{6}$/.test(c)) return showToast('Please enter a valid 6-digit numeric code.', 'error')

    setIsLookingUp(true)
    try {
      const { data, error: dbError } = await supabase.from('files').select('*').eq('code', c)
      if (dbError || !data || data.length === 0) throw new Error('No files found for this code. They may have been deleted.')
      
      const validFiles = []
      let errors = []
      for (const f of data) {
        if (new Date(f.expiry_time) < new Date()) { errors.push(`File ${f.name} has expired.`); continue; }
        if (f.current_downloads >= f.max_downloads) { errors.push(`File ${f.name} reached download limit.`); continue; }
        validFiles.push(f)
      }

      if (validFiles.length === 0) throw new Error(errors[0] || 'No valid files found for this code.')
      
      let addedCount = 0
      setFilesMap(prev => {
        const newMap = { ...prev }
        validFiles.forEach(f => {
          if (!newMap[f.id]) {
            newMap[f.id] = {
              data: f,
              stage: f.is_password_protected ? STAGE_PASSWORD : STAGE_IDLE,
              progress: 0,
              password: '',
              showPassword: false,
              error: null,
              decryptionKey: f.is_password_protected ? null : c
            }
            addedCount++
          }
        })
        return newMap
      })
      
      setCodeInput('')
      if (addedCount > 0) {
        showToast(`${addedCount} file(s) found and added to your list.`, 'success')
        if (errors.length > 0) showToast(errors.join(' '), 'info')
      } else {
        showToast('These files are already in the list.', 'info')
      }
    } catch (err) {
      showToast(err.message || 'Something went wrong.', 'error')
    } finally {
      setIsLookingUp(false)
    }
  }

  const updateFileState = (id, updates) => {
    setFilesMap(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }))
  }

  const removeFile = (id) => {
    setFilesMap(prev => {
      const newMap = { ...prev }
      delete newMap[id]
      return newMap
    })
  }

  const handlePasswordSubmit = async (fileId) => {
    const fileItem = filesMap[fileId]
    if (!fileItem.password) return showToast('Please enter the password.', 'error')
    
    const inputHash = await hashPassword(fileItem.password)
    if (inputHash !== fileItem.data.password_hash) {
      updateFileState(fileId, { error: 'Incorrect password. Please try again.' })
      return
    }
    
    updateFileState(fileId, { error: null, decryptionKey: fileItem.password })
    await performDownload(fileId, fileItem.password)
  }

  const performDownload = async (fileId, decryptionKey) => {
    const fileItem = filesMap[fileId]
    const data = fileItem.data
    
    updateFileState(fileId, { stage: STAGE_DOWNLOADING, progress: 10, error: null, networkStats: null })
    
    try {
      const encryptedBuffer = await downloadWithProgress('secure_files', data.storage_path, (stats) => {
        // Stats: { percent, speed, timeRemaining, loaded, total }
        // Scale 10-60% for the download part
        const scaledProgress = 10 + (stats.percent * 0.5)
        updateFileState(fileId, { progress: Math.floor(scaledProgress), networkStats: stats })
      })
      
      updateFileState(fileId, { progress: 60, stage: STAGE_DECRYPTING, networkStats: null })
      let decryptedBuffer
      try { decryptedBuffer = await decryptFile(encryptedBuffer, decryptionKey) }
      catch { throw new Error('Decryption failed. Wrong password or corrupted file.') }
      
      updateFileState(fileId, { progress: 85 })
      const { error: rpcError } = await supabase.rpc('record_download', { file_id: data.id })
      if (rpcError) console.warn('Could not record download:', rpcError.message)
      
      updateFileState(fileId, { progress: 95 })
      
      let wasUnzipped = false;
      if (data.name.endsWith('.zip')) {
        try {
          // Import JSZip dynamically if it's a zip file
          const JSZip = (await import('jszip')).default
          const zip = await JSZip.loadAsync(decryptedBuffer)
          const zipFiles = Object.values(zip.files)
          for (const zf of zipFiles) {
            if (!zf.dir) {
              const fileData = await zf.async('arraybuffer')
              triggerDownload(fileData, zf.name)
              await new Promise(r => setTimeout(r, 600)) // delay to avoid popup blockers
            }
          }
          wasUnzipped = true
        } catch (zipErr) {
          console.warn('Failed to unzip, downloading as is', zipErr)
        }
      }
      
      if (!wasUnzipped) {
        triggerDownload(decryptedBuffer, data.name)
      }
      
      const { data: refreshed } = await supabase.from('files').select('current_downloads, max_downloads, expiry_time').eq('id', data.id).single()
      
      updateFileState(fileId, { 
        stage: STAGE_DONE, 
        progress: 100,
        data: refreshed ? { ...data, ...refreshed } : data 
      })
      
    } catch (err) {
      updateFileState(fileId, { 
        stage: data.is_password_protected ? STAGE_PASSWORD : STAGE_IDLE, 
        progress: 0, 
        error: err.message 
      })
      showToast(`Error downloading ${data.name}: ${err.message}`, 'error')
    }
  }

  const handleClearAll = () => {
    setFilesMap({})
    setCodeInput('')
    // clear the url param
    if (searchParams.has('code')) {
      window.history.replaceState({}, '', '/download')
    }
  }

  const handleDownloadAll = async () => {
    const filesList = Object.values(filesMap)
    let downloadedCount = 0
    for (const fileItem of filesList) {
      if (fileItem.stage === STAGE_IDLE || (fileItem.stage === STAGE_DONE && fileItem.decryptionKey)) {
        await performDownload(fileItem.data.id, fileItem.decryptionKey)
        downloadedCount++
      } else if (fileItem.stage === STAGE_PASSWORD) {
        showToast(`Skipped ${fileItem.data.name} (password required)`, 'info')
      }
    }
    if (downloadedCount > 0) {
      showToast(`Finished downloading ${downloadedCount} file(s).`, 'success')
    }
  }

  const filesList = Object.values(filesMap)

  return (
    <>
      <div className="page-wrapper fade-in-up">
        {/* Header */}
        <div className="page-header">
          <span className="eyebrow">Secure download</span>
          <h1>Download Files</h1>
          <p className="subtitle">Enter your 6-digit codes to retrieve and decrypt files.</p>
        </div>

      <div className="two-col">
        {/* Left: main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Code lookup */}
          <div className="card-strong card-body">
            <div>
              <label className="label" htmlFor="share-code">Add Share Code</label>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <input
                  id="share-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="input"
                  style={{ textAlign: 'center', fontSize: '1.5rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.35rem' }}
                  placeholder="000000"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  disabled={isLookingUp}
                />
                <button
                  id="lookup-btn"
                  className="btn-primary"
                  onClick={() => handleLookup()}
                  disabled={isLookingUp || codeInput.length !== 6}
                  style={{ flexShrink: 0, padding: '0 1.25rem' }}
                >
                  {isLookingUp
                    ? <span className="animate-spin" style={{ width: '15px', height: '15px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', display: 'inline-block' }} />
                    : <Search size={17} />}
                </button>
              </div>
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'rgba(201,209,217,0.5)' }}>
              You can add multiple codes one by one to download several files.
            </div>
          </div>

          {/* List of files */}
          {filesList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f0f6fc', margin: 0 }}>Files Ready to Download</h3>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button onClick={handleDownloadAll} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#52bea6', color: '#111', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    <DownloadIcon size={14} /> Download All
                  </button>
                  <button onClick={handleClearAll} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
                    Clear All
                  </button>
                </div>
              </div>

              {filesList.map((fileItem) => {
                const { data, stage, progress, password, showPassword, error } = fileItem
                const isDownloadingStage = stage === STAGE_DOWNLOADING || stage === STAGE_DECRYPTING

                return (
                  <div key={data.id} className="card card-body" style={{ position: 'relative' }}>
                    <button 
                      onClick={() => removeFile(data.id)}
                      style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'rgba(201,209,217,0.4)', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', paddingRight: '2rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(35,159,137,0.15)', border: '1px solid rgba(35,159,137,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <File size={22} color="#52bea6" />
                      </div>
                      <div>
                        <div style={{ color: '#e6edf3', fontWeight: 600, fontSize: '1.05rem', wordBreak: 'break-word' }}>{data.name}</div>
                        <div style={{ color: 'rgba(201,209,217,0.5)', fontSize: '0.85rem' }}>{formatBytes(data.size)}</div>
                      </div>
                    </div>

                    {error && (
                      <div className="notice notice-red" style={{ borderRadius: '8px', marginBottom: '1rem', padding: '0.5rem 0.75rem' }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                        <span style={{ fontSize: '0.85rem' }}>{error}</span>
                      </div>
                    )}

                    {stage === STAGE_IDLE && (
                      <button className="btn-primary" onClick={() => performDownload(data.id, fileItem.decryptionKey)} style={{ width: '100%', justifyContent: 'center' }}>
                        <DownloadIcon size={16} />
                        Download File
                      </button>
                    )}

                    {stage === STAGE_PASSWORD && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ position: 'relative' }}>
                          <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(201,209,217,0.35)' }} />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            className="input"
                            style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                            placeholder="Enter file password"
                            value={password}
                            onChange={(e) => updateFileState(data.id, { password: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit(data.id)}
                          />
                          <button
                            type="button"
                            onClick={() => updateFileState(data.id, { showPassword: !showPassword })}
                            style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(201,209,217,0.4)', display: 'flex' }}
                          >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        <button className="btn-primary" onClick={() => handlePasswordSubmit(data.id)} style={{ width: '100%', justifyContent: 'center' }}>
                          <ShieldCheck size={15} />
                          Verify &amp; Download
                        </button>
                      </div>
                    )}

                    {isDownloadingStage && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#c9d1d9', fontWeight: 500 }}>
                          <span>{stage === STAGE_DOWNLOADING ? '☁️ Fetching encrypted file…' : '🔓 Decrypting in browser…'}</span>
                          <span>{progress}%</span>
                        </div>
                        <ProgressBar progress={progress} />
                        {fileItem.networkStats && stage === STAGE_DOWNLOADING && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(201,209,217,0.6)', marginTop: '0.2rem' }}>
                            <span>{formatBytes(fileItem.networkStats.speed)}/s</span>
                            <span>ETA: {formatTimeRemaining(fileItem.networkStats.timeRemaining)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {stage === STAGE_DONE && (
                      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                        <div style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <DownloadIcon size={16} /> Download complete!
                        </div>
                        <button className="btn-secondary" onClick={() => performDownload(data.id, fileItem.decryptionKey)} style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>
                          Download Again
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: how-it-works */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card card-body">
            <div className="section-title">How it works</div>
            <div className="step-list">
              <div className="step-item"><span className="step-num">1</span>Enter a 6-digit share code to add a file.</div>
              <div className="step-item"><span className="step-num">2</span>Add as many codes as you need.</div>
              <div className="step-item"><span className="step-num">3</span>Download files to your device. Decryption happens locally in your browser.</div>
            </div>
            <hr className="divider" />
            <div className="notice notice-brand" style={{ borderRadius: '10px' }}>
              <ShieldCheck size={13} color="#52bea6" style={{ flexShrink: 0 }} />
              <span>Files are decrypted entirely in your browser. We never see your file contents.</span>
            </div>
          </div>
        </div>
      </div>

      </div>

      <Toast toast={toast} onClose={clearToast} />
    </>
  )
}
