/**
 * Owner pages render their own header (with the shop avatar + Open/Closed
 * toggle) — so this layout intentionally does nothing beyond providing a
 * container. The customer-facing Header (with cart icon) doesn't belong here.
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f4f4f4]">{children}</div>;
}
