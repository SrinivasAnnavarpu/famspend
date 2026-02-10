import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 40, letterSpacing: -0.5, margin: 0 }}>FamSpend</h1>
      <p style={{ color: '#475569', marginTop: 8 }}>
        Free family expense tracker (web + PWA).
      </p>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Link href="/login">Go to login</Link>
        <Link href="/app">Open app</Link>
      </div>

      <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #e2e8f0' }} />
      <p style={{ color: '#64748b', fontSize: 14 }}>
        Note: this is a skeleton. Next step is the data model (families, categories, expenses) and the Add Expense flow.
      </p>
    </main>
  )
}
