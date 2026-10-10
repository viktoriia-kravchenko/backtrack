'use strict';
// Menu component: a panel on the right, opened from the button at the top right.
// Built on the native <dialog> element, which handles Escape to close,
// keeps keyboard focus inside the menu, and hides the page from screen readers while open.
//
// Usage:
//   const menu = Backtrack.createMenu();
//   document.body.append(menu.element);
//   menu.open(buttonThatOpenedIt);

(function () {
  // Each group is a station-sign card. `line` is the colour of its top strip.
  const SECTIONS = [
    {
      title: 'Account',
      line: '--bt-blue',
      items: [
        { label: 'Profile' },
        { label: 'Connected card', hint: 'Visa Debit •••• 4821' },
        { label: 'TfL account', hint: 'Connected' },
        { label: 'Saved routes', hint: '3 routes' },
      ],
    },
    {
      title: 'Claims',
      line: '--bt-orange',
      items: [
        { label: 'Claim automatically', toggle: true, on: true, hint: 'Waits 48 h in case TfL refunds you first' },
        { label: 'What counts for a refund' },
        { label: 'Appeal a decision' },
      ],
    },
    {
      title: 'Notifications',
      line: '--bt-yellow',
      items: [
        { label: 'How often we tell you', hint: 'Daily digest' },
        { label: 'Quiet hours', hint: '10pm to 7am' },
      ],
    },
    {
      title: 'Accessibility',
      line: '--bt-green',
      items: [
        { label: 'Larger text', toggle: true, on: false },
        { label: 'Low-sensory mode', toggle: true, on: false, hint: 'No animation or sound' },
        { label: 'Simple mode', toggle: true, on: false, hint: 'Just Home and Pot' },
      ],
    },
    {
      title: 'Help',
      line: '--bt-pink',
      items: [
        { label: 'How Backtrack works' },
        { label: 'Talk to a person' },
        { label: 'Privacy and your data' },
      ],
    },
  ];

  const chevron = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  function itemHtml(item) {
    const hint = item.hint ? `<span class="bt-menu-hint">${item.hint}</span>` : '';
    if (item.toggle) {
      // role="switch" tells screen readers this is on/off, and aria-checked says which.
      return `<li><button type="button" class="bt-menu-item" role="switch" aria-checked="${item.on}">
        <span class="bt-menu-text"><span>${item.label}</span>${hint}</span>
        <span class="bt-switch" aria-hidden="true"><span class="bt-switch-knob"></span></span>
      </button></li>`;
    }
    return `<li><button type="button" class="bt-menu-item" data-soon="${item.label}">
      <span class="bt-menu-text"><span>${item.label}</span>${hint}</span>${chevron}
    </button></li>`;
  }

  function createMenu() {
    const dialog = document.createElement('dialog');
    dialog.id = 'bt-menu';
    dialog.className = 'bt-menu';
    dialog.setAttribute('aria-labelledby', 'bt-menu-title');

    dialog.innerHTML = `<div class="bt-menu-panel">
      <div class="bt-menu-header">
        <h2 id="bt-menu-title">Menu</h2>
        <button type="button" class="bt-menu-close" aria-label="Close menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      ${SECTIONS.map((s) => `<section class="bt-sign bt-menu-section" style="--line: var(${s.line})">
        <h3>${s.title}</h3>
        <ul>${s.items.map(itemHtml).join('')}</ul>
      </section>`).join('')}
      <button type="button" class="bt-menu-signout">Sign out</button>
    </div>`;

    let opener = null;

    function open(fromButton) {
      opener = fromButton || null;
      if (opener) opener.setAttribute('aria-expanded', 'true');
      dialog.showModal();
    }

    function close() {
      dialog.close();
    }

    dialog.addEventListener('close', () => {
      if (opener) {
        opener.setAttribute('aria-expanded', 'false');
        opener.focus();
      }
    });

    dialog.querySelector('.bt-menu-close').addEventListener('click', close);

    // Clicking the dimmed area outside the panel closes the menu.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });

    // Switches flip on and off (visual only in the prototype).
    for (const sw of dialog.querySelectorAll('[role="switch"]')) {
      sw.addEventListener('click', () => {
        sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
      });
    }

    // Pages that aren't built yet.
    for (const item of dialog.querySelectorAll('[data-soon]')) {
      item.addEventListener('click', () => window.Backtrack.toast?.(`${item.dataset.soon} is coming soon`));
    }
    dialog.querySelector('.bt-menu-signout').addEventListener('click', () => window.Backtrack.toast?.('Sign out is turned off in the demo'));

    return { element: dialog, open, close };
  }

  window.Backtrack = window.Backtrack || {};
  window.Backtrack.createMenu = createMenu;
})();