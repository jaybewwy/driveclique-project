/**
 * Standard WCAG skip-link — visually hidden until focused (first Tab press),
 * then jumps keyboard/screen-reader users past the nav straight to #main-content.
 */
const SkipToContent = () => (
  <a
    href="#main-content"
    className="absolute left-2 top-2 z-[100] -translate-y-16 focus:translate-y-0 transition-transform
               bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg"
  >
    Skip to main content
  </a>
);

export default SkipToContent;
