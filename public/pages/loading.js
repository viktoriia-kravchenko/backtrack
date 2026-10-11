// Welcome screen: the first thing you see when the app starts.
// The logo draws in, then the title and the Sign up / Log in buttons fade in.
// For now both buttons go straight to Home.

export default {
  title: 'Welcome',
  hideChrome: true, // no top bar or tab bar on this screen

  render() {
    return `<div class="splash">
      <div class="splash-brand">
        <svg class="bt-logo splash-logo" viewBox="96 30 312 440" role="img" aria-label="Backtrack logo">
          <g transform="translate(-14,6)">
            <path class="logo-line logo-orange" pathLength="1" d="M161.3,310 A84,84 0 0 1 273.4,277.8"/>
            <path class="logo-line logo-main" pathLength="1" d="M150,64 V352 A84,84 0 0 0 318,352 C318,306 324,274 381.5,225.9"/>
            <polygon class="logo-arrow" points="412.0,200.0 327.1,214.3 384.0,281.4"/>
            <circle class="logo-stop" cx="150" cy="64" r="30"/>
          </g>
        </svg>
        <h1 class="splash-title">Backtrack</h1>
        <p class="splash-tagline">Refunds rerouted.</p>
        <p class="splash-engine">Built on Engine by Starling</p>
      </div>

      <div class="splash-actions">
        <a class="bt-btn" href="#/home">Sign up</a>
        <a class="bt-btn bt-btn--ghost" href="#/home">Log in</a>
      </div>
    </div>`;
  },
};