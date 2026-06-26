import Link from "next/link";

import { PricingExperience } from "@/components/pricing/PricingExperience";

export function PricingSection() {
  return (
    <section id="pricing" className="relative">
      <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Simple pricing</p>
          <h2 className="mt-3 max-w-3xl font-heading text-4xl font-black tracking-tight text-text md:text-5xl">
            Start small. Scale when the science demands it.
          </h2>
          <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-text-secondary">
            Transparent plans for independent researchers, discovery teams, and regulated organizations.
          </p>
        </div>
        <Link href="/pricing" className="text-sm font-black text-primary transition hover:text-primary-hover">
          View full pricing details →
        </Link>
      </div>

      <PricingExperience compact />
    </section>
  );
}
