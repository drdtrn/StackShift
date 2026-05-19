"use client";

import { useRef, useState, type MouseEvent } from "react";

const LOOM_EMBED_URL =
  "https://www.loom.com/embed/REPLACE_WITH_LOOM_ID?autoplay=1&hide_owner=true&hide_share=true&hide_title=true";

export default function DemoVideoModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = () => {
    setIsOpen(true);
    dialogRef.current?.showModal();
  };

  const close = () => {
    dialogRef.current?.close();
    setIsOpen(false);
  };

  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) close();
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        data-plausible-event-name="demo-modal-open"
        aria-label="Play the 90-second StackSift demo video"
        className="aspect-video w-full max-w-3xl rounded-xl border border-line bg-surface text-muted hover:text-primary flex items-center justify-center group cursor-pointer"
      >
        <span className="text-6xl group-hover:scale-110 transition">▶</span>
      </button>

      <dialog
        ref={dialogRef}
        onClick={onBackdropClick}
        onClose={() => setIsOpen(false)}
        className="bg-canvas text-primary backdrop:bg-black/70 rounded-xl p-0 max-w-4xl w-[92vw] border border-line"
      >
        <div className="relative aspect-video">
          {isOpen && (
            <iframe
              src={LOOM_EMBED_URL}
              title="StackSift 90-second demo"
              allow="autoplay; fullscreen"
              allowFullScreen
              className="w-full h-full rounded-xl"
            />
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Close demo video"
            className="absolute top-2 right-3 text-2xl text-muted hover:text-primary"
          >
            ×
          </button>
        </div>
      </dialog>
    </>
  );
}
