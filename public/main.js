// Router: shows the page that matches the URL after the #.
//   /            → loading screen, then Home
//   #/home       → Home
//   #/journeys   → Journeys (placeholder for now)
//   #/pots       → Pots carousel (#/pots/<id> opens that pot)
//
// To add a page: create pages/<name>.js, import it here, add it to `routes`,
// and add its file to STATIC_FILES in bank/server.js.
import loadingPage from './pages/loading.js';
import homePage from './pages/home.js';
import potsPage from './pages/pots.js';
import placeholderPage from './pages/placeholder.js';

const routes = {
  loading: loadingPage,
  home: homePage,
  journeys: placeholderPage('Journeys', 'journeys'),
  journey: placeholderPage('Refund details', 'journeys'),
  pots: potsPage,
  network: placeholderPage('Network', 'network'),
};

// The top bar is in index.html. The navbar and menu are created once and stay between pages.
const topbar = document.getElementById('topbar');
const menu = Backtrack.createMenu();
const navbar = Backtrack.createNavbar();
document.body.append(navbar, menu.element);

const app = document.getElementById('app');
let firstRender = true;

function render() {
  const [name = 'loading', id] = location.hash.replace(/^#\/?/, '').split('/');
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
    window.scrollTo(0, 0);
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