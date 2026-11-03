// External script so the production CSP does not need unsafe inline scripts.
(function () {
  var theme = 'light';
  try { theme = localStorage.getItem('cv-theme') || theme; } catch (_) { /* Use default theme. */ }
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
})();
