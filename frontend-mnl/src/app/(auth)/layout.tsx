"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/shared";
import logo from "../../../logo.png";
import { MolecularVisualPanel, AuthFeatureList } from "./_components";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isWorkspaceSelector = pathname?.includes("workspace-selector");

  return (
    <main 
      className="relative flex min-h-screen w-full flex-col lg:flex-row overflow-y-auto lg:overflow-hidden" 
      style={{ background: "var(--bg)" }}
    >
      {/* Background radial glow on the right (Form) side */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 z-0 h-[600px] w-[600px] rounded-full bg-cyan-500/5 blur-[120px] lg:opacity-70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-[20%] z-0 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[100px] lg:opacity-60"
      />

      {/* ------------------------------------------------------------- */}
      {/* LEFT SIDE: Molecular/Scientific Visual Panel & Features (lg only) */}
      {/* ------------------------------------------------------------- */}
      <section 
        className="relative hidden lg:flex lg:w-[38%] xl:w-[35%] shrink-0 flex-col justify-between p-8 xl:p-10 text-slate-100 lg:max-h-screen lg:overflow-y-auto"
        style={{
          background: "linear-gradient(185deg, #020617 0%, #080f25 70%, #030712 100%)",
          borderRight: "1px solid color-mix(in srgb, var(--border) 12%, transparent)"
        }}
      >
        {/* Subtle left-side structural grid line */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }}
        />

        {/* Brand Header */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <Image 
              src={logo} 
              alt="Quinfosys QuDrugForge Logo" 
              width={150} 
              height={36} 
              priority
              className="h-auto w-32 object-contain"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold tracking-tight text-slate-100 xl:text-xl">
              Quinfosys™ QuDrugForge™
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Quantum AI Drug Discovery Platform
            </p>
            <p className="text-[10px] italic text-slate-400">
              AI-Powered Computational Molecular Intelligence
            </p>
          </div>
        </div>

        {/* Molecular Interactive Graphic Panel */}
        <div className="relative z-10 my-4 h-[300px] w-full flex items-center justify-center">
          <MolecularVisualPanel />
        </div>

        {/* Feature List & Tagline */}
        <div className="relative z-10 space-y-4">
          <p className="text-xs font-medium leading-relaxed text-slate-300">
            Unlock the power of in silico biochemistry. QuDrugForge integrates quantum molecular screening with generative intelligence to identify high-affinity lead candidates.
          </p>
          <AuthFeatureList />
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* RIGHT SIDE: Auth Form (Mobile stackable, clean layout)        */}
      {/* ------------------------------------------------------------- */}
      <section className="relative z-10 flex flex-1 flex-col justify-between p-6 md:p-8 lg:p-10 lg:max-h-screen lg:overflow-y-auto min-h-screen lg:min-h-0">
        {/* Right Header Navigation & Theme Toggle */}
        <div className="flex w-full items-center justify-between z-20 shrink-0 mb-6">
          {/* Mobile-only Top Brand Header */}
          <div className="flex lg:hidden items-center gap-2">
            <Image 
              src={logo} 
              alt="Quinfosys QuDrugForge Logo" 
              width={90} 
              height={22} 
              priority
              className="h-auto w-22 object-contain"
            />
            <div className="h-5 w-px bg-border/20 mx-1" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-500">QuDrugForge</span>
          </div>

          <div className="hidden lg:block" /> {/* Spacer */}

          {/* Theme Toggle */}
          <div className="rounded-lg border bg-card/45 p-1 backdrop-blur-sm" style={{ borderColor: "var(--border)" }}>
            <ThemeToggle />
          </div>
        </div>

        {/* Centered Auth Card Form Area */}
        <div className="my-auto py-4 flex w-full justify-center">
          <div 
            className="w-full transition-all duration-300"
            style={{ 
              maxWidth: isWorkspaceSelector ? "1080px" : "440px",
              paddingLeft: "4px",
              paddingRight: "4px"
            }}
          >
            {children}
          </div>
        </div>

        {/* Footer legal notices */}
        <footer className="text-center font-mono text-[9px] tracking-wider opacity-60 mt-auto pt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 shrink-0" style={{ color: "var(--muted-text)" }}>
          <span>© {new Date().getFullYear()} Quinfosys Inc. All rights reserved.</span>
          <span className="hidden sm:inline">•</span>
          <span className="hover:text-text cursor-pointer transition-colors">Security Audit v4.8</span>
          <span className="hidden sm:inline">•</span>
          <span className="hover:text-text cursor-pointer transition-colors">FDA 21 CFR Part 11</span>
        </footer>
      </section>
    </main>
  );
}