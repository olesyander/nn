/* Research Map v3.6.2 · Original automatic relation graph, no clusters. */
(() => {
  'use strict';
  const CFG = window.RESEARCH_MAP_CONFIG || {};
  const T = CFG.labels || {};
  const $ = id => document.getElementById(id);
  const canvas = $('knowledge-view');
  const library = $('canvas');
  if (!canvas || !library || !window.d3) return;
  const svg = d3.select('#knowledge-svg');
  // All node/edge colors come exclusively from CSS classes in theme.css.
  // Do NOT set SVG fill/stroke attributes in JavaScript: the two colors
  // (connected gold / isolated grey) stay independent of CSS load order.
  const viewport = svg.append('g');
  const edgeLayer = viewport.append('g').attr('class','knowledge-edges');
  const nodeLayer = viewport.append('g').attr('class','knowledge-nodes');
  const zoom = d3.zoom().scaleExtent([.15,4]).on('zoom',e=>viewport.attr('transform',e.transform));
  svg.call(zoom).on('dblclick.zoom',null);
  let graph={nodes:[],edges:[]}, simulation=null, loaded=false, current='knowledge';
  const edgeNames={citation:(T.citationFilter || 'Citations'),author:(T.authorFilter || 'Shared authors'),similar:(T.similarFilter || 'Similar text')};
  const filters={citation:$('kg-citation'),author:$('kg-author'),similar:$('kg-similar')};
  // Constant minimum: the former slider's lowest value (0.15).
  // The producer uses the same threshold (0.15); no runtime API needed.
  const SIMILARITY_FLOOR = CFG.knowledge?.minimumTextStrength ?? 0.15;
  const RELATION_PRIORITY = CFG.knowledge?.relationPriority || {citation:0,author:1,similar:2};

  function chooseEdges(allEdges, enabled, available) {
    // Important: choose the strongest *enabled type*, never discard provenance.
    // One visible edge per unordered publication pair; citation direction retained.
    const byPair = new Map();
    for (const edge of allEdges) {
      if (!enabled.has(edge.type)) continue;
      if (!(edge.type in RELATION_PRIORITY)) continue;
      if (!available.has(edge.source) || !available.has(edge.target)) continue;
      if (edge.source === edge.target) continue;
      if (edge.type === 'similar' && Number(edge.strength || 0) < SIMILARITY_FLOOR) continue;
      const a = String(edge.source), b = String(edge.target);
      const key = JSON.stringify(a < b ? [a,b] : [b,a]);
      const old = byPair.get(key);
      if (!old) {byPair.set(key, edge); continue;}
      const rankNew = RELATION_PRIORITY[edge.type];
      const rankOld = RELATION_PRIORITY[old.type];
      const tie = rankNew === rankOld;
      const strengthNew = Number(edge.strength || 0);
      const strengthOld = Number(old.strength || 0);
      // Deterministic tie-breaker also covers two opposite citations.
      const directionNew = String(edge.source) + '|' + String(edge.target);
      const directionOld = String(old.source) + '|' + String(old.target);
      if (rankNew < rankOld || (tie &&
          (strengthNew > strengthOld || (strengthNew === strengthOld && directionNew < directionOld)))) {
        byPair.set(key, edge);
      }
    }
    return [...byPair.values()];
  }
  const isolates=$('kg-isolated');
  if (CFG.knowledge) {
    for (const [name,key] of [['citation','showCitationsInitially'],['author','showAuthorsInitially'],['similar','showSimilarityInitially']]) {
      if (filters[name]) filters[name].checked = CFG.knowledge[key] !== false;
    }
  }

  if (CFG.knowledge) isolates.checked = CFG.knowledge.showIsolatedInitially !== false;
  const make=(tag,text)=>{const e=document.createElement(tag); e.textContent=text;return e;};
  function safeUrl(raw) {
    try { const u=new URL(String(raw||''),location.href);return ['http:','https:'].includes(u.protocol)?u.href:null;}
    catch {return null;}
  }
  function anchor(target,label,url){
    const href=safeUrl(url);if(!href)return;
    const a=make('a',label);a.href=href;a.rel='noopener noreferrer';a.target='_blank';target.append(a);
  }
  function relationSummary(edge, src, dest){
    if(edge.type==='citation') return 'Citation: ' + (src?.title || 'Source publication') + ' cites ' + (dest?.title || 'target publication') + '.';
    if(edge.type==='author') {
      const names = Array.isArray(edge.authors) && edge.authors.length ? edge.authors.join(', ') : '';
      return names ? 'Shared author' + (edge.authors.length>1 ? 's' : '') + ': ' + names : (edge.explanation || 'Shared authorship.');
    }
    if(edge.type==='similar') {
      const terms = Array.isArray(edge.terms) && edge.terms.length ? edge.terms.join(', ') : '';
      return terms ? 'Common keywords: ' + terms : (edge.explanation || 'Shared keywords.');
    }
    return edge.explanation || 'Connection metadata unavailable.';
  }
  function setRelationMode(isRelation){
    const authorsLabel = $('authors-label');
    const abstractLabel = $('abstract-label');
    const abstract = $('abstract');
    if (authorsLabel) authorsLabel.textContent = isRelation ? (T.connection || 'CONNECTION') : (T.authors || 'AUTHORS');
    if (abstractLabel) abstractLabel.style.display = isRelation ? 'none' : '';
    if (abstract) abstract.style.display = isRelation ? 'none' : '';
    if (!isRelation && abstractLabel) abstractLabel.textContent = (T.abstract || 'ABSTRACT');
  }
  function openPanel(node,edge=null){
    const title=$('paper-title'), authors=$('authors'), abstract=$('abstract'), access=$('access'), external=$('external');
    if(!title||!authors||!abstract||!access||!external)return;
    access.replaceChildren();external.replaceChildren();
    if(edge){
      const src=graph.nodes.find(n=>n.id===edge.sourceId);
      const dest=graph.nodes.find(n=>n.id===edge.targetId);
      setRelationMode(true);
      $('type-label').textContent=(T.relationType || 'RELATION');
      title.textContent=(src?.title||'Unknown')+' ↔ '+(dest?.title||'Unknown');
      authors.textContent=relationSummary(edge, src, dest);
      access.append(make('strong',edgeNames[edge.type]||'Connection'));
      if(edge.type==='citation') access.append(make('div','Direction: source publication cites target publication.'));
      if(src)anchor(external,'Source publication',src.sourceUrl||src.openUrl);
      if(dest)anchor(external,'Target publication',dest.sourceUrl||dest.openUrl);
    } else {
      setRelationMode(false);
      $('type-label').textContent=node.kind==='book'?(T.bookType || 'BOOK'):(T.articleType || 'ARTICLE');
      title.textContent=node.title||'Untitled';
      authors.textContent=node.authors||(T.unknownAuthor || 'Not identified');
      abstract.textContent=node.abstract||(T.missingAbstract || 'Abstract not available.');
      access.append(make('strong',node.access==='restricted'?(T.restricted || 'Restricted access'):'Publication details'));
      if(node.access!=='restricted'){
        if(node.sourceUrl)anchor(external,(T.viewPublication || 'View publication'),node.sourceUrl);
        else anchor(external,(T.findPublication || 'Find publication'),'https://scholar.google.com/scholar?q='+encodeURIComponent(node.title||''));
        anchor(external,(T.openArticle || 'Open article'),node.openUrl||(node.downloadUrl?'./'+node.downloadUrl:null));
      }else access.append(make('div','The original file is not publicly available.'));
    }
    $('drawer').classList.add('open');$('drawer').setAttribute('aria-hidden','false');
    $('overlay').classList.add('show');
  }
  function dims(){const r=canvas.getBoundingClientRect();return {w:Math.max(300,r.width),h:Math.max(250,r.height)};}
  function closeSimulation(){if(simulation){simulation.stop();simulation=null;}}
  function switchTab(tab){
    current=tab;
    library.hidden=(tab!=='library');canvas.hidden=(tab!=='knowledge');
    for(const t of ['library','knowledge']){
      const b=$('tab-'+t);b.classList.toggle('active',tab===t);b.setAttribute('aria-selected',String(tab===t));
    }
    // Library search stays available on both tabs; choosing a result switches to Library.
    $('search-input').setAttribute('aria-label', 'Search library publications');
    $('drawer').classList.remove('open');$('drawer').setAttribute('aria-hidden','true');$('overlay').classList.remove('show');
    if(tab==='knowledge'){if(loaded)draw();else load();}
    else {closeSimulation();window.dispatchEvent(new Event('resize'));}
  }
  window.researchMapShowLibrary=()=>switchTab('library');
  $('tab-library').addEventListener('click',()=>switchTab('library'));
  $('tab-knowledge').addEventListener('click',()=>switchTab('knowledge'));
  // Zoom is available through wheel, trackpad and touch gestures only.
  function load(){
    $('knowledge-status').textContent='Loading relationships…';
    fetch('./knowledge.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('knowledge.json unavailable');return r.json();})
      .then(data=>{
        if(!Array.isArray(data.nodes)||!Array.isArray(data.edges))throw Error('Invalid graph data');
        graph=data;loaded=true;draw();
      }).catch(()=>{$('knowledge-status').textContent='Knowledge graph unavailable. Publish knowledge.json from the private build.';});
  }
  function draw(){
    closeSimulation();edgeLayer.selectAll('*').remove();nodeLayer.selectAll('*').remove();
    const allowed=new Set(Object.keys(filters).filter(t=>filters[t].checked));
    const available=new Set(graph.nodes.map(n=>n.id));
    const edges=chooseEdges(graph.edges, allowed, available);
    const degrees=new Map();edges.forEach(e=>{degrees.set(e.source,(degrees.get(e.source)||0)+1);degrees.set(e.target,(degrees.get(e.target)||0)+1);});
    const dataset=graph.nodes.filter(n=>isolates.checked||degrees.has(n.id));
    const ids=new Set(dataset.map(n=>n.id));
    const activeEdges=edges.filter(e=>ids.has(e.source)&&ids.has(e.target))
      .map((e,i)=>({...e,sourceId:e.source,targetId:e.target,id:i}));
    const {w,h}=dims();
    $('knowledge-status').textContent=`${dataset.length} publications · ${activeEdges.length} connections · ${graph.nodes.length-dataset.length} hidden`;
    if(!dataset.length) return;

    // Find the connected components of the CURRENTLY VISIBLE graph.
    // Filters can split one group into several; isolates are components of size 1.
    const adjacency=new Map(dataset.map(n=>[n.id,new Set()]));
    for(const edge of activeEdges){
      adjacency.get(edge.sourceId).add(edge.targetId);
      adjacency.get(edge.targetId).add(edge.sourceId);
    }
    const unseen=new Set(dataset.map(n=>n.id));
    const components=[];
    for(const n of dataset){
      if(!unseen.has(n.id))continue;
      const queue=[n.id], memberIds=new Set([n.id]);unseen.delete(n.id);
      for(let i=0;i<queue.length;i++){
        for(const next of adjacency.get(queue[i])){
          if(unseen.delete(next)){memberIds.add(next);queue.push(next);}
        }
      }
      components.push(memberIds);
    }
    components.sort((a,b)=>b.size-a.size||String([...a][0]).localeCompare(String([...b][0])));

    // Each connected component settles in its own local force simulation.
    // Unlike one global simulation, separate islands cannot attract each other
    // toward the same center and collide visually.
    const positioned=[];
    for(const members of components){
      const componentNodes=dataset.filter(n=>members.has(n.id)).map((n,i)=>({
        ...n,
        x:Math.cos(i*2.39996323)*20*Math.sqrt(i),
        y:Math.sin(i*2.39996323)*20*Math.sqrt(i)
      }));
      const componentLinks=activeEdges.filter(e=>members.has(e.sourceId)&&members.has(e.targetId))
        .map(e=>({source:e.sourceId,target:e.targetId,type:e.type}));
      if(componentNodes.length>1){
        const local=d3.forceSimulation(componentNodes)
          .force('link',d3.forceLink(componentLinks).id(d=>d.id)
            .distance(d=>d.type==='citation'?105:120).strength(.4))
          .force('charge',d3.forceManyBody().strength(componentNodes.length>90?-65:-150))
          .force('collision',d3.forceCollide(17))
          .force('center',d3.forceCenter(0,0))
          .stop();
        for(let tick=0;tick<230;tick++)local.tick();
      }
      const minx=d3.min(componentNodes,n=>n.x),maxx=d3.max(componentNodes,n=>n.x);
      const miny=d3.min(componentNodes,n=>n.y),maxy=d3.max(componentNodes,n=>n.y);
      const cx=(minx+maxx)/2,cy=(miny+maxy)/2;
      // Radius contains all dots plus a generous gap between islands.
      let radius=0;
      for(const n of componentNodes){n.x-=cx;n.y-=cy;radius=Math.max(radius,Math.hypot(n.x,n.y));}
      positioned.push({nodes:componentNodes,radius:Math.max(46,radius+65)});
    }
    // Non-overlapping circle packing; keeps disconnected graphs separate.
    const packed=positioned.map((c,i)=>({r:c.radius,index:i}));
    d3.packSiblings(packed);
    for(const packedCircle of packed){
      const component=positioned[packedCircle.index];
      for(const n of component.nodes){n.x+=packedCircle.x;n.y+=packedCircle.y;}
    }
    const nodes=positioned.flatMap(c=>c.nodes);
    const coords=new Map(nodes.map(n=>[n.id,n]));
    const renderPositions=()=>{
      lines.attr('x1',d=>coords.get(d.sourceId)?.x??0)
        .attr('y1',d=>coords.get(d.sourceId)?.y??0)
        .attr('x2',d=>coords.get(d.targetId)?.x??0)
        .attr('y2',d=>coords.get(d.targetId)?.y??0);
      group.attr('transform',d=>`translate(${d.x},${d.y})`);
    };

    const lines=edgeLayer.selectAll('line').data(activeEdges).join('line')
      .attr('class',d=>'knowledge-link relation-'+d.type)
      .attr('stroke-width',d=>d.type==='citation'?2.7:d.type==='author'?2.25:1.9)
      .attr('stroke-opacity',.9).attr('tabindex',0).attr('role','button')
      .attr('aria-label',d=>edgeNames[d.type]||'Connection')
      .on('click',(_e,d)=>openPanel(null,d))
      .on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPanel(null,d);}});
    lines.append('title').text(d=>relationSummary(d,coords.get(d.sourceId),coords.get(d.targetId)));
    const group=nodeLayer.selectAll('g').data(nodes,d=>d.id).join('g')
      .attr('class',d=>'knowledge-node'+(degrees.has(d.id)?' is-connected':' is-isolated')+(d.access==='restricted'?' is-restricted':''))
      .attr('tabindex',0).attr('role','button')
      .attr('aria-label',d=>d.title||'Publication')
      .on('click',(_e,d)=>openPanel(d))
      .on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPanel(d);}});
    group.append('circle').attr('r',d=>degrees.has(d.id)?6.6:4.9);
    // No permanent labels: dense groups remain readable.
    // Native SVG title shows the full publication name on hover.
    group.append('title').text(d=>d.title||'Untitled publication');
    renderPositions();
    group.call(d3.drag()
      .on('start',function(){d3.select(this).raise();})
      .on('drag',function(e,d){d.x=e.x;d.y=e.y;renderPositions();}));

    // Fit all connected components into the available viewport.
    const minx=d3.min(packed,c=>c.x-c.r),maxx=d3.max(packed,c=>c.x+c.r);
    const miny=d3.min(packed,c=>c.y-c.r),maxy=d3.max(packed,c=>c.y+c.r);
    const cx=(minx+maxx)/2,cy=(miny+maxy)/2;
    const fit=Math.min(1.25,Math.max(.15,
      Math.min((w-70)/Math.max(1,maxx-minx),(h-135)/Math.max(1,maxy-miny))));
    svg.call(zoom.transform,d3.zoomIdentity.translate(w/2,h/2+24).scale(fit).translate(-cx,-cy));
  }

  Object.values(filters).forEach(c=>c.addEventListener('change',()=>{if(loaded&&current==='knowledge')draw();}));
  isolates.addEventListener('change',()=>{if(loaded&&current==='knowledge')draw();});
  $('close').addEventListener('click',()=>nodeLayer.selectAll('.knowledge-node').classed('active',false));
  window.addEventListener('resize',()=>{if(current==='knowledge'&&loaded)draw();});
  // The graph is FIRST and visible immediately, including on a fresh page load.
  switchTab('knowledge');
})();
