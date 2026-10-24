export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f2f5f5] text-[#13201f]">
      {children}
    </div>
  );
}
