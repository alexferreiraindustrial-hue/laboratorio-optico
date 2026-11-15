export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#edf4f4] text-[#172e32]">
      {children}
    </div>
  );
}
