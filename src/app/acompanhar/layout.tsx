export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3ece2] text-[#222222]">
      {children}
    </div>
  );
}
