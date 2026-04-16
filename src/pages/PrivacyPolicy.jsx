import { Shield } from 'lucide-react'

export default function PrivacyPolicy() {
  return (
    <div className="page-wrapper fade-in-up" style={{ maxWidth: '780px' }}>
      <div className="page-header" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(35,159,137,0.15)', border: '1px solid rgba(35,159,137,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Shield size={20} color="#52bea6" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.02em' }}>Privacy Policy</h1>
          <p style={{ fontSize: '0.8rem', color: 'rgba(201,209,217,0.4)', marginTop: '0.2rem' }}>Last updated: April 2025</p>
        </div>
      </div>

      <div className="card card-body-lg" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        <Section title="1. Information We Collect">
          <p>We collect only the minimum data necessary to provide our service:</p>
          <ul>
            <li>Your email address (for account creation and authentication)</li>
            <li>Encrypted file blobs (we cannot read their contents)</li>
            <li>File metadata: name, size, expiry settings, download counts</li>
            <li>Standard server logs (IP address, timestamp, user-agent)</li>
          </ul>
        </Section>
        <Section title="2. End-to-End Encryption">
          <p>All files are encrypted in your browser using AES-256-GCM before they reach our servers. We store only the encrypted ciphertext. We do not have access to your encryption keys, passwords, or the original file content.</p>
        </Section>
        <Section title="3. How We Use Your Data">
          <ul>
            <li>To authenticate you and manage your account</li>
            <li>To store and serve your encrypted files</li>
            <li>To enforce download limits and expiry times</li>
            <li>To improve our service (anonymized analytics only)</li>
          </ul>
        </Section>
        <Section title="4. Data Retention">
          <p>Files are automatically deleted when they reach their download limit or expiry time. Account data is retained until you delete your account. You may request deletion at any time by contacting us.</p>
        </Section>
        <Section title="5. Third-Party Services">
          <p>We use the following third-party services:</p>
          <ul>
            <li><strong>Supabase</strong> – database, authentication, and file storage</li>
            <li><strong>Google Fonts</strong> – typography (no tracking)</li>
          </ul>
        </Section>
        <Section title="6. Your Rights" last>
          <p>You have the right to access, correct, or delete your personal data. Contact us at <a href="mailto:privacy@secureshare.app" style={{ color: '#52bea6' }}>privacy@secureshare.app</a> for any requests.</p>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children, last }) {
  return (
    <div style={{ padding: '1.25rem 0', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700, color: '#e6edf3', marginBottom: '0.625rem' }}>{title}</h2>
      <div style={{ fontSize: '0.875rem', color: 'rgba(201,209,217,0.6)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {children}
      </div>
      <style>{`
        .card-body-lg ul { padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.3rem; }
        .card-body-lg li { font-size: 0.875rem; color: rgba(201, 209, 217, 0.6); }
        .card-body-lg strong { color: #c9d1d9; }
      `}</style>
    </div>
  )
}
