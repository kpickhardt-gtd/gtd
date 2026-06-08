// =============================================================================
// brand.js — Pharos Systems International brand settings
// =============================================================================
// Edit ONLY this file to update the look and feel of the GTD system.
// Do not modify index.html for visual changes, and never touch the data JSON.
//
// Logo: the logoUrl below points to pharos.com. For offline use, download the
// SVG from SharePoint and save it as "logo.svg" in this folder, then change
// logoUrl to './logo.svg'.
// =============================================================================

window.PHAROS_BRAND = {

  // ---------------------------------------------------------------------------
  // IDENTITY
  // ---------------------------------------------------------------------------
  appName:    'Kevin Pickhardt — GTD',       // Shown in header h1 and browser tab
  orgName:    'Pharos Systems International', // Used in header sub-label
  tagline:    '',                             // Optional sub-label under org name
  logoUrl:    'https://www.pharos.com/wp-content/uploads/2022/10/LOGO.svg',
  logoHeight: '26px',                         // Adjust to taste
  faviconUrl: '',                             // Leave blank to keep default

  // ---------------------------------------------------------------------------
  // TYPOGRAPHY  (Brand guidelines: Albert Sans for marketing/web)
  // ---------------------------------------------------------------------------
  fontUrl:    'https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap',
  fontFamily: "'Albert Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  // ---------------------------------------------------------------------------
  // PRIMARY PALETTE  (PMS266C — Pharos Purple)
  // ---------------------------------------------------------------------------
  colorPrimary:     '#753BBD',   // PMS266C  — main brand purple
  colorPrimaryText: '#FFFFFF',   // Text on primary-colored backgrounds
  colorPrimarySoft: '#F0E8F9',   // Light purple tint — panels, focus rings, chips

  // ---------------------------------------------------------------------------
  // SECONDARY / INFO PALETTE  (PMS2386C — Pharos Blue)
  // ---------------------------------------------------------------------------
  colorInfo:        '#2D68C4',   // PMS2386C — blue; used for date chips, links
  colorInfoSoft:    '#EEF3FB',   // PMS656C  — light blue background tint

  // ---------------------------------------------------------------------------
  // NEUTRAL PALETTE  (Pharos grays + dark)
  // ---------------------------------------------------------------------------
  colorBg:          '#FAFAFA',   // Page background (keep near-white)
  colorSurface:     '#FFFFFF',   // Card / panel backgrounds
  colorText:        '#3D3935',   // PMS BLACK7C — near-black body text
  colorMuted:       '#888B8D',   // Cool Gray 8  — secondary text, labels
  colorSubtle:      '#BBBCBC',   // Cool Gray 4  — placeholder text, faint labels
  colorBorder:      '#E0E0E0',   // Cool Gray 1  — card borders, dividers
  colorBorderStrong:'#BBBCBC',   // Cool Gray 4  — stronger borders, inputs

  // ---------------------------------------------------------------------------
  // STATUS COLORS  (Pharos secondary palette)
  // ---------------------------------------------------------------------------
  colorSuccess:     '#6CC24A',   // PMS360C  — green; completed states
  colorWarning:     '#FFA400',   // PMS137C  — amber; in-progress, due-soon
  colorWarningSoft: '#FFF5E0',   // Amber tint
  colorDanger:      '#CD545B',   // PMS7418C — coral/red; overdue, delete

  // ---------------------------------------------------------------------------
  // HEADER
  // Set headerBg to colorPrimary ('#753BBD') for a dark purple header.
  // Keep '#FFFFFF' for a clean white header with purple accents.
  // ---------------------------------------------------------------------------
  headerBg:         '#FFFFFF',
  headerTextColor:  '#3D3935',

  // ---------------------------------------------------------------------------
  // CUSTOM CSS ESCAPE HATCH
  // Add any one-off overrides here as a plain CSS string.
  // Example: 'nav { border-bottom: 2px solid #753BBD; }'
  // ---------------------------------------------------------------------------
  customCss: `
    nav { border-bottom: 2px solid #F0E8F9; }
    nav button.active { font-weight: 600; }
    .quick-capture { border-color: #C9A8E8; background: #F7F0FD; }
  `

};

