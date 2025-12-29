// Hide native splash screen - called from App when ready
export const hideSplashScreen = () => {
  const splash = document.getElementById('splash-screen')
  if (splash) {
    splash.classList.add('hidden')
    // Remove from DOM after transition
    setTimeout(() => splash.remove(), 300)
  }
}
