/* Research map · multiple libraries · external publication links · local downloads */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  if (!window.d3) { $('message').hidden = false; $('message').textContent = 'Unable to load the graph renderer.'; return; }
  const svg = d3.select('#map');
  const viewport = svg.append('g').attr('class', 'viewport');
  const links = viewport.append('g');
  const nodes = viewport.append('g');
  const zoom = d3.zoom().scaleExtent([0.13, 3.5]).on('zoom', (event) => viewport.attr('transform', event.transform));
  svg.call(zoom).on('dblclick.zoom', null);
  const treeLayout = d3.tree().nodeSize([37, 255]).separation((a, b) => a.parent === b.parent ? 1 : 1.3);
  let root, selected = null;
  let searchable = [];
  const labelLimit = 53;
  function short(s, n = labelLimit) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function el(tag, text) { const e = document.createElement(tag); e.textContent = text; return e; }
  function hidePanel() {
    $('drawer').classList.remove('open'); $('drawer').setAttribute('aria-hidden','true');
    $('overlay').classList.remove('show'); selected = null;
    nodes.selectAll('.node').classed('active', false);
  }
  function publicationPage(data) {
    // Prefer a DOI/arXiv/publisher page recorded during catalog generation.
    const source = String(data.sourceUrl || '').trim();
    if (/^https?:\/\//i.test(source)) {
      try {
        const u = new URL(source);
        const host = u.hostname.toLowerCase();
        // A hosted copy of our PDF is NOT a publisher/publication page.
        const isFileHost = host === 'github.com' || host.endsWith('.github.io') ||
          host === 'raw.githubusercontent.com' || host === 'githubusercontent.com';
        const isPdf = u.pathname.toLowerCase().endsWith('.pdf');
        if (!isFileHost && !isPdf) {
          return { href: u.href, label: 'View publication' };
        }
      } catch (_error) {
        // Fall back to title search for malformed links.
      }
    }
    // If the PDF contains no identifiable DOI/arXiv, open a scholarly search,
    // not the local PDF. The label makes it clear this is a search result.
    const title = String(data.title || data.name || '').trim();
    if (title) {
      return {
        href: 'https://scholar.google.com/scholar?q=' + encodeURIComponent(title),
        label: 'Find publication'
      };
    }
    return null;
  }
  function addPublicationLink(container, data) {
    const page = publicationPage(data);
    if (!page) return false;
    const view = el('a', page.label);
    view.href = page.href;
    view.target = '_blank';
    view.rel = 'noopener noreferrer';
    container.append(view);
    return true;
  }
  function detail(data) {
    selected = data.id;
    $('paper-title').textContent = data.title || data.name;
    $('authors').textContent = data.authors || 'Not identified';
    $('abstract').textContent = data.abstract || 'Abstract not available.';
    $('type-label').textContent = data.kind === 'book' ? 'BOOK' : 'ARTICLE';
    const access = $('access'); access.replaceChildren();
    const ext = $('external'); ext.replaceChildren();
    if (data.access === 'restricted') {
      access.append(el('strong', 'Restricted access'));
      access.append(el('div', 'This file is not available for public viewing or download.'));
    } else if (data.downloadUrl) {
      access.append(el('strong', 'Full text available'));
      const fileUrl = './' + data.downloadUrl;
      const isPdf = data.downloadUrl.toLowerCase().endsWith('.pdf');
      // First button always leads outside the library to a publication page
      // (DOI/arXiv) or, if unknown, a scholarly search by title.
      addPublicationLink(ext, data);
      // Second button downloads the file stored in the public repository.
      const download = el('a', isPdf ? 'Download PDF' : 'Download file');
      download.href = fileUrl;
      download.setAttribute('download', data.originalFilename || '');
      download.classList.add('download');
      ext.append(download);
    } else if (data.sourceUrl || data.title || data.name) {
      access.append(el('strong', 'Read at source'));
      addPublicationLink(ext, data);
    } else {
      access.append(el('strong', 'File not publicly available'));
    }
    $('drawer').classList.add('open'); $('drawer').setAttribute('aria-hidden','false');
    $('overlay').classList.add('show');
    nodes.selectAll('.node').classed('active', n => n.data.id === selected);
  }
  // Search the complete catalog, including publications hidden in collapsed branches.
  const searchInput = $('search-input');
  const searchResults = $('search-results');
  const norm = value => String(value || '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const searchableTitle = data => String(data.title || data.name || '');
  const searchableAuthors = data => Array.isArray(data.authors) ? data.authors.join(', ') : String(data.authors || '');
  function closeSearch() {
    searchResults.hidden = true;
    searchInput.setAttribute('aria-expanded','false');
    searchResults.replaceChildren();
  }
  function centerNode(node) {
    const canvas = $('canvas').getBoundingClientRect();
    const openSidebar = $('drawer').classList.contains('open') && canvas.width > 850;
    const availableWidth = canvas.width - (openSidebar ? 430 : 0);
    const current = d3.zoomTransform(svg.node());
    // Make the selected node readable, even if the whole tree was zoomed out.
    const scale = Math.min(1.15, Math.max(0.8, current.k));
    const x = availableWidth * 0.52 - node.y * scale;
    const y = canvas.height * 0.47 - node.x * scale;
    svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
  }
  function chooseSearchResult(node) {
    // Unfold ancestors of the result while preserving other collapsed branches.
    for (let p = node.parent; p; p = p.parent) {
      if (p._children) { p.children = p._children; p._children = null; }
    }
    closeSearch();
    searchInput.value = searchableTitle(node.data);
    render(false);
    detail(node.data);
    centerNode(node);
  }
  function updateSearch() {
    const terms = norm(searchInput.value).split(' ').filter(Boolean);
    searchResults.replaceChildren();
    if (!terms.length || !searchable.length) { closeSearch(); return; }
    const matches = searchable.map(node => {
      const title = norm(searchableTitle(node.data));
      const authors = norm(searchableAuthors(node.data));
      const combined = title + ' ' + authors;
      if (!terms.every(term => combined.includes(term))) return null;
      const query = terms.join(' ');
      const priority = title.startsWith(query) ? 0 : title.includes(query) ? 1 :
        authors.startsWith(query) ? 2 : 3;
      return {node, priority};
    }).filter(Boolean).sort((a,b) => a.priority - b.priority ||
      searchableTitle(a.node.data).localeCompare(searchableTitle(b.node.data)));
    searchResults.hidden = false;
    searchInput.setAttribute('aria-expanded','true');
    if (!matches.length) {
      const empty = el('div', 'No matching publications');
      empty.className = 'search-empty';
      searchResults.append(empty);
      return;
    }
    for (const {node} of matches.slice(0, 12)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-result';
      button.setAttribute('role', 'option');
      const title = el('span', searchableTitle(node.data));
      title.className = 'search-result-title';
      const authors = searchableAuthors(node.data);
      const subtitle = el('span', authors || (node.data.kind === 'book' ? 'Book' : 'Article'));
      subtitle.className = 'search-result-meta';
      button.append(title, subtitle);
      button.addEventListener('click', () => chooseSearchResult(node));
      searchResults.append(button);
    }
    if (matches.length > 12) {
      searchResults.append(Object.assign(el('div', `${matches.length - 12} more matches — refine your search`), {className:'search-empty'}));
    }
  }
  searchInput.addEventListener('input', updateSearch);
  searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) updateSearch(); });
  searchInput.addEventListener('keydown', event => {
    const buttons = searchResults.querySelectorAll('button.search-result');
    if (event.key === 'Escape') { closeSearch(); searchInput.blur(); event.stopPropagation(); }
    if (event.key === 'ArrowDown' && buttons.length) { event.preventDefault(); buttons[0].focus(); }
    if (event.key === 'Enter' && buttons.length) { event.preventDefault(); buttons[0].click(); }
  });
  searchResults.addEventListener('keydown', event => {
    const buttons = [...searchResults.querySelectorAll('button.search-result')];
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'Escape') {event.preventDefault(); closeSearch(); searchInput.focus(); event.stopPropagation();}
    if (event.key === 'ArrowDown') {event.preventDefault(); buttons[Math.min(buttons.length - 1, index + 1)]?.focus();}
    if (event.key === 'ArrowUp') {event.preventDefault(); if(index === 0)searchInput.focus();else buttons[Math.max(0,index-1)]?.focus();}
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.search-wrap')) closeSearch();
  });
  function descendants(node) { return [node, ...(node.children || []).flatMap(descendants), ...(node._children || []).flatMap(descendants)]; }
  function expand(node) { if (node._children) { node.children = node._children; node._children = null; } (node.children || []).forEach(expand); }
  function collapse(node) { (node.children || []).forEach(collapse); if (node.children) { node._children = node.children; node.children = null; } }
  function fit(duration = 400) {
    const e = viewport.node().getBBox();
    const area=$('canvas').getBoundingClientRect();
    if (!e.width || !e.height || !area.width || !area.height) return;
    const side = $('drawer').classList.contains('open') && area.width > 850 ? 410 : 0;
    const usable = area.width - side;
    const scale = Math.min(1.15, Math.max(.13, (usable - 105) / e.width), Math.max(.13,(area.height - 95) / e.height));
    const x = (usable - e.width * scale)/2 - e.x*scale;
    const y = (area.height - e.height * scale)/2 - e.y*scale;
    svg.transition().duration(duration).call(zoom.transform,d3.zoomIdentity.translate(x,y).scale(scale));
  }
  function render(autoFit=false) {
    const tree=treeLayout(root);
    const list=tree.descendants();
    const path=d3.linkHorizontal().x(d=>d.y).y(d=>d.x);
    links.selectAll('path.link').data(tree.links(),d=>d.target.data.id)
      .join('path').attr('class','link').attr('d',path);
    const selection = nodes.selectAll('g.node').data(list,d=>d.data.id)
      .join(enter => {
        const g=enter.append('g').attr('class', d=>'node '+d.data.kind).attr('tabindex',0).attr('role','button');
        g.append('circle'); g.append('text').attr('x',14).attr('dy','.35em');
        g.append('title'); return g;
      })
      .attr('transform', d=>`translate(${d.y},${d.x})`)
      .classed('active', d=>d.data.id===selected)
      .on('click', (_event,d)=>activate(d))
      .on('keydown', (event,d)=>{if (event.key==='Enter' || event.key===' ') {event.preventDefault();activate(d);}});
    selection.select('circle').attr('r',d=>d.depth===0?10:d.data.kind==='folder'?7:5);
    selection.select('text').text(d=>short(d.data.name,d.data.kind==='folder'?35:labelLimit));
    selection.select('title').text(d=>d.data.name);
    if (autoFit) fit();
  }
  function activate(node) {
    if (node.data.kind === 'folder') {
      hidePanel();
      if (node.children) { node._children=node.children; node.children=null; }
      else if(node._children){node.children=node._children;node._children=null;}
      render(true);
    } else detail(node.data);
  }
  $('expand').addEventListener('click',()=>{ if(!root)return;expand(root);render(true); });
  $('collapse').addEventListener('click',()=>{
    if(!root)return;
    hidePanel();
    // Keep the topic names visible, collapse their descendants.
    expand(root);
    (root.children||[]).forEach(collapse);
    render(true);
  });
  $('close').addEventListener('click',hidePanel);
  $('overlay').addEventListener('click',hidePanel);
  window.addEventListener('keydown',event=>{if(event.key==='Escape')hidePanel();});
  window.addEventListener('resize',()=>{if(root)fit(100);});
  fetch('./catalog.json', {cache:'no-store'})
    .then(response=>{if(!response.ok)throw Error('Catalog unavailable');return response.json();})
    .then(data=>{
      root=d3.hierarchy(data.tree);
      const mapTitle = String(data.title || data.tree?.name || 'disorder map').trim();
      document.title = mapTitle;
      const brand = $('brand');
      if (brand && mapTitle) {
        const parts = mapTitle.split(/\s+/);
        const finalWord = parts.pop();
        brand.replaceChildren(document.createTextNode(parts.length ? parts.join(' ') + ' ' : ''), el('span', finalWord));
      }
      searchable = root.descendants().filter(node => node.data.kind === 'article' || node.data.kind === 'book');
      // Start compact: root + main topics, expand folders manually or all at once.
      (root.children||[]).forEach(collapse);
      render(true);
    })
    .catch(()=>{ $('message').hidden=false;$('message').textContent='Unable to load the library catalog.'; });
})();
