// Welcome screen: the first thing you see when the app starts.
// The logo draws in, then the Sign up and Log in buttons fade in.
// For now both buttons go straight to Home.

export default {
  title: 'Welcome',
  hideChrome: true, // no top bar or tab bar on this screen

  render() {
    return `<div class="splash">
      <div class="splash-brand">
        <svg class="splash-logo" viewBox="0 0 140 100" role="img" aria-label="Backtrack logo">
          <path pathLength="1" style="stroke: var(--bt-green)" d="M44 84 A20 20 0 0 1 84 84"/>
          <path pathLength="1" style="stroke: var(--bt-blue)" d="M34 84 A30 30 0 0 1 94 84"/>
          <path pathLength="1" style="stroke: var(--bt-pink)" d="M24 84 A40 40 0 0 1 104 84"/>
          <path pathLength="1" style="stroke: var(--bt-orange)" d="M14 84 A50 50 0 0 1 114 84"/>
          <path pathLength="1" style="stroke: var(--bt-yellow)" d="M4 84 A60 60 0 0 1 124 84"/>
          <path pathLength="1" style="stroke: var(--bt-text)" d="M100 40 L130 10 M114 10 H130 V26"/>
        </svg>
        <h1 class="splash-title">Backtrack</h1>
        <p class="splash-tagline">Refunds rerouted.</p>
      </div>

      <div class="splash-actions">
        <a class="bt-btn" href="#/home">Sign up</a>
        <a class="bt-btn bt-btn--ghost" href="#/home">Log in</a>
      </div>
    </div>`;
  },
};