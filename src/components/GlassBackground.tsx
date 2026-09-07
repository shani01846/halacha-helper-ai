export function GlassBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="floaty absolute -top-24 -right-24 size-96 rounded-full bg-lavender/70 blur-3xl" />
      <div className="floaty2 absolute top-1/3 -left-32 size-80 rounded-full bg-pink/60 blur-3xl" />
      <div className="floaty absolute bottom-0 right-1/4 size-80 rounded-full bg-mint/60 blur-3xl" />
    </div>
  );
}

export function BrandMark({ className = "size-11 text-xl" }: { className?: string }) {
  return (
    <div
      className={`grid place-items-center rounded-2xl bg-white/60 font-display font-bold text-brand shadow-[0_8px_30px_-8px_rgba(99,102,241,0.5)] backdrop-blur-xl ${className}`}
    >
      ל
    </div>
  );
}
