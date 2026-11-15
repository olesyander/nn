/**
 * RESEARCH MAP — SITE SETTINGS (edit this file first)
 * ==================================================
 * This file controls DISPLAY ONLY. No GitHub tokens or private file paths here.
 * To change the title in the generated catalog, edit PRIVATE-LIBRARY/project.json.
 * JS syntax: strings in quotes; booleans as true / false.
 */
window.RESEARCH_MAP_CONFIG = {
  // null = show title received from catalog.json (PRIVATE-LIBRARY/project.json).
  // Use a string to override the visible header without rebuilding the catalog.
  titleOverride: null,

  // Controls and text visible to readers. English by default.
  labels: {
    libraryTab: 'Library',
    knowledgeTab: 'Knowledge Graph',
    searchPlaceholder: 'Search title or author…',
    timeUnavailable: 'Update time unavailable',
    citationFilter: 'Citations',
    authorFilter: 'Shared authors',
    similarFilter: 'Similar text',
    isolatedFilter: 'Isolated papers',
    viewPublication: 'View publication',
    findPublication: 'Find publication',
    openArticle: 'Open article',
    openRepository: 'Open repository',
    articleType: 'ARTICLE',
    bookType: 'BOOK',
    codeType: 'CODE',
    relationType: 'RELATION',
    authors: 'AUTHORS',
    abstract: 'ABSTRACT',
    connection: 'CONNECTION',
    unknownAuthor: 'Not identified',
    missingAbstract: 'Abstract not available.',
    restricted: 'Restricted access'
  },

  // Presentation settings; these do not change which connections Python finds.
  library: {
    labelMaxCharacters: 53,    // Shorten lengthy paper names in the library tree.
    searchMaxResults: 12,       // Maximum matches shown under search input.
    nodeGap: 37,                // Vertical spacing between tree nodes, in px.
    branchGap: 255              // Horizontal spacing between tree levels, in px.
  },
  knowledge: {
    // One edge per pair: stronger relationship takes precedence.
    // Keep all 3 types here; reorder their numeric priority if desired.
    relationPriority: { citation: 0, author: 1, similar: 2 },
    // Front-end display floor. Python builds links >= 0.15 by default;
    // raising this filters visible links without re-running GitHub Actions.
    minimumTextStrength: 0.15,
    showIsolatedInitially: true,
    showCitationsInitially: true,
    showAuthorsInitially: true,
    showSimilarityInitially: true
  },
  // Local timestamp display; release.json contains ONLY the timestamp.
  date: { locale: 'en-GB', timeZone: 'Europe/Moscow' }
};

// Set static labels before app.js / knowledge.js load.
(() => {
  const c = window.RESEARCH_MAP_CONFIG;
  const L = c.labels;
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set('tab-library', L.libraryTab);
  set('tab-knowledge', L.knowledgeTab);
  const search = document.getElementById('search-input');
  if (search) search.placeholder = L.searchPlaceholder;
  for (const [id, label] of [
    ['kg-citation', L.citationFilter], ['kg-author', L.authorFilter],
    ['kg-similar', L.similarFilter], ['kg-isolated', L.isolatedFilter]
  ]) {
    const input = document.getElementById(id);
    // label contains only an input and text. Preserve the checkbox.
    if (input && input.parentElement) {
      input.parentElement.replaceChildren(input, document.createTextNode(' ' + label));
    }
  }
  if (c.titleOverride) document.title = c.titleOverride;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--page-bg').trim();
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta && color) themeMeta.content = color;
})();
