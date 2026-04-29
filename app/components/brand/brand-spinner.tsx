import Image from "next/image";

/** Bare spinner — use inline when you just need the gif */
export function BrandSpinner({ size = 48 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        boxShadow: "0 0 18px 4px rgba(180,112,10,.35)",
      }}
    >
      <Image
        src="/optify-spinner.gif"
        alt="Loading…"
        width={size}
        height={size}
        unoptimized
        priority
        style={{ borderRadius: "50%" }}
      />
    </span>
  );
}

/** Full-screen overlay — pass message for AI moments */
export function BrandSpinnerOverlay({ message }: { message?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5"
      style={{ background: "rgba(15,20,25,.72)", backdropFilter: "blur(6px)" }}
      aria-live="polite"
      role="status"
    >
      <BrandSpinner size={72} />
      {message && (
        <p className="max-w-[280px] text-center text-[13px] font-medium leading-snug text-white/80">
          {message}
        </p>
      )}
    </div>
  );
}

/** Inline — sits inside a button or a row without disrupting layout */
export function BrandSpinnerInline({ size = 18 }: { size?: number }) {
  return <BrandSpinner size={size} />;
}
