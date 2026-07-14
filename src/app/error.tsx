"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="auth-page"><section className="auth-card card"><p className="eyebrow">Something needs attention</p><h1>SPND couldn’t load this view.</h1><p>Your last-known financial data is still safe.</p><button className="primary-button" onClick={reset}>Try again</button></section></main>;
}

