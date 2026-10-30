// Line icons for the app pages. PlateIcon(name) returns inline SVG markup;
// any <i data-icon="name"></i> already in the page is filled in on load.
(() => {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    meals: '<path d="M7 3v18"/><path d="M4 3v5a3 3 0 0 0 6 0V3"/><path d="M17 21V3c-2.2 1.2-3.5 3.6-3.5 6.5V14H17"/>',
    workout: '<rect x="5" y="7" width="3" height="10" rx="1"/><rect x="16" y="7" width="3" height="10" rx="1"/><path d="M2.5 10v4M21.5 10v4M8 12h8"/>',
    progress: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    reports: '<path d="M4 20h16"/><path d="M7 16v-5"/><path d="M12 16V6"/><path d="M17 16v-8"/>',
    foodlog: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M12 8v8M8 12h8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sunrise: '<path d="M12 3v4"/><path d="m5.6 8.6 1.4 1.4M18.4 8.6 17 10"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M3 17h18M6 21h12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    snack: '<path d="M12 7c-1.5-1.2-5-1.5-6.5 1.5S5 16 7.5 19c1.3 1.6 2.8 1.8 4.5 1 1.7.8 3.2.6 4.5-1 2.5-3 3.5-7.5 2-10.5S13.5 5.8 12 7z"/><path d="M12 7c0-2 1-3.5 3-4"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    back: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
    scale: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8.5 10a3.5 3.5 0 0 1 7 0"/><path d="m12 10 1.5-2"/>',
  };
  const icon = (name) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || ''}</svg>`;
  globalThis.PlateIcon = icon;
  const fill = () => document.querySelectorAll('i[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
})();
