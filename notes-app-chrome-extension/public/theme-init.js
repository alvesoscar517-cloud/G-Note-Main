// Prevent flash of wrong theme
(function () {
  try {
    var isDark = false;
    var stored = localStorage.getItem('app-storage');

    if (stored) {
      var parsed = JSON.parse(stored);
      var theme = parsed.state && parsed.state.theme || 'system';
      isDark = theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }
})();
