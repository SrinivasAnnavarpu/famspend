import Link from 'next/link'

export default function Home() {
  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" aria-hidden />
          <div className="brandTitle">FamSpend</div>
        </div>
        <div className="row">
          <Link className="btn btnGhost" href="/login">Sign in</Link>
          <Link className="btn btnPrimary" href="/app">Open app</Link>
        </div>
      </div>

      <div className="card">
        <div className="cardBody" style={{ padding: 28 }}>
          <div className="badge">Free • Web + PWA • Multi-currency</div>
          <h1 className="h1" style={{ marginTop: 14 }}>
            Track family expenses
            <br />
            across currencies.
          </h1>
          <p className="p">
            Fast entry. Shared with your family. Auto daily FX rate (by expense date). Export to CSV.
          </p>

          <div className="row" style={{ marginTop: 18 }}>
            <Link className="btn btnPrimary" href="/login">
              Create account
            </Link>
            <Link className="btn" href="/app">
              Continue
            </Link>
          </div>

          <div className="row" style={{ marginTop: 18 }}>
            <div className="card" style={{ flex: '1 1 240px' }}>
              <div className="cardBody">
                <div className="h2">Simple entry</div>
                <p className="p" style={{ marginTop: 6 }}>
                  Category • Amount • Date. Currency is automatic.
                </p>
              </div>
            </div>
            <div className="card" style={{ flex: '1 1 240px' }}>
              <div className="cardBody">
                <div className="h2">Accurate totals</div>
                <p className="p" style={{ marginTop: 6 }}>
                  We store the FX rate used with each expense, so reports stay consistent.
                </p>
              </div>
            </div>
            <div className="card" style={{ flex: '1 1 240px' }}>
              <div className="cardBody">
                <div className="h2">Export anytime</div>
                <p className="p" style={{ marginTop: 6 }}>
                  Download CSV for Excel/Sheets and share with your family.
                </p>
              </div>
            </div>
          </div>

          <p className="help" style={{ marginTop: 18 }}>
            Tip: on mobile, use “Add to Home Screen” to install as a PWA.
          </p>
        </div>
      </div>
    </div>
  )
}
