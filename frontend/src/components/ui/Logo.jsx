/**
 * Brand mark. Designed for a light background, so it always renders inside
 * a white chip — including on this app's current dark screens.
 */
export default function Logo({ size = 36, className = "" }) {
  return (
    <div
      className={`bg-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-black/20 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo-mark.png"
        alt="DriveClique"
        style={{ width: size * 0.68, height: size * 0.68 }}
        className="object-contain"
      />
    </div>
  );
}
