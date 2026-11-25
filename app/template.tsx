// Re-mounts on every top-level navigation (overview ↔ project ↔ account) for a soft cross-fade.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-fade">{children}</div>;
}
