// Deters casual inspection of the application in production.
// This is a deterrent, not a guarantee — client-side protection cannot be absolute.
export function initDevProtection() {
  if (import.meta.env.DEV) return; // only active in production builds

  // Disable right-click context menu
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Block common DevTools keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const blocked =
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
      (e.ctrlKey && e.key === 'U') || // view source
      (e.metaKey && e.altKey && ['I', 'J', 'C'].includes(e.key)); // Mac
    if (blocked) e.preventDefault();
  });

  // Clear console periodically and warn
  const warnMsg = '%cStop! This is a protected application.';
  const warnStyle = 'color:red;font-size:20px;font-weight:bold;';
  setInterval(() => {
    console.clear();
    console.log(warnMsg, warnStyle);
  }, 2000);

  // Detect DevTools open via window size difference (desktop)
  const threshold = 160;
  setInterval(() => {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > threshold || heightDiff > threshold) {
      document.body.innerHTML = '';
      window.location.reload();
    }
  }, 1000);
}
