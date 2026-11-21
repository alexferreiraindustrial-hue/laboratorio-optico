export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--accent-soft)] text-[var(--ink)]">
      {children}
    </div>
  );
}
