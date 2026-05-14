/**
 * Delivery pages render their own header (dark, with the online/offline
 * toggle), so this layout just provides the background container — the
 * customer-facing Header with the cart icon doesn't belong here.
 */
export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f4f4f4]">{children}</div>;
}
