import Hero from "./_components/Hero";
import Pain from "./_components/Pain";
import HowItWorks from "./_components/HowItWorks";
import DemoVideo from "./_components/DemoVideo";
import FeaturePillars from "./_components/FeaturePillars";
import DatadogComparison from "./_components/DatadogComparison";
import Pricing from "./_components/Pricing";
import SecurityTrust from "./_components/SecurityTrust";
import FAQ from "./_components/FAQ";
import FinalCTA from "./_components/FinalCTA";
import Footer from "./_components/Footer";

export default function Page() {
  return (
    <>
      <main id="main">
        <Hero />
        <Pain />
        <HowItWorks />
        <DemoVideo />
        <FeaturePillars />
        <DatadogComparison />
        <Pricing />
        <SecurityTrust />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
