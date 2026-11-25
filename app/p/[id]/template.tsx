// Re-mounts on every tab change inside a project, so each tab slides in.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
