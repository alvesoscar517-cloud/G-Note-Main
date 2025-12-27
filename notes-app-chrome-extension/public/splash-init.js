// Update splash icon based on theme
(function() {
  var isDark = document.documentElement.classList.contains('dark') || 
               window.matchMedia('(prefers-color-scheme: dark)').matches;
  var iconImg = document.getElementById('splash-icon-img');
  if (iconImg) {
    iconImg.src = isDark ? '/g-note.svg' : '/g-note-dark.svg';
  }
})();
