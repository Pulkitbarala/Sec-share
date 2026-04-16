import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './utils/supabase'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Share from './pages/Share'
import Download from './pages/Download'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="bg-animated" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ position: 'relative', width: '48px', height: '48px' }}>
          <div className="pulse-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(35,159,137,0.4)' }} />
          <div className="animate-spin" style={{ position: 'absolute', inset: '6px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#52bea6' }} />
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="bg-animated">
        <Navbar session={session} />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={session ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
            <Route path="/login" element={session ? <Navigate to="/dashboard" /> : <Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute session={session}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/share/:code" element={<Share />} />
            <Route path="/download" element={<Download />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '1.25rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: 'rgba(201,209,217,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          flexWrap: 'wrap',
        }}>
          <span>© {new Date().getFullYear()} SecureShare</span>
          <a href="/privacy" style={{ color: 'rgba(201,209,217,0.45)', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" style={{ color: 'rgba(201,209,217,0.45)', textDecoration: 'none' }}>Terms of Service</a>
        </footer>
      </div>
    </BrowserRouter>
  )
}
