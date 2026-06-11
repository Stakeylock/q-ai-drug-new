import { HeroSection } from "../../components/marketing/HeroSection";
import { MetricsSection } from "../../components/marketing/MetricsSection";
import { WorkflowSection } from "../../components/marketing/WorkflowSection";
import { FeaturesSection } from "../../components/marketing/FeaturesSection";
import { VisualizationSection } from "../../components/marketing/VisualizationSection";
import { TargetsSection } from "../../components/marketing/TargetsSection";
import { TechStackSection } from "../../components/marketing/TechStackSection";
import { FooterSection } from "../../components/marketing/FooterSection";
import { FadeInOnScroll } from "../../components/marketing/FadeInOnScroll";

export default function MarketingHomePage() {
  return (
    <main className="aurora-bg relative overflow-hidden text-text selection:bg-primary selection:text-white">
      <div className="bg-grid-noise pointer-events-none absolute inset-0 opacity-40" />
      
      <div className="relative mx-auto max-w-7xl space-y-24 px-6 py-12 md:space-y-32 md:px-12 md:py-20 lg:space-y-40 lg:px-16 lg:py-24">
        {/* 1. Hero Section */}
        <FadeInOnScroll delayMs={0}>
          <HeroSection />
        </FadeInOnScroll>

        {/* 2. Animated Metrics Section */}
        <FadeInOnScroll delayMs={100}>
          <MetricsSection />
        </FadeInOnScroll>

        {/* 3. Research Workflow Section */}
        <FadeInOnScroll delayMs={200}>
          <WorkflowSection />
        </FadeInOnScroll>

        {/* 4. Platform Features Grid */}
        <FadeInOnScroll delayMs={300}>
          <FeaturesSection />
        </FadeInOnScroll>

        {/* 5. Scientific Visualization Section */}
        <FadeInOnScroll delayMs={400}>
          <VisualizationSection />
        </FadeInOnScroll>

        {/* 6. Targets Section */}
        <FadeInOnScroll delayMs={500}>
          <TargetsSection />
        </FadeInOnScroll>

        {/* 7. Technology/Research Stack */}
        <FadeInOnScroll delayMs={600}>
          <TechStackSection />
        </FadeInOnScroll>

        {/* 8. Footer (Already included in Layout, but adding here if needed for consistency) */}
      </div>
      <FooterSection />
    </main>
  );
}