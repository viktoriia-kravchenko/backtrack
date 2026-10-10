// Stand-in for pages that aren't built yet, so every nav tab goes somewhere.
// Usage in main.js: placeholderPage('Pot', 'pot')

export default function placeholderPage(title, tab) {
  return {
    title,
    tab,
    render() {
      return `<main>
          <h1 class="greeting">${title}</h1>
          <section class="bt-sign" style="--line: var(--bt-blue)">
            <p class="placeholder-title">Coming soon</p>
            <p>This screen is part of the prototype plan.</p>
          </section>
          <a class="text-link" href="#/home">← Back to Home</a>
        </main>`;
    },
  };
}