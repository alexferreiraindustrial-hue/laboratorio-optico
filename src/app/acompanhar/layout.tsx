export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3ece1] text-[#1a1714]">
      {children}
    </div>
  );
}
