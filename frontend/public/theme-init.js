// Applies the saved colour theme before the first paint, so someone on the
// light theme never sees a dark flash while the app bundle loads.
//
// A file of its own rather than an inline <script> because the page's
// Content-Security-Policy only allows scripts from 'self'. It is loaded
// without `defer`, so it runs before the browser draws anything.
//
// Keep the storage key and the attribute in step with src/lib/theme.js.
(function () {
  try {
    if (localStorage.getItem('driveclique_theme') === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (err) {
    // Storage is blocked (private mode, some WebViews): stay on the default dark theme
    console.warn('Could not read the saved theme:', err);
  }
})();
