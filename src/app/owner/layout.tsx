import OwnerSidebar from "@/components/OwnerSidebar";

// Per-owner, auth-gated pages — never prerender at build time.
export const dynamic = "force-dynamic";

/**
 * Business area shell: a sidebar + wide content on desktop, plain full-width
 * on mobile (the sidebar is hidden). Individual pages own their content width.
 */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex">
      <OwnerSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
