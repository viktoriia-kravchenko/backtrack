// Router: shows the page that matches the URL after the #.
//   /            → loading screen, then Home
//   #/home       → Home
//   #/journeys   → Journeys list
//   #/journey/j1 → Refund page for journey j1
//   #/pots       → Pots carousel (#/pots/<id> opens that pot). #/pot goes there too.
//
// To add a page: create pages/<name>.js, import it here, add it to `routes`,
// and add its file to STATIC_FILES in bank/server.js.
import loadingPage from './pages/loading.js';
import homePage from './pages/home.js';
import journeysPage from './pages/journeys.js';
import refundPage from './pages/refund.js';
import potsPage from './pages/pots.js';
import placeholderPage from './pages/placeholder.js';
import linesPage from './pages/lines.js';

const routes = {
  loading: loadingPage,
  home: homePage,
  journeys: journeysPage,
  journey: refundPage, // #/journey/j1 opens the refund page for journey j1
  pots: potsPage,      // #/pots/<id> opens that pot
  pot: potsPage,       // the tab bar, Home's pot card and "Open pot" link to #/pot
  lines: linesPage,
  network: linesPage,
};


// Fit the whole phone on a laptop screen: shrink it rather than cutting off the bottom.
function fitPhone() {
  const css = getComputedStyle(document.documentElement);
  const fullHeight = parseFloat(css.getPropertyValue('--bt-app-height')) + parseFloat(css.getPropertyValue('--bt-bezel')) * 2;
  const maxZoom = parseFloat(css.getPropertyValue('--bt-phone-max-zoom')) || 1;
  const zoom = window.innerWidth <= 500 ? 1 : Math.min(maxZoom, (window.innerHeight - 32) / fullHeight);
  document.documentElement.style.setProperty('--phone-zoom', zoom.toFixed(3));
}
fitPhone();
window.addEventListener('resize', fitPhone);

// The top bar is in index.html. The navbar and menu are created once and stay between pages.
// The navbar goes inside the phone, after the scrolling screen, so it sits at the bottom.
const phone = document.getElementById('phone');
const screen = document.getElementById('screen');
const topbar = document.getElementById('topbar');
const menu = Backtrack.createMenu();
const navbar = Backtrack.createNavbar();
phone.append(navbar);
document.body.append(menu.element);

const app = document.getElementById('app');
let firstRender = true;

function render() {
  const [hashName, id] = location.hash.replace(/^#\/?/, '').split('/');
  const name = hashName || 'loading'; // no # in the URL → start on the welcome screen
  const page = routes[name] || routes.home;

  app.innerHTML = page.render(id);
  page.afterRender?.(app);

  document.title = `${page.title} · Backtrack`;
  topbar.hidden = page.hideChrome === true;
  navbar.hidden = page.hideChrome === true;
  navbar.setActive(page.tab);

  // 150 ms fade between screens (turned off by "reduce motion" in the CSS).
  app.classList.remove('is-entering');
  void app.offsetWidth; // restarts the animation
  app.classList.add('is-entering');

  // Move focus to the new page's heading so screen readers announce the change.
  // Skipped on first load so the page doesn't jump.
  if (!firstRender) {
    const heading = app.querySelector('h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    screen.scrollTo(0, 0); // only the inside of the phone scrolls
  }
  firstRender = false;
}

// Shared click handling for every page:
//   data-open-menu → opens the menu
//   data-soon      → shows a "coming soon" message
document.addEventListener('click', (e) => {
  const menuButton = e.target.closest('[data-open-menu]');
  if (menuButton) {
    menu.open(menuButton);
    return;
  }
  const soon = e.target.closest('[data-soon]');
  if (soon) {
    e.preventDefault();
    Backtrack.toast(`${soon.dataset.soon} is coming soon`);
  }
});

window.addEventListener('hashchange', render);
render();