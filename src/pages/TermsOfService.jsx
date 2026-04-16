import { FileText } from 'lucide-react'

export default function TermsOfService() {
  return (
    <div className="page-wrapper fade-in-up" style={{ maxWidth: '780px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(241,154,62,0.12)', border: '1px solid rgba(241,154,62,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={20} color="#f2b76a" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: '#e6edf3', letterSpacing: '-0.02em' }}>Terms of Service</h1>
          <p style={{ fontSize: '0.8rem', color: 'rgba(201,209,217,0.4)', marginTop: '0.2rem' }}>Last updated: April 2025</p>
        </div>
      </div>

      <div className="card card-body-lg">
        <Section title="1. Acceptance of Terms">
          <p>By using SecureShare, you agree to these Terms of Service. If you do not agree, please do not use the service.</p>
        </Section>
        <Section title="2. Description of Service">
          <p>SecureShare is a file-sharing platform that encrypts files client-side before uploading them. Files are accessible only via a unique 6-digit code and, optionally, a user-set password.</p>
        </Section>
        <Section title="3. Acceptable Use">
          <p>You agree NOT to use SecureShare to:</p>
          <ul>
            <li>Upload or share illegal content of any kind</li>
            <li>Distribute malware, viruses, or harmful software</li>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe on intellectual property rights</li>
            <li>Harass, abuse, or harm others</li>
            <li>Attempt to bypass security measures</li>
          </ul>
        </Section>
        <Section title="4. File Limits and Retention">
          <ul>
            <li>Maximum file size: 50 MB per upload</li>
            <li>Maximum expiry: 720 hours (30 days)</li>
            <li>Files are automatically deleted after expiry or download limit is reached</li>
            <li>We reserve the right to delete files that violate these terms</li>
          </ul>
        </Section>
        <Section title="5. No Warranty">
          <p>SecureShare is provided "as is" without warranties of any kind. We do not guarantee 100% uptime or data availability. You should maintain your own copies of important files.</p>
        </Section>
        <Section title="6. Limitation of Liability">
          <p>To the fullest extent permitted by law, SecureShare and its operators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service.</p>
        </Section>
        <Section title="7. Contact" last>
          <p>For questions about these terms, contact us at <a href="mailto:legal@secureshare.app" style={{ color: '#52bea6' }}>legal@secureshare.app</a>.</p>
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
      `}</style>
    </div>
  )
}