// =============================================================================
// APPLY  — do not edit below this line
// =============================================================================
(function applyBrand() {
  var B = window.PHAROS_BRAND;
  if (!B) return;

  // 1. Inject Google Font
  if (B.fontUrl) {
    var link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = B.fontUrl;
    document.head.appendChild(link);
  }

  // 2. Override CSS custom properties on :root
  var cssVars = {
    '--primary':       B.colorPrimary,
    '--primary-soft':  B.colorPrimarySoft,
    '--info':          B.colorInfo,
    '--info-soft':     B.colorInfoSoft,
    '--bg':            B.colorBg,
    '--surface':       B.colorSurface,
    '--text':          B.colorText,
    '--muted':         B.colorMuted,
    '--subtle':        B.colorSubtle,
    '--border':        B.colorBorder,
    '--border-strong': B.colorBorderStrong,
    '--success':       B.colorSuccess,
    '--warning':       B.colorWarning,
    '--warning-soft':  B.colorWarningSoft,
    '--danger':        B.colorDanger,
  };
  var root = document.documentElement;
  Object.keys(cssVars).forEach(function(k) {
    if (cssVars[k]) root.style.setProperty(k, cssVars[k]);
  });

  // 3. Font family (body is hardcoded in CSS, so override via style)
  if (B.fontFamily) {
    var fontStyle = document.createElement('style');
    fontStyle.textContent = 'body, input, select, textarea, button { font-family: ' + B.fontFamily + ' !important; }';
    document.head.appendChild(fontStyle);
  }

  // 4. Custom CSS
  if (B.customCss && B.customCss.trim()) {
    var customStyle = document.createElement('style');
    customStyle.textContent = B.customCss;
    document.head.appendChild(customStyle);
  }

  // 5. DOM updates — runs after page is ready
  function updateDOM() {
    // Page title
    if (B.appName) document.title = B.appName;

    // Header h1
    var h1 = document.querySelector('header h1');
    if (h1 && B.appName) h1.textContent = B.appName;

    // Org name sub-label (insert after h1 if not already there)
    if (B.orgName && h1) {
      var existing = document.getElementById('brand-org-label');
      if (!existing) {
        var orgLabel = document.createElement('div');
        orgLabel.id = 'brand-org-label';
        orgLabel.style.cssText = 'font-size:11px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;color:' + (B.colorMuted || '#888B8D') + ';margin-top:1px;';
        orgLabel.textContent = B.orgName;
        h1.insertAdjacentElement('afterend', orgLabel);
      }
    }

    // Logo — insert above h1 in the header's left column
    if (B.logoUrl) {
      var headerLeft = document.querySelector('header > div:first-child');
      if (headerLeft && !document.getElementById('brand-logo')) {
        var img = document.createElement('img');
        img.id  = 'brand-logo';
        img.src = B.logoUrl;
        img.alt = B.orgName || 'Logo';
        img.style.cssText = 'height:' + (B.logoHeight || '28px') + ';display:block;margin-bottom:8px;';
        img.onerror = function() { this.style.display = 'none'; }; // hide if URL fails
        headerLeft.insertBefore(img, headerLeft.firstChild);
      }
    }

    // Header background / text color
    var headerEl = document.querySelector('header');
    if (headerEl) {
      if (B.headerBg)        headerEl.style.backgroundColor = B.headerBg;
      if (B.headerTextColor) headerEl.style.color = B.headerTextColor;
    }

    // Favicon
    if (B.faviconUrl) {
      var favicon = document.querySelector('link[rel="icon"]') || document.createElement('link');
      favicon.rel  = 'icon';
      favicon.href = B.faviconUrl;
      if (!favicon.parentNode) document.head.appendChild(favicon);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateDOM);
  } else {
    updateDOM();
  }

}());
