import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { Shield, Upload, Download, LogOut, Menu, X, Lock } from 'lucide-react'

export default function Navbar({ session }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navLinks = [
    { to: '/dashboard', label: 'Upload', icon: Upload, auth: true },
    { to: '/download', label: 'Download', icon: Download, auth: false },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #239f89, #f19a3e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(35,159,137,0.4)',
          }}>
            <Shield size={15} color="#fff" />
          </div>
          <span className="gradient-text font-display" style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
            SecureShare
          </span>
        </Link>

        {/* Desktop nav */}
        <div style={{ display: 'none', alignItems: 'center', gap: '0.25rem' }} className="nav-links">
          {navLinks.map(({ to, label, icon: Icon, auth }) => {
            if (auth && !session) return null
            const active = isActive(to)
            return (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.375rem 0.875rem', borderRadius: '8px',
                  fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none',
                  transition: 'all 0.15s',
                  color: active ? '#52bea6' : 'rgba(201,209,217,0.65)',
                  background: active ? 'rgba(35,159,137,0.12)' : 'transparent',
                }}
              >
                <Icon size={14} />
                {label}
              </Link>
            )
          })}
        </div>

        {/* Desktop auth */}
        <div style={{ display: 'none', alignItems: 'center', gap: '0.75rem' }} className="nav-auth">
          {session ? (
            <>
              <span style={{ fontSize: '0.8rem', color: 'rgba(201,209,217,0.45)' }}>
                {session.user?.email}
              </span>
              <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', borderRadius: '8px' }}>
                <LogOut size={13} />
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', borderRadius: '8px' }}>
              <Lock size={13} />
              Sign In
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem', borderRadius: '8px', background: 'transparent', border: 'none', color: 'rgba(201,209,217,0.6)', cursor: 'pointer' }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          className="hamburger"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background: 'rgba(17,22,29,0.97)', borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '0.75rem 1.5rem 1rem',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
            {navLinks.map(({ to, label, icon: Icon, auth }) => {
              if (auth && !session) return null
              const active = isActive(to)
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.6rem 0.75rem', borderRadius: '8px',
                    fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
                    color: active ? '#52bea6' : 'rgba(201,209,217,0.7)',
                    background: active ? 'rgba(35,159,137,0.1)' : 'transparent',
                  }}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              )
            })}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
            {session ? (
              <button onClick={handleLogout} className="btn-secondary" style={{ width: '100%', fontSize: '0.85rem' }}>
                <LogOut size={14} />
                Logout
              </button>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-primary" style={{ width: '100%', fontSize: '0.85rem', justifyContent: 'center' }}>
                <Lock size={14} />
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 640px) {
          .nav-links { display: flex !important; }
          .nav-auth { display: flex !important; }
          .hamburger { display: none !important; }
        }
      `}</style>
    </nav>
  )
}
