# Public Research Map site — v3.6.3

The site loads `style.css` (including the complete color palette),
`site-config.js`, `app.js` and `knowledge.js`. The external D3 script
is loaded from the standard CDN.

**All colors are now edited at the very beginning of `style.css`**, under
`01. ЦВЕТОВАЯ ПАЛИТРА`. Layout rules follow in section 02. The site no
longer requires `theme.css`; the old two-file scheme could fail whenever
GitHub Pages omitted the second stylesheet.

Names and labels are configured in `site-config.js`. Site title can come
from `catalog.json` generated from private `project.json`, or from the
optional override in `site-config.js`.

The included `.github/workflows/deploy-pages.yml` deploys the self-contained
stylesheet. In repository Settings → Pages, use **GitHub Actions**.

For a website already using v3.6.2, read `../INSTALL_V363_RU.md`.
