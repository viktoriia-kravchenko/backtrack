// Loading screen: shows the logo and tagline, then moves on to Home by itself.

export default {
  title: 'Loading',
  hideChrome: true, // no top bar or navbar on this screen

  render() {
    return `<div class="splash">
      <svg class="splash-logo" viewBox="0 0 140 100" role="img" aria-label="Backtrack logo">
        <path pathLength="1" style="stroke: var(--bt-green)" d="M44 84 A20 20 0 0 1 84 84"/>
        <path pathLength="1" style="stroke: var(--bt-blue)" d="M34 84 A30 30 0 0 1 94 84"/>
        <path pathLength="1" style="stroke: var(--bt-pink)" d="M24 84 A40 40 0 0 1 104 84"/>
        <path pathLength="1" style="stroke: var(--bt-orange)" d="M14 84 A50 50 0 0 1 114 84"/>
        <path pathLength="1" style="stroke: var(--bt-yellow)" d="M4 84 A60 60 0 0 1 124 84"/>
        <path pathLength="1" style="stroke: var(--bt-white)" d="M100 40 L130 10 M114 10 H130 V26"/>
      </svg>
      <h1 class="splash-title">Backtrack</h1>
      <p class="splash-tagline">Refunds rerouted.</p>
      <p class="splash-status" role="status">Loading your journeys…</p>
      <a class="splash-skip" href="#/home">Skip</a>
    </div>`;
  },

  afterRender() {
    // Shorter wait if the user has asked their phone for less motion.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      // replace() means the back button won't return to the loading screen.
      if (!location.hash || location.hash === '#/loading') location.replace('#/home');
    }, reduceMotion ? 800 : 2200);
  },
};