import Link from "next/link";
export default function NotFound(){return <main id="main" className="page error-page"><span className="eyebrow accent">404 / Not in the catalogue</span><h1>A different<br/>kind of problem.</h1><p className="muted">We couldn’t find that page or problem in the imported catalogue.</p><Link className="button primary" href="/problems">Browse problems ↗</Link></main>;}
