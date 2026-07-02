import Link from 'next/link';
import {
  ShoppingBag,
  Store,
  Truck,
  Wrench,
  Zap,
  MapPin,
  Wallet,
  ArrowRight,
} from 'lucide-react';

/**
 * Public landing page.
 *
 * Hero pitches the customer flow (the loudest CTA), with a quieter row of
 * role cards underneath for shop owners, delivery partners, and admins.
 * Routes are unchanged: /customer /shop /delivery /admin.
 */
export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#fafafa]">
      {/* =================== HERO =================== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-yellow via-brand-yellow to-brand-yellowDark">
        {/* Soft radial accents */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-brand-green/10 blur-3xl" />

        <div className="relative container py-12 sm:py-20">
          <div className="max-w-2xl mx-auto text-center space-y-5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase bg-white/70 backdrop-blur px-3 py-1.5 rounded-full text-black/80">
              <Zap className="h-3 w-3 fill-current text-brand-green" />
              Delivery in 15 minutes
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white drop-shadow-sm leading-[1.05]">
              Sarvopakar
              <span className="block text-2xl sm:text-3xl font-bold mt-1">सर्वोपकार</span>
            </h1>

            <p className="text-base sm:text-lg text-black/75 max-w-md mx-auto">
              Groceries, daily needs and more from shops in your neighbourhood —
              delivered to your door in minutes.
            </p>

            <div className="pt-3 flex flex-col sm:flex-row gap-2.5 justify-center items-stretch sm:items-center">
              <Link
                href="/customer"
                className="inline-flex items-center justify-center gap-2 bg-brand-green text-white font-bold text-base px-6 py-3.5 rounded-full shadow-lg shadow-brand-green/30 hover:bg-brand-green/90 active:scale-[0.98] transition"
              >
                <ShoppingBag className="h-4 w-4" />
                Start shopping
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/customer?mode=services"
                className="inline-flex items-center justify-center gap-2 bg-white/90 backdrop-blur text-black font-bold text-base px-6 py-3.5 rounded-full border border-black/10 shadow-lg shadow-black/5 hover:bg-white active:scale-[0.98] transition"
              >
                <Wrench className="h-4 w-4" />
                Book a service
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-white/80 backdrop-blur text-black font-semibold text-sm px-5 py-3.5 rounded-full border border-black/10 hover:bg-white active:scale-[0.98] transition"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =================== VALUE PROPS =================== */}
      <section className="container -mt-7 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
          <ValueCard
            icon={<Zap className="h-5 w-5" />}
            title="15-min delivery"
            subtitle="Lightning fast from nearby shops"
            tint="bg-[#fff5d6] text-[#8a6500]"
          />
          <ValueCard
            icon={<MapPin className="h-5 w-5" />}
            title="Local shops"
            subtitle="Support your neighbourhood stores"
            tint="bg-[#dcf3e1] text-brand-green"
          />
          <ValueCard
            icon={<Wallet className="h-5 w-5" />}
            title="Pay your way"
            subtitle="UPI, cards, or cash on delivery"
            tint="bg-[#dbe9ff] text-[#1857c1]"
          />
        </div>
      </section>

      {/* =================== ROLE CARDS =================== */}
      <section className="container py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Join Sarvopakar
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Whether you&apos;re here to buy, sell, or deliver — we&apos;ve got you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
          <RoleCard
            href="/shop"
            icon={<Store className="h-6 w-6" />}
            iconBg="bg-[#fff5d6] text-[#8a6500]"
            title="I run a shop"
            subtitle="List your products, manage orders, grow your sales online."
            cta="Start selling"
          />
          <RoleCard
            href="/delivery"
            icon={<Truck className="h-6 w-6" />}
            iconBg="bg-[#dcf3e1] text-brand-green"
            title="I deliver"
            subtitle="Earn on your schedule by delivering orders nearby."
            cta="Start earning"
          />
          <RoleCard
            href="/customer?mode=services"
            icon={<Wrench className="h-6 w-6" />}
            iconBg="bg-[#e8d6f7] text-[#6b3aa0]"
            title="Book a service"
            subtitle="Plumbers, salons, AC repair, garages and more — near you."
            cta="Explore services"
          />
        </div>
      </section>

      {/* =================== FOOTER =================== */}
      <footer className="mt-auto border-t bg-card">
        <div className="container py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="font-semibold">
            <span className="text-foreground">Sarvo</span>
            <span className="text-brand-green">pakar</span>
            <span className="ml-2 font-normal">— made for neighbourhoods.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/customer" className="hover:text-foreground transition">
              Browse shops
            </Link>
            <Link href="/login" className="hover:text-foreground transition">
              Sign in
            </Link>
            <a
              href="mailto:support@sarvopakar.com"
              className="hover:text-foreground transition"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ----------------------------------------------------------------------- */

interface ValueCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tint: string;
}

function ValueCard({ icon, title, subtitle, tint }: ValueCardProps) {
  return (
    <div className="bg-card border rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
      <div
        className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${tint}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-bold leading-tight">{title}</div>
        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
          {subtitle}
        </div>
      </div>
    </div>
  );
}

interface RoleCardProps {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  cta: string;
}

function RoleCard({ href, icon, iconBg, title, subtitle, cta }: RoleCardProps) {
  return (
    <Link
      href={href}
      className="group bg-card border rounded-2xl p-5 hover:border-brand-green hover:shadow-md transition flex flex-col"
    >
      <div
        className={`h-12 w-12 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}
      >
        {icon}
      </div>
      <div className="text-base font-bold tracking-tight">{title}</div>
      <p className="text-[13px] text-muted-foreground leading-snug mt-1 flex-1">
        {subtitle}
      </p>
      <div className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-green group-hover:gap-2 transition-all">
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}
