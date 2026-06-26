import Link from "next/link";

export function FooterSection() {
  return (
    <footer className="mt-24 border-t border-border/50 bg-card/30 px-6 py-16 backdrop-blur-sm md:px-12 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-1 lg:col-span-2">
            <p className="font-heading text-2xl font-black tracking-tight text-text">
              Quinfosys<span style={{ verticalAlign: "super", fontSize: "0.65em", lineHeight: 0 }}>™</span> QuDrugForge
            </p>
            <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-text-secondary">
              The next generation of quantum-enhanced oncology drug discovery.
              Accelerating research from molecular ideation to clinical validation.
            </p>
            <div className="mt-6 flex gap-4">
              {/* Mock Social/Tech Icons */}
              <div className="h-8 w-8 rounded-lg bg-surface-subtle" />
              <div className="h-8 w-8 rounded-lg bg-surface-subtle" />
              <div className="h-8 w-8 rounded-lg bg-surface-subtle" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-text">Platform</h4>
            <ul className="mt-6 space-y-4 text-sm font-medium text-text-secondary">
              <li><Link href="/#features" className="hover:text-primary">Molecular Explorer</Link></li>
              <li><Link href="/#workflow" className="hover:text-primary">Research Pipeline</Link></li>
              <li><Link href="/#targets" className="hover:text-primary">Target Selection</Link></li>
              <li><Link href="/pricing" className="hover:text-primary">Pricing</Link></li>
              <li><a href="#" className="hover:text-primary">API Documentation</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-text">Company</h4>
            <ul className="mt-6 space-y-4 text-sm font-medium text-text-secondary">
              <li><a href="#" className="hover:text-primary">About Quinfosys</a></li>
              <li><a href="#" className="hover:text-primary">Research Papers</a></li>
              <li><a href="#" className="hover:text-primary">Clinical Partners</a></li>
              <li><a href="#" className="hover:text-primary">Contact Support</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between border-t border-border/50 pt-8 md:flex-row">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary/60">
            © {new Date().getFullYear()} Quinfosys™ QuDrugForge. All rights reserved.
          </p>
          <div className="mt-4 flex gap-8 md:mt-0">
            <a href="#" className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary/60 hover:text-primary">Privacy Policy</a>
            <a href="#" className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary/60 hover:text-primary">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
