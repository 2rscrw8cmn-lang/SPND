import Link from "next/link";

export default function NotFound() {
  return <main className="auth-page"><section className="auth-card card"><p className="eyebrow">404</p><h1>Nothing to SPND here.</h1><p>The page may have moved.</p><Link className="primary-button" style={{ display: "grid", placeItems: "center" }} href="/">Back home</Link></section></main>;
}

