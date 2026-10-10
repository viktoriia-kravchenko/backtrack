'use strict';
// Bottom navbar component: Home, Journeys, Pots, Network.
// The menu now opens from the button at the top right (see index.html).
//
// Usage:
//   const navbar = Backtrack.createNavbar();
//   document.body.append(navbar);
//   navbar.setActive('home');   // highlight a tab when the page changes

(function () {
  const icon = (path) =>
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

  const TABS = [
    { id: 'home', label: 'Home', href: '#/home', icon: icon('<path d="M4 18c4 0 4-12 8-12s4 12 8 12"/><circle cx="12" cy="6" r="2"/>') },
    { id: 'journeys', label: 'Journeys', href: '#/journeys', icon: icon('<path d="M5 6h14M5 12h14M5 18h9"/>') },
    { id: 'pots', label: 'Pots', href: '#/pots', icon: icon('<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 0 0-4.5 1.5V16M8.5 16h7M8.5 12.5h4.5"/>') },
    { id: 'network', label: 'Network', href: '#/network', icon: icon('<path d="M6 19v-4M11 19v-8M16 19V9M21 19V5"/>') },
  ];

  // Short message at the bottom of the screen, e.g. "Pot is coming soon".
  function toast(message) {
    let box = document.getElementById('bt-toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'bt-toast';
      box.className = 'bt-toast';
      box.setAttribute('role', 'status');
    }
    // An open menu sits above everything else, so show the message inside it when it's open.
    (document.querySelector('dialog[open]') || document.getElementById('phone') || document.body).append(box);
    box.textContent = message;
    box.classList.add('is-visible');
    clearTimeout(box.hideTimer);
    box.hideTimer = setTimeout(() => box.classList.remove('is-visible'), 2500);
  }

  function createNavbar() {
    const nav = document.createElement('nav');
    nav.className = 'bt-navbar';
    nav.setAttribute('aria-label', 'Main');

    nav.innerHTML = `<div class="bt-navbar-inner">
      ${TABS.map((tab) => `<a class="bt-tab" href="${tab.href}" data-tab="${tab.id}">
        ${tab.icon}<span>${tab.label}</span>
      </a>`).join('')}
    </div>`;

    // Highlight the current tab. aria-current tells screen readers which page you're on.
    nav.setActive = (tabId) => {
      for (const link of nav.querySelectorAll('.bt-tab')) {
        const active = link.dataset.tab === tabId;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    };

    document.body.classList.add('has-bt-navbar'); // adds space so the navbar doesn't cover content
    return nav;
  }

  window.Backtrack = window.Backtrack || {};
  window.Backtrack.createNavbar = createNavbar;
  window.Backtrack.toast = toast;
})();
