import Link from "next/link";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-300">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">

        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="leading-tight text-text">
            <span className="block text-xl font-semibold tracking-tight sm:text-2xl">
              Quinfosys<span style={{ verticalAlign: "super", fontSize: "0.65em", lineHeight: 0 }}>™</span> QuDrugForge
            </span>
            <span className="mt-1 block text-xs font-medium text-text-muted sm:text-sm">
              Quantum AI for Drug Discovery
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <Link href="/#features" className="text-sm font-bold uppercase tracking-widest text-text-secondary transition hover:text-primary">
              Features
            </Link>
            <Link href="/#workflow" className="text-sm font-bold uppercase tracking-widest text-text-secondary transition hover:text-primary">
              Workflow
            </Link>
            <Link href="/#targets" className="text-sm font-bold uppercase tracking-widest text-text-secondary transition hover:text-primary">
              Targets
            </Link>
            <Link href="/pricing" className="text-sm font-bold uppercase tracking-widest text-text-secondary transition hover:text-primary">
              Pricing
            </Link>
          </div>


          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/pricing"
              className="rounded-lg px-2 py-2 text-xs font-bold uppercase tracking-wider text-text-secondary transition hover:text-primary md:hidden"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="hidden rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-text-muted transition hover:border-accent/40 hover:text-text sm:inline-flex"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="btn-primary-glow rounded-lg px-3 py-2 text-sm font-semibold"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}
