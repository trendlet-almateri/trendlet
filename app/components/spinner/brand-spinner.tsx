/**
 * Trendslet brand spinner — uses optify-spinner.gif from public/.
 *
 * The GIF contains the 3-D rotation animation. DO NOT add CSS rotation on top.
 * Only a subtle gold halo glow (drop-shadow) is applied.
 *
 * Place the GIF at:  public/optify-spinner.gif
 */

type SpinnerProps = {
  /** Pixel size (square). Default 48. */
  size?: number;
  /** Accessible label. Default "Loading". */
  label?: string;
  /** Extra Tailwind classes for positioning. */
  className?: string;
};

export function BrandSpinner({ size = 48, label = "Loading", className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center brand-spinner-glow ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/optify-spinner.gif"
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none", userSelect: "none" }}
      />
    </span>
  );
}

/**
 * Full-screen overlay — use during initial load or long async operations.
 */
type OverlayProps = {
  message?: string;
  label?: string;
};

export function BrandSpinnerOverlay({ message, label = "Loading" }: OverlayProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5"
      style={{
        background: "rgba(15, 18, 22, 0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <span
        aria-hidden
        className="brand-ring-spinner"
        style={{ width: 56, height: 56 }}
      />
      {message && (
        <p
          className="font-[family-name:var(--font-inter)] text-[14px] font-medium tracking-[0.02em]"
          style={{ color: "#f5d063" }}
        >
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * Inline spinner — fits inside buttons or next to text.
 */
export function BrandSpinnerInline({ size = 18 }: { size?: number }) {
  return (
    <BrandSpinner
      size={size}
      className="inline-flex align-middle"
      label="Loading"
    />
  );
}
