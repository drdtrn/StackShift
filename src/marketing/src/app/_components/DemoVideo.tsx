import DemoVideoModal from "./DemoVideoModal";

export default function DemoVideo() {
  return (
    <section id="demo" className="container-page py-24 border-t border-line">
      <h2 className="text-3xl md:text-4xl font-bold">
        90 seconds. The whole pitch.
      </h2>
      <p className="mt-3 text-muted max-w-2xl">
        A real local stack. Real OpenAI call. No edits, no cuts. Captions on by
        default; transcript below.
      </p>
      <div className="mt-8">
        <DemoVideoModal />
      </div>
      <details className="mt-8 group">
        <summary className="cursor-pointer text-muted hover:text-primary list-none flex items-center gap-2">
          <span className="text-xl group-open:rotate-90 transition-transform inline-block">
            ›
          </span>
          <span>Transcript</span>
        </summary>
        <div className="mt-4 text-muted leading-relaxed">
          Transcript pending — drops in once the Loom recording is finalised.
        </div>
      </details>
    </section>
  );
}
