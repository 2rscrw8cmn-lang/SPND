export default function Loading() {
  return <main className="app-frame" aria-label="Loading SPND"><div className="skeleton skeleton-header" /><div className="skeleton skeleton-hero" /><div className="skeleton-list">{[1,2,3,4].map((item) => <div className="skeleton skeleton-row" key={item} />)}</div><span className="sr-only">Getting the latest picture…</span></main>;
}
