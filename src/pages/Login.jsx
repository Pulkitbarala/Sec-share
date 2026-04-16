import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { Toast, useToast } from '../components/Toast'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast, showToast, clearToast } = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return showToast('Please fill in all fields.', 'error')
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        showToast('Account created! Check your email to confirm, then log in.', 'success')
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      showToast(err.message || 'Authentication failed.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '960px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}
        className="login-grid">

        {/* Left: hero */}
        <div className="login-hero" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #239f89, #f19a3e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(35,159,137,0.4)', marginBottom: '1.25rem' }}>
              <Shield size={24} color="#fff" />
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '0.75rem' }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'rgba(201,209,217,0.6)', lineHeight: 1.6 }}>
              {mode === 'login'
                ? 'Sign in to manage and share your encrypted files securely.'
                : 'Start sharing files with military-grade end-to-end encryption.'}
            </p>
          </div>

          {/* Feature bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {[
              'AES-256-GCM encryption in your browser',
              'Password protection & download limits',
              'Auto-expiring links with countdown',
            ].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.85rem', color: 'rgba(201,209,217,0.6)' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#52bea6', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'rgba(201,209,217,0.35)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Lock size={11} />
            Protected with AES-256 end-to-end encryption
          </div>
        </div>

        {/* Right: form */}
        <div>
          <div className="card-strong card-body-lg">
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(201,209,217,0.4)', marginBottom: '0.375rem' }}>
                {mode === 'login' ? 'Sign in' : 'Sign up'}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e6edf3' }}>
                {mode === 'login' ? 'Access your files' : 'Get started for free'}
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="label" htmlFor="email">Email address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(201,209,217,0.35)' }} />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="input"
                    style={{ paddingLeft: '2.25rem' }}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="password">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(201,209,217,0.35)' }} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="input"
                    style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(201,209,217,0.4)', display: 'flex' }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <div style={{ fontSize: '0.75rem', color: 'rgba(201,209,217,0.4)', marginTop: '0.3rem' }}>Minimum 6 characters</div>
                )}
              </div>

              <button id="auth-submit" type="submit" className="btn-primary btn-lg" style={{ width: '100%', marginTop: '0.25rem' }} disabled={loading}>
                {loading ? (
                  <>
                    <span className="animate-spin" style={{ width: '15px', height: '15px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', display: 'inline-block' }} />
                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                  </>
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: '0.85rem', color: 'rgba(201,209,217,0.5)' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                style={{ color: '#52bea6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', fontFamily: 'var(--font-sans)' }}
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive: stack on mobile */}
      <style>{`
        @media (max-width: 700px) {
          .login-grid { grid-template-columns: 1fr !important; gap: 2rem !important; }
          .login-hero { display: none !important; }
        }
      `}</style>

      <Toast toast={toast} onClose={clearToast} />
    </div>
  )
}
