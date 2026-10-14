/* 京津冀教育协同监测平台 · 静态数据初版 */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const fmt = n => Number(n || 0).toLocaleString('zh-CN');
const CUEB = '首都经济贸易大学';
const STAGES = ['高等教育','基础教育','职业教育','综合'];
const TYPES = ['资源共享','人才培养','办学合作','产教科教融合','治理机制'];
const TYPE_COLORS = ['#1887ff','#3ac9b4','#ffa72e','#bc78f4','#8da6c7'];
const STAGE_COLORS = ['#198aff','#ffad31','#40c5a7','#b976f6','#789dc9'];
const ACTOR_COLORS = {'高校':'#287fff','中小学':'#4cdecf','职业院校':'#ffba38','科研机构':'#bf7bf5','政府部门':'#fb6679','企业':'#f7d74d','其他':'#9aacc1'};
const DIMENSIONS = ['高校创新与服务能力','教育普及与规模','教育资源投入','在地国际化水平'];
let db, mapData, structureYear = null, structureMonth = null, mapYear = null, mapMonth = null, wordYear = null, wordMonth = null, latestYear = null, latestMonth = null, mapType = '总体', province = '全部', structureMode = 'stage', networkYear = null, networkMonth = null;
let structureChart, trendCharts = {}, trendTimers = [], trendPhase = 0;
let activeDistrictKey = null;
let mapSearchQuery = '', networkSearchQuery = '', mapSearchIds = null;
let yearPopover = null, activeYearTrigger = null;
let metricPopover = null, activeMetricTrigger = null;
const matchesPeriod = (item, year, month) => (!year || item.year === year) && (!month || item.month === month);
const periodName = (year, month) => year ? `${year}年${month ? `${month}月` : '全年'}` : '全期';

function showTooltip(text, event) {
  const t = $('#tooltip'); t.textContent = text; t.classList.remove('hidden');
  t.style.left = Math.min(event.clientX + 14, innerWidth - 225) + 'px';
  t.style.top = Math.min(event.clientY + 12, innerHeight - 65) + 'px';
}
function hideTooltip() { $('#tooltip').classList.add('hidden'); }
let visibilityFrame=0;
function updateDragVisibility(){
  const fit=(container,items)=>{
    const bounds=container.getBoundingClientRect(),inset=3;
    for(const el of items){
      const r=el.getBoundingClientRect();
      el.classList.toggle('edge-hidden',r.left<bounds.left+inset||r.right>bounds.right-inset||r.top<bounds.top+inset||r.bottom>bounds.bottom-inset);
    }
  };
  fit($('.map-canvas'),$$('.map-world .map-label,.map-landmark'));
  fit($('.network-body'),$('.panel-network').classList.contains('panel-expanded')?$$('.network-label'):$$('.network-label,.network-node'));
}
function scheduleDragVisibility(){if(visibilityFrame)return;visibilityFrame=requestAnimationFrame(()=>{visibilityFrame=0;updateDragVisibility();});}
function openDrawer(eyebrow, title, content) {
  $('#drawerEyebrow').textContent = eyebrow; $('#drawerTitle').textContent = title;
  $('#drawerContent').innerHTML = content;
  $('#drawerBackdrop').classList.remove('hidden'); $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  $('#drawerContent').scrollTop = 0;
}
function closeDrawer() {
  $('#drawerBackdrop').classList.add('hidden'); $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true'); document.body.style.overflow = $('.panel-expanded')?'hidden':'';
}
function openExplorer(kind) {
  closeYearPopover();closeMetricPopover();
  const panel=kind==='map'?$('.panel-map'):$('.panel-network');
  panel.classList.add('panel-expanded');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  $('#explorerBackdrop').classList.remove('hidden');document.body.style.overflow='hidden';
  if(kind==='map'){renderMap();updateMapScale();}
  else{const zoom=$('#networkZoom');zoom.dataset.compactValue=zoom.value;zoom.max='320';zoom.value='100';zoom.dispatchEvent(new Event('input'));renderNetwork();}
  panel.querySelector('.explorer-close').focus();
}
function closeExplorer() {
  const panel=$('.panel-expanded');if(!panel)return;
  const kind=panel.classList.contains('panel-map')?'map':'network';
  panel.classList.remove('panel-expanded');panel.removeAttribute('role');panel.removeAttribute('aria-modal');
  $('#explorerBackdrop').classList.add('hidden');
  if(kind==='map'){mapSearchQuery='';$('#mapSearch').value='';renderMap();updateMapScale();}
  else{networkSearchQuery='';$('#networkSearch').value='';const zoom=$('#networkZoom');zoom.max='180';zoom.value=zoom.dataset.compactValue||'120';zoom.dispatchEvent(new Event('input'));renderNetwork();}
  document.body.style.overflow=$('#drawer').classList.contains('open')?'hidden':'';
  $(`#${kind}Details`).focus();
}
function closeYearPopover(){
  if(yearPopover){yearPopover.classList.remove('open');yearPopover.remove();yearPopover=null;}
  if(activeYearTrigger){activeYearTrigger.classList.remove('open');activeYearTrigger.setAttribute('aria-expanded','false');activeYearTrigger=null;}
}
function closeMetricPopover(){
  if(metricPopover){metricPopover.remove();metricPopover=null;}
  if(activeMetricTrigger){activeMetricTrigger.classList.remove('open');activeMetricTrigger.setAttribute('aria-expanded','false');activeMetricTrigger=null;}
}
function enhanceYearSelectors(){
  for(const id of ['wordYear','latestYear','structureYear','mapYear','networkYear']){
    const select=$(`#${id}`);select.classList.add('year-native');
    const trigger=document.createElement('button');trigger.type='button';trigger.className='year-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',select.getAttribute('aria-label'));
    trigger.innerHTML='<span class="year-trigger-icon">▦</span><span class="year-trigger-value"></span><span class="year-trigger-arrow">⌄</span>';
    select.insertAdjacentElement('afterend',trigger);
    const sync=()=>{trigger.querySelector('.year-trigger-value').textContent=select.selectedOptions[0]?.textContent||'选择年份';};sync();select.addEventListener('change',sync);
    trigger.addEventListener('click',e=>{
      e.stopPropagation();if(activeYearTrigger===trigger){closeYearPopover();return;}closeYearPopover();
      const options=[...select.options];yearPopover=document.createElement('div');yearPopover.className='year-popover';yearPopover.setAttribute('role','listbox');yearPopover.setAttribute('aria-label',select.getAttribute('aria-label'));
      yearPopover.innerHTML=`<div class="year-popover-title"><span>选择年份</span><small>${id==='wordYear'?'协同热点':'独立筛选'}</small></div><div class="year-popover-grid">${options.map(o=>`<button type="button" role="option" data-year-value="${esc(o.value)}" aria-selected="${o.value===select.value}">${esc(o.textContent)}</button>`).join('')}</div>`;
      document.body.appendChild(yearPopover);activeYearTrigger=trigger;trigger.classList.add('open');trigger.setAttribute('aria-expanded','true');
      const r=trigger.getBoundingClientRect();const w=240,h=yearPopover.offsetHeight;yearPopover.style.left=Math.max(12,Math.min(innerWidth-w-12,r.right-w))+'px';yearPopover.style.top=(r.bottom+h+8>innerHeight?Math.max(12,r.top-h-8):r.bottom+8)+'px';
      requestAnimationFrame(()=>yearPopover?.classList.add('open'));
      yearPopover.addEventListener('click',event=>{const b=event.target.closest('[data-year-value]');if(!b)return;select.value=b.dataset.yearValue;select.dispatchEvent(new Event('change',{bubbles:true}));closeYearPopover();});
    });
  }
  document.addEventListener('pointerdown',e=>{if(yearPopover&&!yearPopover.contains(e.target)&&!activeYearTrigger?.contains(e.target))closeYearPopover();});
  document.addEventListener('pointerdown',e=>{if(metricPopover&&!metricPopover.contains(e.target)&&!activeMetricTrigger?.contains(e.target))closeMetricPopover();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeYearPopover();closeMetricPopover();}});
}
function storyList(items, limit = 35) {
  const seen = new Set();
  const valid = items.filter(n => {
    if (!n || !validUrl(n.url) || seen.has(n.id)) return false;
    seen.add(n.id); return true;
  }).slice(0, limit);
  if (!valid.length) return '<div class="empty-state">当前记录没有可展示的原站新闻链接。</div>';
  return valid.map(n => `<div class="story"><a href="${esc(validUrl(n.url))}" target="_blank" rel="noopener noreferrer">${esc(n.title)} ↗</a><small>${esc(n.date || String(n.year || '日期未详'))} · ${esc(n.source || '原站')} · ${esc(n.id)}</small>${n.summary ? `<p>${esc(n.summary)}</p>` : ''}</div>`).join('');
}
function newsFromEvents(events) {
  const ids = new Set(events.flatMap(e => e.newsIds));
  return db.news.filter(n => ids.has(n.id)).sort((a,b) => (b.date||'').localeCompare(a.date||''));
}
function wordEventList(items) {
  const groups=new Map();
  for(const news of items){
    const id=news.eventId||news.id;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(news);
  }
  if(!groups.size)return '<div class="empty-state">当前关键词暂无可核实的关联事件。</div>';
  return [...groups].map(([id,reports])=>{
    const event=db.eventById[id],lead=reports[0],actors=event?.actors?.length?event.actors:lead.actors;
    const links=reports.filter(n=>validUrl(n.url)).map(n=>`<a href="${esc(validUrl(n.url))}" target="_blank" rel="noopener noreferrer">${esc(n.title)} ↗</a>`).join('');
    return `<article class="word-event"><strong>${esc(event?.summary||lead.summary||lead.title)}</strong><small>${esc(lead.date||String(lead.year||'日期未详'))} · ${esc((actors||[]).slice(0,5).join('、'))}</small><div class="word-event-links">${links||'<span>原站链接暂缺</span>'}</div></article>`;
  }).join('');
}
function placeMatches(query) {
  const q=query.replace(/\s/g,'');
  const short=s=>s.replace(/(省|市|区|县)$/,'');
  if(['雄安','雄安新区','河北雄安新区'].includes(q))return db.districts.filter(d=>d.province==='河北省'&&['雄县','安新县','容城县'].includes(d.name));
  const exact=db.districts.filter(d=>[d.province,d.city,d.name,d.province+d.city+d.name,d.city+d.name].some(s=>s&&(s===q||short(s)===q)));
  return exact.length?exact:db.districts.filter(d=>q.length>=2&&[d.province+d.city+d.name,d.city+d.name,d.name,d.city].some(s=>s&&s.includes(q)));
}
function resolveSearch(query, baseEvents) {
  const q=query.trim().replace(/\s+/g,'');
  if(!q)return {events:baseEvents,anchors:[],mode:'all'};
  const exactActors=[...new Set(baseEvents.flatMap(e=>e.actors))].filter(a=>a.replace(/\s/g,'')===q);
  const places=placeMatches(q);
  if(places.length){
    const ids=new Set(places.flatMap(d=>d.eventIds));
    const placeRegions=new Set(places.map(d=>d.province+'|'+(d.province==='河北省'?(d.city||d.name):d.name)));
    const anchors=[...new Set(baseEvents.flatMap(e=>e.actors))].filter(a=>placeRegions.has(db.actorRegions[a]));
    return {events:baseEvents.filter(e=>ids.has(e.id)),anchors,mode:'place'};
  }
  const actors=exactActors.length?exactActors:[...new Set(baseEvents.flatMap(e=>e.actors))].filter(a=>q.length>=2&&a.replace(/\s/g,'').includes(q));
  const actorSet=new Set(actors);
  return {events:baseEvents.filter(e=>e.actors.some(a=>actorSet.has(a))),anchors:actors,mode:'actor'};
}
function searchDetail(query, result, panel) {
  const anchorSet=new Set(result.anchors), counts=new Map();
  for(const event of result.events)for(const actor of new Set(event.actors))if(!anchorSet.has(actor))counts.set(actor,(counts.get(actor)||0)+1);
  const partners=[...counts].sort((a,b)=>b[1]-a[1]);
  const lead=result.mode==='place'?'按已定位的区县查找关联事件；共同出现的主体按所在地区归组。':'按报道中的主体名称查找关联事件和共同参与者。';
  openDrawer(panel+'搜索结果',query,`<p class="detail-lead">${lead}共同出现不等于直接签约，具体关系请查看新闻原文。</p><div class="stat-row"><span class="stat-pill"><strong>${fmt(result.events.length)}</strong>个关联事件</span><span class="stat-pill"><strong>${fmt(counts.size)}</strong>个关联主体</span></div><h3>合作伙伴 / 关联主体</h3><div class="partner-list">${partners.map(([name,count])=>`<button data-search-partner="${esc(name)}">${esc(name)} · ${count}</button>`).join('')||'<span class="empty-state">当前筛选下暂无关联主体</span>'}</div><h3>关联新闻</h3>${storyList(newsFromEvents(result.events),Infinity)}`);
  $('#drawerContent').querySelectorAll('[data-search-partner]').forEach(button=>button.addEventListener('click',()=>{
    const events=result.events.filter(e=>e.actors.includes(button.dataset.searchPartner));
    openDrawer('关联主体',button.dataset.searchPartner,`<div class="stat-row"><span class="stat-pill"><strong>${fmt(events.length)}</strong>个关联事件</span></div><h3>相关新闻</h3>${storyList(newsFromEvents(events),Infinity)}`);
  }));
}
function setupSearch(){
  const actors=[...new Set(db.events.flatMap(e=>e.actors))].filter(a=>a.length>=3&&a.length<=35);
  const places=[...new Set(db.districts.flatMap(d=>[d.province,d.city,d.name]).filter(Boolean))];
  $('#entitySearchOptions').innerHTML=[...places,...actors].map(x=>`<option value="${esc(x)}"></option>`).join('');
  const bind=(key,render,base)=>{
    const form=$(`#${key}SearchForm`),input=$(`#${key}Search`),clear=$(`#${key}SearchClear`);
    form.addEventListener('submit',event=>{
      event.preventDefault();const query=input.value.trim();
      if(key==='map')mapSearchQuery=query;else networkSearchQuery=query;
      render();if(query)searchDetail(query,resolveSearch(query,base()),key==='map'?'地图':'合作网络');
    });
    clear.addEventListener('click',()=>{input.value='';if(key==='map')mapSearchQuery='';else networkSearchQuery='';render();input.focus();});
  };
  bind('map',renderMap,()=>db.events.filter(e=>matchesPeriod(e,mapYear,mapMonth)&&(mapType==='总体'||e.type===mapType)));
  bind('network',renderNetwork,baseNetworkEvents);
}
function setupSelectors() {
  const years = [...Array(13)].map((_,i) => 2026-i);
  const options = '<option value="">全期</option>' + years.map(y => `<option value="${y}">${y} 年</option>`).join('');
  const monthOptions='<option value="">全年</option>'+[...Array(12)].map((_,i)=>`<option value="${i+1}">${i+1} 月</option>`).join('');
  const renderers={word:renderWordCloud,latest:renderTicker,structure:renderStructure,map:renderMap,network:renderNetwork};
  const update=(key)=>{
    const year=+($(`#${key}Year`).value)||null,month=+($(`#${key}Month`).value)||null;
    if(key==='word'){wordYear=year;wordMonth=month;}
    if(key==='latest'){latestYear=year;latestMonth=month;}
    if(key==='structure'){structureYear=year;structureMonth=month;}
    if(key==='map'){mapYear=year;mapMonth=month;}
    if(key==='network'){networkYear=year;networkMonth=month;}
    renderers[key]();
  };
  for(const key of Object.keys(renderers)){
    const year=$(`#${key}Year`),month=$(`#${key}Month`);
    year.innerHTML=options;month.innerHTML=monthOptions;month.disabled=true;
    year.addEventListener('change',()=>{if(!year.value)month.value='';month.disabled=!year.value;update(key);});
    month.addEventListener('change',()=>update(key));
  }
  enhanceYearSelectors();
  const globalYear=$('#globalYear'),globalMonth=$('#globalMonth');
  globalYear.innerHTML=options;globalMonth.innerHTML=monthOptions;globalMonth.disabled=true;
  const syncGlobal=()=>{
    if(!globalYear.value)globalMonth.value='';
    globalMonth.disabled=!globalYear.value;
    for(const key of Object.keys(renderers)){
      const year=$(`#${key}Year`),month=$(`#${key}Month`);
      year.value=globalYear.value;year.dispatchEvent(new Event('change',{bubbles:true}));
      month.value=globalMonth.value;month.dispatchEvent(new Event('change',{bubbles:true}));
    }
  };
  globalYear.addEventListener('change',syncGlobal);
  globalMonth.addEventListener('change',syncGlobal);
  let playbackPhase=0,hotMode='news',hotTransitionTimer=0,nextPlayback=Date.now()+9000,autoplayPaused=false;
  const hotPanels={cloud:$('#cloudPanel'),news:$('#latestPanel')},hotCard=$('.panel-hotspots');
  const setHotMode=mode=>{
    if(mode===hotMode)return;
    clearTimeout(hotTransitionTimer);
    for(const [key,panel] of Object.entries(hotPanels)){
      panel.classList.remove('hot-enter','hot-exit');
      panel.classList.toggle('hidden',key!==hotMode);
    }
    const outgoing=hotPanels[hotMode],incoming=hotPanels[mode];
    incoming.classList.remove('hidden');
    hotMode=mode;
    $$('[data-hot-tab]').forEach(button=>button.classList.toggle('active',button.dataset.hotTab===mode));
    if(mode==='cloud')requestAnimationFrame(renderWordCloud);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){outgoing.classList.add('hidden');return;}
    hotCard.classList.remove('hot-transition');void hotCard.offsetWidth;
    hotCard.classList.add('hot-transition');outgoing.classList.add('hot-exit');incoming.classList.add('hot-enter');
    hotTransitionTimer=setTimeout(()=>{
      outgoing.classList.add('hidden');outgoing.classList.remove('hot-exit');
      incoming.classList.remove('hot-enter');hotCard.classList.remove('hot-transition');
    },800);
  };
  const setStructureMode=mode=>{
    if(mode===structureMode)return;
    structureMode=mode;
    $$('[data-structure]').forEach(button=>button.classList.toggle('active',button.dataset.structure===structureMode));
    const content=$('.structure-content');content.classList.remove('structure-switching');void content.offsetWidth;
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)content.classList.add('structure-switching');
    renderStructure();
  };
  const setPlaybackPhase=phase=>{
    playbackPhase=phase;
    setHotMode(phase?'cloud':'news');
    setStructureMode(phase?'type':'stage');
  };
  for(const panel of [hotCard,$('.panel-structure')]){
    panel.addEventListener('pointerdown',()=>{autoplayPaused=true;});
    panel.addEventListener('keydown',event=>{if(['Enter',' ','ArrowDown','ArrowUp'].includes(event.key))autoplayPaused=true;});
  }
  $$('[data-hot-tab]').forEach(button=>button.addEventListener('click',()=>setHotMode(button.dataset.hotTab)));
  $$('[data-structure]').forEach(button=>button.addEventListener('click',()=>setStructureMode(button.dataset.structure)));
  setInterval(()=>{
    if(autoplayPaused)return;
    const paused=document.hidden||document.body.classList.contains('knowledge-open')||$('#drawer').classList.contains('open')||!!$('.panel-expanded')||['.panel-hotspots','.panel-structure'].some(selector=>{
      const panel=$(selector);return panel.matches(':hover')||panel.querySelector(':focus-visible');
    });
    if(paused){nextPlayback=Date.now()+9000;return;}
    if(Date.now()>=nextPlayback){setPlaybackPhase(1-playbackPhase);nextPlayback=Date.now()+9000;}
  },250);
  setupNetworkRegions();
  setupSearch();
  $('#mapTabs').innerHTML = ['总体',...TYPES].map(t => `<button data-map-type="${t}" class="${t==='总体'?'active':''}">${t}</button>`).join('');
  $('#mapTabs').addEventListener('click', e => {let b=e.target.closest('button[data-map-type]');if(!b)return;mapType=b.dataset.mapType;$$('[data-map-type]').forEach(x=>x.classList.toggle('active',x===b));renderMap();});
  $('#provinceSwitch').addEventListener('click', e => {let b=e.target.closest('button[data-province]');if(!b)return;province=b.dataset.province;$$('[data-province]').forEach(x=>x.classList.toggle('active',x===b));renderMap();});
  const mapCanvas=$('.map-canvas');
  mapCanvas.addEventListener('pointermove',event=>{
    for(const label of $$('.map-world .map-label,.map-landmark text')){
      const box=label.getBoundingClientRect();
      const close=event.clientX>=box.left-7&&event.clientX<=box.right+7&&event.clientY>=box.top-7&&event.clientY<=box.bottom+7;
      (label.closest('.map-landmark')||label).classList.toggle('hover-hidden',close);
    }
  });
  mapCanvas.addEventListener('pointerleave',()=>$$('.map-world .map-label,.map-landmark').forEach(label=>label.classList.remove('hover-hidden')));
  $('#mapDetails').addEventListener('click',()=>openExplorer('map'));
  $('#networkDetails').addEventListener('click',()=>openExplorer('network'));
  $$('.explorer-close').forEach(button=>button.addEventListener('click',closeExplorer));
  $('#explorerBackdrop').addEventListener('click',closeExplorer);
  const mapZoom=$('#mapZoom'),mapWorld=$('#mapWorld');
  const updateMapZoom=()=>{const factor=(+mapZoom.value/100).toFixed(2);mapWorld.style.setProperty('--map-zoom',factor);updateMapScale(+factor);$('#mapZoomValue').textContent=`${mapZoom.value}%`;scheduleDragVisibility();setTimeout(scheduleDragVisibility,240);};
  mapZoom.addEventListener('input',updateMapZoom);
  $('#mapZoomOut').addEventListener('click',()=>{mapZoom.value=String(Math.max(+mapZoom.min,+mapZoom.value-10));updateMapZoom();});
  $('#mapZoomIn').addEventListener('click',()=>{mapZoom.value=String(Math.min(+mapZoom.max,+mapZoom.value+10));updateMapZoom();});
  let mapDrag=null,mapPanX=0,mapPanY=0,suppressMapClick=false;
  mapWorld.addEventListener('pointerdown',e=>{
    if(e.button!==0||mapDrag)return;
    mapDrag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:mapPanX,startY:mapPanY,moved:false};
    (e.target.closest('.district,.map-landmark')||mapWorld).setPointerCapture(e.pointerId);
  });
  mapWorld.addEventListener('pointermove',e=>{
    if(!mapDrag||e.pointerId!==mapDrag.id)return;
    if(Math.hypot(e.clientX-mapDrag.x,e.clientY-mapDrag.y)>4)mapDrag.moved=true;
    if(!mapDrag.moved)return;
    e.preventDefault();mapWorld.classList.add('dragging');
    const limitX=Math.max(100,$('.map-canvas').clientWidth*.48),limitY=Math.max(100,$('.map-canvas').clientHeight*.48);
    mapPanX=Math.max(-limitX,Math.min(limitX,mapDrag.startX+e.clientX-mapDrag.x));
    mapPanY=Math.max(-limitY,Math.min(limitY,mapDrag.startY+e.clientY-mapDrag.y));
    mapWorld.style.setProperty('--map-pan-x',`${mapPanX}px`);mapWorld.style.setProperty('--map-pan-y',`${mapPanY}px`);scheduleDragVisibility();
  });
  const endMapDrag=e=>{if(!mapDrag||e.pointerId!==mapDrag.id)return;if(mapDrag.moved){suppressMapClick=true;setTimeout(()=>suppressMapClick=false,80);}mapDrag=null;mapWorld.classList.remove('dragging');};
  mapWorld.addEventListener('pointerup',endMapDrag);mapWorld.addEventListener('pointercancel',endMapDrag);
  mapWorld.addEventListener('click',e=>{if(suppressMapClick){e.stopPropagation();suppressMapClick=false;}},true);
  const zoom=$('#networkZoom');
  const updateZoom=()=>{$('#networkChart').style.setProperty('--network-zoom',(+zoom.value/100).toFixed(2));$('#networkZoomValue').textContent=`${zoom.value}%`;scheduleDragVisibility();setTimeout(scheduleDragVisibility,270);};
  zoom.addEventListener('input',updateZoom);
  $('#networkZoomOut').addEventListener('click',()=>{zoom.value=String(Math.max(+zoom.min,+zoom.value-10));updateZoom();});
  $('#networkZoomIn').addEventListener('click',()=>{zoom.value=String(Math.min(+zoom.max,+zoom.value+10));updateZoom();});
  const graph=$('#networkChart');let drag=null,panX=0,panY=0,suppressNodeClick=false;
  graph.addEventListener('pointerdown',e=>{
    if(e.button!==0||drag)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:panX,startY:panY,moved:false};
    (e.target.closest('.network-node')||graph).setPointerCapture(e.pointerId);
  });
  graph.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true;
    if(!drag.moved)return;
    e.preventDefault();graph.classList.add('dragging');
    const limitX=Math.max(210,graph.clientWidth*.65),limitY=Math.max(210,graph.clientHeight*.65);
    panX=Math.max(-limitX,Math.min(limitX,drag.startX+e.clientX-drag.x));
    panY=Math.max(-limitY,Math.min(limitY,drag.startY+e.clientY-drag.y));
    graph.style.setProperty('--pan-x',`${panX}px`);graph.style.setProperty('--pan-y',`${panY}px`);scheduleDragVisibility();
  });
  const endDrag=e=>{if(!drag||e.pointerId!==drag.id)return;if(drag.moved){suppressNodeClick=true;setTimeout(()=>suppressNodeClick=false,80);}drag=null;graph.classList.remove('dragging');};
  graph.addEventListener('pointerup',endDrag);graph.addEventListener('pointercancel',endDrag);
  graph.addEventListener('click',e=>{if(suppressNodeClick){e.stopPropagation();suppressNodeClick=false;}},true);
  $('#drawerClose').addEventListener('click',closeDrawer);$('#drawerBackdrop').addEventListener('click',closeDrawer);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#drawer').classList.contains('open'))closeDrawer();else closeExplorer();}});
  $$('.help').forEach(b=>{b.title=b.dataset.tip;b.addEventListener('click',()=>openDrawer('统计口径','指标说明',`<p class="detail-lead">${esc(b.dataset.tip)}</p>`));});
}

function renderWordCloud() {
  const words = wordMonth ? (db.wordRankMonthly[`${wordYear}-${String(wordMonth).padStart(2,'0')}`]||[])
    : wordYear ? (db.wordRank[String(wordYear)]||[]) : db.wordRankAll;
  const container=$('#wordCloud');
  const colors = ['#27e1ed','#ffbc33','#7ce9bd','#da85f6','#2daaff','#f8b7e1','#42d9b8','#9ac8ff','#fe8e69','#71e0fb','#ffd176','#b48fff','#77eabe','#f59eca','#63c5ff'];
  const width=container.clientWidth||395,height=container.clientHeight||229,ctx=document.createElement('canvas').getContext('2d'),placed=[];
  const rendered=[];
  for(const [i,w] of words.entries()){
    const hash=actorHash(w.word),vertical=i>7&&i%10===9;
    const rotation=vertical?-90:(i===0?0:[-9,6,-5,8,-7,4,1][hash%7]);
    let fit=null,size=i<10?Math.max(19,27-i*.75):Math.max(10.5,15.5-(i-10)*.13);
    for(let shrink=0;shrink<5&&!fit;shrink++,size-=1){
      ctx.font=`800 ${size}px "Noto Sans SC",sans-serif`;
      const tw=ctx.measureText(w.word).width+7,th=size*1.18+3,radAngle=Math.abs(rotation)*Math.PI/180;
      const bw=tw*Math.cos(radAngle)+th*Math.sin(radAngle),bh=tw*Math.sin(radAngle)+th*Math.cos(radAngle);
      for(let k=0;k<1200;k++){
        const angle=(k+i*53)*2.39996+(hash%100)/170,rad=5.2*Math.sqrt(k);
        const x=width/2+Math.cos(angle)*rad*(1+.09*Math.sin(k*.27+i))-bw/2,y=height/2+Math.sin(angle)*rad*(.86+.07*Math.cos(k*.18+i))-bh/2;
        if(x<3||y<3||x+bw>width-3||y+bh>height-3)continue;
        if(placed.some(p=>x<p.x+p.w+1.5&&x+bw+1.5>p.x&&y<p.y+p.h+1.5&&y+bh+1.5>p.y))continue;
        fit={x,y,w:bw,h:bh,left:x+(bw-tw)/2,top:y+(bh-th)/2};break;
      }
    }
    if(fit){placed.push(fit);rendered.push(`<button class="cloud-word" data-word="${esc(w.word)}" title="${esc(w.word)} · ${wordYear&&!wordMonth&&i<10?`Excel年度关键词第 ${i+1} 位 · `:''}原文出现约 ${fmt(w.count)} 次 · 涉及 ${fmt(w.newsIds?.length||0)} 篇新闻" style="left:${fit.left.toFixed(1)}px;top:${fit.top.toFixed(1)}px;font-size:${size.toFixed(1)}px;color:${colors[i%colors.length]};--word-rotation:${rotation}deg">${esc(w.word)}</button>`);}
  }
  container.innerHTML = rendered.join('') || '<div class="empty-state">当前时段暂无可统计的关键词</div>';
  container.onclick=e=>{const b=e.target.closest('[data-word]');if(!b)return;const w=b.dataset.word,entry=words.find(x=>x.word===w),ids=new Set(entry?.newsIds||[]);
    const list=db.news.filter(n=>ids.has(n.id)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const eventCount=new Set(list.map(n=>n.eventId||n.id)).size;
    openDrawer('时段关键词',`${periodName(wordYear,wordMonth)} · ${w}`,`<p class="detail-lead">按新闻原文中的关键词匹配关联事件。月度仅包含已核实发布日期的报道。</p><div class="stat-row"><span class="stat-pill"><strong>${fmt(entry?.count)}</strong>原文词次</span><span class="stat-pill"><strong>${fmt(list.length)}</strong>篇关联报道</span><span class="stat-pill"><strong>${fmt(eventCount)}</strong>个去重事件</span></div><h3>关联协同事件</h3>${wordEventList(list)}`);
  };
}
function renderTicker() {
  const regional = n => /京津冀|京津|京冀|津冀|北京.*天津|北京.*河北|天津.*河北|雄安.*北京|北京.*雄安|天津.*雄安/.test(n.title+' '+n.summary);
  const latest = db.news.filter(n=>matchesPeriod(n,latestYear,latestMonth)&&n.month&&validUrl(n.url)&&regional(n)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20);
  const items = latest.map(n=>`<a class="ticker-item" target="_blank" rel="noopener noreferrer" href="${esc(validUrl(n.url))}"><span>${esc(n.date)} · ${esc(n.source || '原站')}</span>${esc(n.title)}</a>`).join('');
  $('#newsTicker').innerHTML = items ? items + items : '<div class="empty-state">当前时段暂无有发布日期的报道</div>';
}
function renderStructure() {
  const data={};for(const n of db.news.filter(n=>matchesPeriod(n,structureYear,structureMonth))){const label=n[structureMode==='stage'?'stage':'type'];data[label]=(data[label]||0)+1;}
  const labels=structureMode==='stage'?STAGES:TYPES,colors=structureMode==='stage'?STAGE_COLORS:TYPE_COLORS;
  const total=labels.reduce((s,x)=>s+(data[x]||0),0);
  const content=$('.structure-content');content.classList.toggle('bar-mode',structureMode==='type');
  $('#structureLegend').innerHTML=structureMode==='stage'?labels.map((name,i)=>`<button class="legend-item" data-category="${esc(name)}"><span class="legend-name"><i class="legend-dot" style="background:${colors[i]};color:${colors[i]}"></i>${esc(name)}</span><b>${total?((data[name]||0)*100/total).toFixed(1):'0.0'}%</b></button>`).join(''):'';
  structureChart.clear();structureChart.resize();
  if(structureMode==='stage'){
    const highlights=['#72d1ff','#ffd775','#72ebd1','#e5b5ff','#c7e0ff'];
    const shadows=['#0b4ba5','#aa5b0d','#0b7c70','#68358d','#365b85'];
    structureChart.setOption({animationDuration:750,animationEasing:'cubicOut',series:[{type:'pie',radius:'82%',center:['50%','50%'],stillShowZeroSum:false,label:{show:false},emphasis:{scale:true,scaleSize:5,itemStyle:{shadowBlur:12,shadowColor:'#79dfff77'}},data:labels.map((name,i)=>({name,value:data[name]||0,itemStyle:{color:new echarts.graphic.RadialGradient(.28,.22,1,[{offset:0,color:highlights[i]},{offset:.48,color:colors[i]},{offset:1,color:shadows[i]}]),borderColor:'#082c50',borderWidth:2}}))}]});
  }
  else structureChart.setOption({animationDuration:650,grid:{left:99,right:43,top:5,bottom:5},xAxis:{type:'value',max:100,show:false},yAxis:{type:'category',inverse:true,data:labels,axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#dcefff',fontSize:11}},series:[{type:'bar',barWidth:14,data:labels.map((name,i)=>({name,value:total?(data[name]||0)*100/total:0,itemStyle:{color:colors[i],borderRadius:[0,4,4,0]}})),label:{show:true,position:'right',color:'#e9faff',fontSize:11,formatter:p=>`${p.value.toFixed(1)}%`}}]});
  $('#structureLegend').onclick=e=>{const b=e.target.closest('[data-category]');if(b)openCategory(b.dataset.category);};
}
function openCategory(category) {
  const list=db.news.filter(n=>matchesPeriod(n,structureYear,structureMonth)&&n[structureMode==='stage'?'stage':'type']===category);
  openDrawer('协同结构',category,`<p class="detail-lead">当前范围：${periodName(structureYear,structureMonth)}。月度仅含已核实发布日期的报道。</p><div class="stat-row"><span class="stat-pill"><strong>${fmt(list.length)}</strong>篇新闻</span></div><h3>相关新闻</h3>${storyList(list,60)}`);
}

function mapEventIds(district) {
  return district.eventIds.filter(id=>{const e=db.eventById[id];return e&&matchesPeriod(e,mapYear,mapMonth)&&(mapType==='总体'||e.type===mapType)&&(!mapSearchIds||mapSearchIds.has(id));});
}
function districtMatch(shape) {
  return db.districts.find(d=>d.province===shape.province&&d.name===shape.name&&(!shape.city||!d.city||d.city===shape.city||['定州市','辛集市'].includes(shape.name)))
    || (shape.city==='邢台市'&&shape.name==='襄都区' ? db.districts.find(d=>d.province==='河北省'&&d.city==='邢台市'&&d.name==='桥东区') : null);
}
function mapColor(v) {return v===0?'#0c427a':v<10?'#1768bc':v<30?'#35a1f0':v<70?'#6bd7ff':'#50c3b0';}
function updateMapScale(factor=+$('#mapZoom').value/100){
  const [west,south,east,north]=mapData.bounds,latitude=(south+north)/2;
  const mapUnitsPerDegree=Math.min(800/(east-west),560/(north-south));
  const mapUnitsFor200km=200/(111.32*Math.cos(latitude*Math.PI/180))*mapUnitsPerDegree;
  const canvas=$('.map-canvas'),pixelsPerUnit=Math.min(canvas.clientWidth/820,canvas.clientHeight/590);
  $('.map-scale').style.width=`${Math.round(mapUnitsFor200km*pixelsPerUnit*factor)}px`;
}
function renderMap() {
  mapSearchIds=mapSearchQuery?new Set(resolveSearch(mapSearchQuery,db.events.filter(e=>matchesPeriod(e,mapYear,mapMonth)&&(mapType==='总体'||e.type===mapType))).events.map(e=>e.id)):null;
  const svg=$('#districtMap');svg.innerHTML='';
  const NS='http://www.w3.org/2000/svg';
  const landmarks={tongzhou:[],xiongan:[]};
  for(const shape of mapData.districts) {
    const district=districtMatch(shape), count=district?mapEventIds(district).length:0;
    const landmark=shape.province==='北京市'&&shape.name==='通州区'?'tongzhou':shape.province==='河北省'&&['雄县','安新县','容城县'].includes(shape.name)?'xiongan':null;
    const p=document.createElementNS(NS,'path');p.setAttribute('d',shape.path);p.setAttribute('fill',mapColor(count));p.setAttribute('class','district'+(landmark?' landmark-area '+landmark:'')+((province!=='全部'&&province!==shape.province)||(mapSearchIds&&!count)?' dimmed':''));p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label',`${shape.province}${shape.name}，${count}个协同事件`);
    p.addEventListener('mousemove',e=>showTooltip(`${shape.province}${shape.name} · ${count} 个去重事件`,e));p.addEventListener('mouseleave',hideTooltip);
    p.addEventListener('click',()=>openDistrict(district,shape));p.addEventListener('keydown',e=>{if(e.key==='Enter')openDistrict(district,shape);});svg.appendChild(p);
    if(landmark)landmarks[landmark].push({path:p,district,shape});
  }
  for(const [key,parts] of Object.entries(landmarks)){
    if(!parts.length)continue;
    const boxes=parts.map(x=>x.path.getBBox()),x=boxes.reduce((s,b)=>s+b.x+b.width/2,0)/boxes.length,y=boxes.reduce((s,b)=>s+b.y+b.height/2,0)/boxes.length;
    const g=document.createElementNS(NS,'g'),name=key==='tongzhou'?'通州':'雄安';
    g.setAttribute('class',`map-landmark ${key}${province!=='全部'&&province!==(key==='tongzhou'?'北京市':'河北省')?' dimmed':''}`);
    g.setAttribute('transform',`translate(${x.toFixed(1)} ${y.toFixed(1)})`);g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-label',`查看${name}协同事件`);
    g.innerHTML=`<circle class="landmark-halo" r="28"/><circle class="landmark-pin" r="17"/><circle class="landmark-dot" r="6"/><rect class="landmark-badge" x="25" y="-23" width="72" height="46" rx="5"/><text x="61" y="8" text-anchor="middle">${name}</text>`;
    const open=()=>openLandmark(name,parts);
    g.addEventListener('click',open);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
    svg.appendChild(g);
  }
  renderMapExplorer();
  scheduleDragVisibility();
}
function openLandmark(name,parts){
  const ids=new Set(parts.flatMap(x=>x.district?mapEventIds(x.district):[]));
  const events=[...ids].map(id=>db.eventById[id]).filter(Boolean);
  openDrawer('重点区域协同事件',name,`<p class="detail-lead">${name==='雄安'?'雄县、安新县、容城县':'北京市通州区'}参与的去重事件；三县涉及同一事件时只计一次。当前范围：${periodName(mapYear,mapMonth)} · ${mapType}。</p><div class="stat-row"><span class="stat-pill"><strong>${fmt(ids.size)}</strong>个去重事件</span></div><h3>关联新闻</h3>${storyList(newsFromEvents(events),80)}`);
}
function openDistrict(district,shape) {
  activeDistrictKey=district?.key||null;
  const ids=district?mapEventIds(district):[], events=ids.map(id=>db.eventById[id]).filter(Boolean);
  openDrawer('区县协同事件',`${shape.province}${shape.name}`,`<p class="detail-lead">同一去重事件在本区县只计一次。当前范围：${periodName(mapYear,mapMonth)} · ${mapType}。</p><div class="stat-row"><span class="stat-pill"><strong>${fmt(ids.length)}</strong>个去重事件</span><span class="stat-pill"><strong>${fmt(newsFromEvents(events).length)}</strong>篇关联新闻</span></div><h3>关联新闻</h3>${storyList(newsFromEvents(events),80)}`);
}
function renderMapExplorer() {
  if(!$('.panel-map').classList.contains('panel-expanded'))return;
  const ranked=db.districts.filter(d=>province==='全部'||d.province===province).map(d=>({district:d,ids:mapEventIds(d)})).sort((a,b)=>b.ids.length-a.ids.length);
  const eventIds=new Set(ranked.flatMap(x=>x.ids));
  $('#mapExplorerInfo').innerHTML=`<h3>区县活跃度明细</h3><p>${periodName(mapYear,mapMonth)} · ${mapType}。点击区县查看关联新闻。</p><div class="explorer-stats"><span><b>${fmt(eventIds.size)}</b>去重事件</span><span><b>${fmt(ranked.length)}</b>个区县</span></div><div class="explorer-list">${ranked.map(({district,ids})=>`<button type="button" data-district-key="${esc(district.key)}"><span>${esc(district.province+district.city+district.name)}</span><b>${fmt(ids.length)} 件</b></button>`).join('')}</div>`;
  $('#mapExplorerInfo').onclick=e=>{const button=e.target.closest('[data-district-key]');if(!button)return;const district=db.districts.find(d=>d.key===button.dataset.districtKey);if(!district)return;openDistrict(district,{province:district.province,name:district.name});};
}

function actorKind(name) {
  if(/教育局|教委|教育厅|人民政府|管委会|政府/.test(name))return '政府部门';
  if(/有限公司|集团|企业|公司|股份/.test(name))return '企业';
  if(/研究院|研究所|科学院|科研院|智库/.test(name))return '科研机构';
  if(/职业/.test(name)&&/学校|学院|大学/.test(name))return '职业院校';
  if(/中学|小学|幼儿园|学校|教育集团/.test(name)&&!/大学|学院/.test(name))return '中小学';
  if(/大学|学院|高等专科学校/.test(name))return '高校';return '其他';
}
function setupNetworkRegions(){
  xionganActors=new Set(db.xionganActors||[]);
  const options=['北京','天津','河北','雄安','通州'].map(name=>`<option value="${name}">${name}</option>`).join('');
  $('#networkRegionA').innerHTML='<option value="">左侧地区</option>'+options;
  $('#networkRegionB').innerHTML='<option value="">右侧地区</option>'+options;
  $('#networkRegionA').addEventListener('change',renderNetwork);
  $('#networkRegionB').addEventListener('change',renderNetwork);
  $('#networkPairList').addEventListener('click',openRegionPairs);
}
let xionganActors=new Set();
function actorInRegion(name,region){
  const location=db.actorRegions[name]||'';
  if(region==='雄安')return xionganActors.has(name);
  if(region==='通州')return location==='北京市|通州区';
  return location.startsWith(({'北京':'北京市','天津':'天津市','河北':'河北省'}[region]||'\u0000')+'|');
}
function actorOnSide(name,region,opposite){
  if(region==='北京'&&opposite==='通州')return actorInRegion(name,'北京')&&!actorInRegion(name,'通州');
  if(region==='河北'&&opposite==='雄安')return actorInRegion(name,'河北')&&!actorInRegion(name,'雄安');
  return actorInRegion(name,region);
}
function sideActors(event,region,opposite){
  return [...new Set(event.actors)].filter(name=>actorOnSide(name,region,opposite));
}
function baseNetworkEvents(){
  const left=$('#networkRegionA').value,right=$('#networkRegionB').value;
  return db.events.filter(e=>{
    if(!matchesPeriod(e,networkYear,networkMonth))return false;
    if(!left&&!right)return true;
    if(left&&right){
      const a=sideActors(e,left,right),b=sideActors(e,right,left);
      return left===right?a.length>=2:a.some(x=>b.some(y=>x!==y));
    }
    return e.actors.some(a=>actorInRegion(a,left||right));
  });
}
function networkEvents(){
  const events=baseNetworkEvents();
  return networkSearchQuery&&!$('.panel-network').classList.contains('panel-expanded')?resolveSearch(networkSearchQuery,events).events:events;
}
function openRegionPairs(){
  const left=$('#networkRegionA').value,right=$('#networkRegionB').value;
  if(!left||!right)return;
  const pairs=new Map();
  for(const e of networkEvents()){
    const a=sideActors(e,left,right),b=sideActors(e,right,left);
    for(const x of a)for(const y of b){if(x===y)continue;const key=left===right?[x,y].sort().join('|'):`${x}|${y}`;if(!pairs.has(key))pairs.set(key,new Set());pairs.get(key).add(e.id);}
  }
  const list=[...pairs].sort((a,b)=>b[1].size-a[1].size);
  openDrawer('地区合作主体',`${left} × ${right}`,`<p class="detail-lead">当前范围：${periodName(networkYear,networkMonth)}。下列主体位于所选地区并共同出现在同一去重事件中；直接合作关系请核对原文。</p><div class="stat-row"><span class="stat-pill"><strong>${fmt(networkEvents().length)}</strong>个关联事件</span><span class="stat-pill"><strong>${fmt(list.length)}</strong>组主体</span></div><div class="partner-list">${list.map(([key,ids])=>{const [a,b]=key.split('|');return `<button data-pair-a="${esc(a)}" data-pair-b="${esc(b)}">${esc(a)} × ${esc(b)} · ${ids.size}</button>`;}).join('')||'<span class="empty-state">当前组合暂无已定位的共同主体</span>'}</div>`);
  $('#drawerContent').querySelectorAll('[data-pair-a]').forEach(b=>b.addEventListener('click',()=>openPair(b.dataset.pairA,b.dataset.pairB)));
}
function actorHash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function positionNetwork(nodes, edges){
  const n=nodes.length, centerX=174, centerY=252;
  const degree=nodes.map(()=>0);for(const [i,j] of edges){degree[i]++;degree[j]++;}
  nodes.forEach((node,i)=>{const h=actorHash(node.name),angle=i*2.39996+(h%100)/170,rad=25+116*Math.sqrt((i+.5)/n);node.x=centerX+Math.cos(angle)*rad;node.y=centerY+Math.sin(angle)*rad*1.45;node.vx=0;node.vy=0;});
  for(let step=0;step<350;step++){
    const fx=nodes.map(()=>0),fy=nodes.map(()=>0);
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      let dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y,dist=Math.max(12,Math.hypot(dx,dy));
      const rep=2400/(dist*dist),ux=dx/dist,uy=dy/dist;
      fx[i]-=ux*rep;fy[i]-=uy*rep;fx[j]+=ux*rep;fy[j]+=uy*rep;
    }
    for(const [i,j,count] of edges){
      const dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y,dist=Math.max(1,Math.hypot(dx,dy));
      const pull=(dist-94)*(.0032+Math.min(count,5)*.0005),ux=dx/dist,uy=dy/dist;
      fx[i]+=ux*pull;fy[i]+=uy*pull;fx[j]-=ux*pull;fy[j]-=uy*pull;
    }
    nodes.forEach((node,i)=>{
      const gravity=degree[i]===0 ? .04 : .027;
      fx[i]+=(centerX-node.x)*gravity;fy[i]+=(centerY-node.y)*gravity;
      if(node.x<36)fx[i]+=(36-node.x)*.09;else if(node.x>310)fx[i]-=(node.x-310)*.09;
      if(node.y<45)fy[i]+=(45-node.y)*.08;else if(node.y>473)fy[i]-=(node.y-473)*.08;
      node.vx=Math.max(-3,Math.min(3,(node.vx+fx[i])*.78));node.vy=Math.max(-3,Math.min(3,(node.vy+fy[i])*.78));
      node.x+=node.vx;node.y+=node.vy;
    });
  }
}
function networkLabels(nodes,preferred=[]){
  const placed=[];
  const ranked=[...nodes].sort((a,b)=>b.count-a.count);
  const order=[...new Set([...preferred.map(name=>nodes.find(n=>n.name===name)),nodes.find(n=>n.name===CUEB),...ranked.slice(0,17),...ranked.filter(n=>n.count<=2).sort((a,b)=>actorHash(a.name)-actorHash(b.name)).slice(0,4)])].filter(Boolean);
  for(const node of order){
    if(placed.length>=18)break;
    const labelLines=[node.name];
    const width=Math.min(205,node.name.length*10+7),height=16;
    if(node.name===CUEB){
      const right=node.x+node.radius+5,left=node.x-node.radius-5-width;
      const x=right+width<=313?right:Math.max(26,left);
      const y=Math.max(45,Math.min(475-height,node.y-height/2));
      node.label={x,y,w:width,h:height,tx:x===right?x:x+width,ty:y+12,anchor:x===right?'start':'end',lines:labelLines};
      placed.push(node.label);
      continue;
    }
    const clear=b=>b.x>=26&&b.x+b.w<=313&&b.y>=45&&b.y+b.h<=475
      &&!placed.some(p=>b.x<p.x+p.w+5&&b.x+b.w+5>p.x&&b.y<p.y+p.h+4&&b.y+b.h+4>p.y);
    const candidates=[];
    for(const gap of [4,9]){
      const r=node.radius+gap;
      candidates.push({x:node.x+r,y:node.y-height/2,w:width,h:height,tx:node.x+r,ty:node.y+4,anchor:'start'});
      candidates.push({x:node.x-r-width,y:node.y-height/2,w:width,h:height,tx:node.x-r,ty:node.y+4,anchor:'end'});
      candidates.push({x:node.x-width/2,y:node.y-r-height,w:width,h:height,tx:node.x,ty:node.y-r-3,anchor:'middle'});
      candidates.push({x:node.x-width/2,y:node.y+r,w:width,h:height,tx:node.x,ty:node.y+r+12,anchor:'middle'});
    }
    const box=candidates.find(clear);
    if(box){node.label={...box,lines:labelLines};placed.push(box);}
  }
}
function renderFullNetwork(events) {
  const left=$('#networkRegionA').value,right=$('#networkRegionB').value,paired=!!(left&&right);
  const actorCounts=new Map(),edgeCounts=new Map();
  for(const event of events){
    const actors=[...new Set(event.actors)].filter(name=>name&&(!paired||actorOnSide(name,left,right)||actorOnSide(name,right,left)));
    for(const name of actors)actorCounts.set(name,(actorCounts.get(name)||0)+1);
    for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
      const key=[actors[i],actors[j]].sort().join('|');edgeCounts.set(key,(edgeCounts.get(key)||0)+1);
    }
  }
  const ranked=[...actorCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-CN'));
  const maxCount=Math.max(1,...ranked.map(([,count])=>count));
  const nodes=ranked.map(([name,count],i)=>{
    const angle=i*2.39996323+(actorHash(name)%113)/170,rad=Math.sqrt((i+.5)/ranked.length);
    return {name,count,kind:actorKind(name),x:600+Math.cos(angle)*rad*515,y:350+Math.sin(angle)*rad*295,radius:2.7+6.2*Math.pow(count/maxCount,.75)};
  });
  const byName=new Map(nodes.map(node=>[node.name,node]));
  const matches=networkSearchQuery?new Set(resolveSearch(networkSearchQuery,events).anchors):new Set();
  const edges=[...edgeCounts].map(([key,count])=>{const [a,b]=key.split('|');return [byName.get(a),byName.get(b),count];}).filter(([a,b])=>a&&b);
  const labelNames=[...new Set([...matches,...ranked.slice(0,34).map(([name])=>name),...(actorCounts.has(CUEB)?[CUEB]:[])])].slice(0,50);
  const placed=[],labels=[];
  for(const name of labelNames){const node=byName.get(name);if(!node)continue;const w=Math.min(260,name.length*13+8),h=19;
    const choices=[{x:node.x+node.radius+5,anchor:'start',tx:node.x+node.radius+5},{x:node.x-node.radius-5-w,anchor:'end',tx:node.x-node.radius-5}];
    const box=choices.map(c=>({...c,y:node.y-h/2,w,h})).find(b=>b.x>20&&b.x+b.w<1180&&b.y>15&&b.y+b.h<685&&!placed.some(p=>b.x<p.x+p.w+8&&b.x+b.w+8>p.x&&b.y<p.y+p.h+5&&b.y+b.h+5>p.y));
    if(box){placed.push(box);labels.push({name,x:box.tx,y:box.y+14,anchor:box.anchor});}
  }
  const graph=$('#networkChart');graph.innerHTML=nodes.length?`<canvas class="network-canvas" width="1200" height="700" role="img" aria-label="全部 ${nodes.length} 个合作主体节点" data-node-count="${nodes.length}"></canvas>`:'<div class="network-empty">当前筛选范围没有合作主体</div>';
  if(nodes.length){
    const canvas=graph.querySelector('canvas'),ctx=canvas.getContext('2d');
    ctx.strokeStyle='rgba(53,183,231,.10)';ctx.lineWidth=.6;ctx.beginPath();
    for(const [a,b] of edges){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.stroke();
    for(const node of nodes){
      ctx.beginPath();ctx.arc(node.x,node.y,node.radius,0,Math.PI*2);ctx.fillStyle=ACTOR_COLORS[node.kind];ctx.fill();
      if(matches.has(node.name)){ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();}
    }
    ctx.font='600 14px "Noto Sans SC",sans-serif';ctx.textBaseline='alphabetic';ctx.lineWidth=3;ctx.strokeStyle='#031c38';ctx.fillStyle='#e5f4ff';
    for(const label of labels){ctx.textAlign=label.anchor;ctx.strokeText(label.name,label.x,label.y);ctx.fillText(label.name,label.x,label.y);}
    const grid=new Map();
    for(const node of nodes){const key=`${Math.floor(node.x/25)},${Math.floor(node.y/25)}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(node);}
    const hit=e=>{
      const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*1200/rect.width,y=(e.clientY-rect.top)*700/rect.height;
      const gx=Math.floor(x/25),gy=Math.floor(y/25);let nearest=null,dist=Infinity;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const node of grid.get(`${gx+dx},${gy+dy}`)||[]){
        const d=Math.hypot(x-node.x,y-node.y);if(d<Math.max(8,node.radius+3)&&d<dist){nearest=node;dist=d;}
      }
      return nearest;
    };
    graph.onclick=e=>{const node=hit(e);if(node)openActor(node.name);};
    graph.onmousemove=e=>{const node=hit(e);canvas.style.cursor=node?'pointer':'grab';if(node)showTooltip(`${node.name} · ${node.count} 个关联事件`,e);else hideTooltip();};
  }else{graph.onclick=null;graph.onmousemove=null;}
  graph.onkeydown=null;
  graph.onmouseleave=hideTooltip;
  $('#networkPairList').classList.toggle('hidden',!paired);
  $('#networkExplorerInfo').innerHTML=`<h3>全部合作主体</h3><p>${periodName(networkYear,networkMonth)}。全部主体已显示在图中；侧栏列出活跃主体，其余可在图上点击或搜索。</p><div class="explorer-stats"><span><b>${fmt(nodes.length)}</b>个主体节点</span><span><b>${fmt(events.length)}</b>个关联事件</span></div><div class="explorer-list">${ranked.slice(0,120).map(([name,count])=>`<button type="button" data-actor-name="${esc(name)}"><span>${esc(name)}</span><b>${fmt(count)} 件</b></button>`).join('')}</div>`;
  $('#networkExplorerInfo').onclick=e=>{const button=e.target.closest('[data-actor-name]');if(button)openActor(button.dataset.actorName);};
  scheduleDragVisibility();
}
function renderNetwork() {
  const events=networkEvents();
  if($('.panel-network').classList.contains('panel-expanded'))return renderFullNetwork(events);
  const graph=$('#networkChart');graph.onclick=null;graph.onkeydown=null;graph.onmousemove=null;graph.onmouseleave=null;
  const actorCounts=new Map(), partners=new Map();
  const searchAnchors=networkSearchQuery?resolveSearch(networkSearchQuery,baseNetworkEvents()).anchors:[];
  const left=$('#networkRegionA').value,right=$('#networkRegionB').value,paired=!!(left&&right);
  for(const e of events){const actors=[...new Set(e.actors)].filter(a=>a.length>=3&&a.length<=35&&(!paired||actorOnSide(a,left,right)||actorOnSide(a,right,left)));for(const a of actors){actorCounts.set(a,(actorCounts.get(a)||0)+1);if(!partners.has(a))partners.set(a,new Map());for(const b of actors)if(a!==b)partners.get(a).set(b,(partners.get(a).get(b)||0)+1);}}
  const ranked=[...actorCounts].filter(([name])=>paired||/大学|学院|学校|中学|小学|幼儿园|研究院|研究所|教育局|教委|教育厅|政府|有限公司|公司|集团|协会|联盟|科学院/.test(name)).sort((a,b)=>b[1]-a[1]);
  const sample=(arr,n)=>arr.sort((a,b)=>actorHash(a[0])-actorHash(b[0])).slice(0,n).map(x=>x[0]);
  const high=ranked.slice(0,15).map(x=>x[0]);
  const medium=sample(ranked.filter(([,count],i)=>i>=15&&count>=3),13);
  const low=sample(ranked.filter(([,count])=>count<=2),14);
  const cuePartners=[...(partners.get(CUEB)||new Map())].sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);
  let chosen=[...new Set([...high,...medium,...low,...(actorCounts.has(CUEB)?[CUEB,...cuePartners]:[])])].slice(0,48);
  if(paired){
    const sides=[[left,right],[right,left]].map(([region,opposite])=>ranked.filter(([name])=>actorOnSide(name,region,opposite)).map(([name])=>name));
    chosen=[...new Set(Array.from({length:Math.max(...sides.map(side=>side.length))},(_,i)=>sides.map(side=>side[i])).flat().filter(Boolean))].slice(0,48);
  }
  if(networkSearchQuery){
    const visibleAnchors=searchAnchors.filter(name=>actorCounts.has(name));
    chosen=[...new Set([...visibleAnchors.slice(0,8),...chosen])].slice(0,48);
  }
  const maxCount=Math.max(1,...chosen.map(name=>actorCounts.get(name)||0));
  const nodes=chosen.map(name=>{const count=actorCounts.get(name)||0;return {name,count,kind:actorKind(name),radius:count?4.5+11.5*Math.pow(count/maxCount,.85):5};});
  const chosenSet=new Set(chosen), edgeCount=new Map();
  for(const e of events){const actors=[...new Set(e.actors)].filter(a=>chosenSet.has(a));for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){const k=[actors[i],actors[j]].sort().join('|');edgeCount.set(k,(edgeCount.get(k)||0)+1);}}
  const edges=[...edgeCount].map(([key,count])=>{const [a,b]=key.split('|');return [chosen.indexOf(a),chosen.indexOf(b),count];});
  positionNetwork(nodes,edges);networkLabels(nodes,searchAnchors);
  const lines=edges.map(([i,j,count])=>`<line class="network-edge" x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" stroke-width="${Math.min(2.3,.45+Math.sqrt(count)*.35).toFixed(1)}"/>`).join('');
  const dots=nodes.map(node=>{const color=node.count?ACTOR_COLORS[node.kind]:'#657f96';return `<g class="network-node" role="button" tabindex="0" data-actor="${esc(node.name)}" style="--node-color:${color}"><circle class="node-core" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${node.radius.toFixed(1)}" fill="${color}"/><title>${esc(node.name)} · ${node.count} 个去重事件</title></g>`;}).join('');
  const labels=nodes.filter(n=>n.label).map(n=>`<text class="network-label ${n.name===CUEB?'cueb-label':''}" x="${n.label.tx.toFixed(1)}" y="${n.label.lines.length===2?(n.label.y+11).toFixed(1):n.label.ty.toFixed(1)}" text-anchor="${n.label.anchor}">${n.label.lines.map((line,i)=>`<tspan x="${n.label.tx.toFixed(1)}" dy="${i?12:0}">${esc(line)}</tspan>`).join('')}</text>`).join('');
  $('#networkChart').innerHTML=chosen.length?`<svg class="network-svg" viewBox="0 0 420 520" role="img" aria-label="主体合作关系网络">${lines}${dots}${labels}</svg>`:'<div class="network-empty">当前时段或地区组合暂无已定位的合作主体</div>';
  const accepted=[];
  const textNodes=[...$('#networkChart').querySelectorAll('.network-label')].sort((a,b)=>a.classList.contains('cueb-label')?-1:b.classList.contains('cueb-label')?1:0);
  for(const t of textNodes){const b=t.getBBox();if(accepted.some(p=>b.x<p.x+p.width+6&&b.x+b.width+6>p.x&&b.y<p.y+p.height+5&&b.y+b.height+5>p.y))t.style.display='none';else accepted.push(b);}
  $('#networkChart').querySelectorAll('.network-node').forEach(g=>{g.addEventListener('click',()=>openActor(g.dataset.actor));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openActor(g.dataset.actor);}});g.addEventListener('mousemove',e=>showTooltip(`${g.dataset.actor} · ${actorCounts.get(g.dataset.actor)||0} 个关联事件`,e));g.addEventListener('mouseleave',hideTooltip);});
  $('#networkPairList').classList.toggle('hidden',!paired);
  scheduleDragVisibility();
}
function openActor(name) {
  const events=networkEvents().filter(e=>e.actors.includes(name));
  const left=$('#networkRegionA').value,right=$('#networkRegionB').value;
  const fromLeft=left&&right&&actorOnSide(name,left,right);
  const other=left&&right?(fromLeft?right:left):null;
  const counts=new Map();for(const e of events)for(const a of new Set(e.actors))if(a!==name&&(!other||actorOnSide(a,other,fromLeft?left:right)))counts.set(a,(counts.get(a)||0)+1);
  const partnerButtons=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,24).map(([a,c])=>`<button data-partner="${esc(a)}">${esc(a)} · ${c}</button>`).join('');
  const content=`<p class="detail-lead">节点大小按本视图中关联的去重事件数缩放。下方伙伴为同一事件报道中共同出现的主体，是否构成直接合作以原文为准。</p><div class="stat-row"><span class="stat-pill"><strong>${fmt(events.length)}</strong>个去重事件</span><span class="stat-pill"><strong>${fmt(counts.size)}</strong>个共同参与主体</span></div><h3>共同参与主体</h3><div class="partner-list">${partnerButtons||'<span class="empty-state">该年份暂无可展示的伙伴</span>'}</div><h3>合作相关新闻</h3>${storyList(newsFromEvents(events),70)}`;
  openDrawer('合作网络 · '+actorKind(name),name,content);
  $('#drawerContent').querySelectorAll('[data-partner]').forEach(b=>b.addEventListener('click',()=>openPair(name,b.dataset.partner)));
}
function openPair(a,b) {
  const events=networkEvents().filter(e=>e.actors.includes(a)&&e.actors.includes(b));
  openDrawer('共同参与事件',`${a} × ${b}`,`<p class="detail-lead">两主体共同出现在以下${events.length}个去重事件的资料中；直接合作关系请查看原文。</p>${storyList(newsFromEvents(events),60)}`);
}

function annualSeries(metric) {
  if(metric==='activity')return Object.entries(db.newsCounts).map(([year,value])=>({year:+year,value:+value})).filter(x=>x.year>=2014).sort((a,b)=>a.year-b.year);
  if(metric==='synergy')return db.synergy.filter(x=>x.year>=2014).map(x=>({year:x.year,value:x.value}));
  return [...new Set(db.development.map(x=>x.year))].filter(y=>y>=2014).sort().map(year=>({year,value:db.development.filter(x=>x.year===year).reduce((s,x)=>s+x.score,0)/3}));
}
function trendOption(series, visible, metric) {
  const years=series.map(x=>String(x.year)),values=series.map((x,i)=>i<visible?x.value:null);
  const color=metric==='development'?'#55deff':'#1599ff';
  return {animationDuration:480,animationDurationUpdate:510,animationEasingUpdate:'cubicOut',grid:{left:24,right:22,top:14,bottom:19},xAxis:{type:'category',data:years,boundaryGap:false,axisLine:{lineStyle:{color:'#5d8fb6'}},axisTick:{show:false},axisLabel:{color:'#a5d1ed',fontSize:9,interval:1,showMaxLabel:true}},yAxis:{type:'value',scale:metric!=='development',min:metric==='development'?30:undefined,max:metric==='development'?90:undefined,splitNumber:3,axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#a5d1ed',fontSize:9,formatter:v=>Math.round(v)},splitLine:{lineStyle:{color:'#16527d',type:'dashed',opacity:.6}}},series:[{type:'line',data:values,smooth:.28,connectNulls:false,symbol:'circle',symbolSize:6,lineStyle:{color,width:2,shadowColor:color,shadowBlur:8},itemStyle:{color:'#a7faff',borderColor:'#0f91ff',borderWidth:2},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#138df266'},{offset:1,color:'#138df200'}])}}]};
}
function updateTrend(metric,series,visible) {
  const row=series[Math.max(0,visible-1)],prev=series[Math.max(0,visible-2)];if(!row)return;
  trendCharts[metric].setOption(trendOption(series,visible,metric));
  const value=metric==='activity'?fmt(row.value):metric==='synergy'?row.value.toFixed(2):row.value.toFixed(1);
  $(`#${metric}Value`).textContent=value;
  let delta=metric==='activity'?((row.value/prev.value-1)*100):row.value-prev.value;
  const unit=metric==='activity'?'%':' 分';
  const dec=1;
  const el=$(`#${metric}Change`);el.textContent=metric==='activity'&&row.year===2026?'当年未完':visible<2?'—':`${delta>=0?'↑':'↓'} ${Math.abs(delta).toFixed(dec)}${unit}`;el.classList.toggle('negative',delta<0);
  $(`#${metric}Year`).textContent=`${row.year} 年${row.year===2024&&metric==='synergy'?' · 含预测值':''}${row.year===2026&&metric==='activity'?' · 截至采集时':''}`;
}
function setupTrends() {
  const metric='activity',series=annualSeries(metric);
  trendCharts[metric]=echarts.init($(`#${metric}Chart`));updateTrend(metric,series,1);
  const paused=new Set();$$('.trend-card').forEach(card=>{card.addEventListener('mouseenter',()=>paused.add(card));card.addEventListener('mouseleave',()=>paused.delete(card));});
  const card=$(`.trend-card[data-metric="${metric}"]`);
  card.querySelector('.trend-detail').addEventListener('click',()=>openMetric(metric));
  const tickSynergy=setupIndexCarousel('synergy'),tickDevelopment=setupIndexCarousel('development');
  trendTimers.push(setInterval(()=>{
    if(paused.size||metricPopover||document.body.classList.contains('knowledge-open')||$('#drawer').classList.contains('open')||$('.panel-expanded'))return;
    trendPhase=(trendPhase+1)%series.length;
    updateTrend(metric,series,trendPhase+1);
    tickSynergy(trendPhase);tickDevelopment(trendPhase);
  },620));
  setTimeout(()=>Object.values(trendCharts).forEach(chart=>chart.resize()),200);
}
function indexRows(metric, dimension){
  if(metric==='synergy')return db.synergy.filter(x=>x.year>=2014).map(row=>({year:row.year,values:[dimension==='total'?row.value:row.dimensions[dimension]]}));
  const years=[...new Set(db.development.map(x=>x.year))].filter(y=>y>=2014).sort();
  return years.map(year=>{const regionRows=['北京','天津','河北'].map(region=>db.development.find(x=>x.year===year&&x.region===region));return {year,
    values:regionRows.map(row=>dimension==='total'?row.score:row.dimensionScores[dimension]),
    rawValues:regionRows.map(row=>dimension==='total'?row.value:row.dimensions[dimension])};});
}
function indexCarouselOption(metric,rows,visible){
  const isDevelopment=metric==='development';
  const colors=isDevelopment?['#39b9ff','#43d8c0','#ffbd56']:['#35aafa'];
  const names=isDevelopment?['北京','天津','河北']:['跨三地协同度'];
  return {animationDuration:330,animationDurationUpdate:440,animationEasingUpdate:'cubicOut',color:colors,
    grid:{left:24,right:22,top:13,bottom:19},tooltip:{trigger:'axis',formatter:params=>params[0]?.axisValue+' 年<br>'+params.filter(p=>p.value!=null).map(p=>`${p.marker}${p.seriesName}：${Number(p.value).toFixed(isDevelopment?1:2)} 分`).join('<br>')},
    xAxis:{type:'category',data:rows.map(x=>String(x.year)),boundaryGap:false,axisLine:{lineStyle:{color:'#5d8fb6'}},axisTick:{show:false},axisLabel:{color:'#a5d1ed',fontSize:9,interval:1,showMaxLabel:true}},
    yAxis:{type:'value',scale:!isDevelopment,min:isDevelopment?30:undefined,max:isDevelopment?90:undefined,splitNumber:3,axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#a5d1ed',fontSize:9,formatter:v=>Math.round(v)},splitLine:{lineStyle:{color:'#16527d',type:'dashed',opacity:.6}}},
    series:names.map((name,i)=>({name,type:'line',data:rows.map((r,j)=>j<visible?r.values[i]:null),smooth:.3,connectNulls:false,symbol:'circle',symbolSize:isDevelopment?4.5:5.5,lineStyle:{width:isDevelopment?2:2.5,shadowColor:colors[i],shadowBlur:7},itemStyle:{color:colors[i],borderColor:'#d5f9ff',borderWidth:1},areaStyle:isDevelopment?undefined:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#138df244'},{offset:1,color:'#138df200'}])}}))};
}
function setupIndexCarousel(metric){
  const names=['total',...DIMENSIONS],chart=echarts.init($(`#${metric}Chart`));trendCharts[metric]=chart;
  let nameIndex=0,rows=indexRows(metric,names[0]),step=1,lockedDimension=null;
  const pill=$(`#${metric}MetricLabel`);
  function draw(){
    const dimension=names[nameIndex],label=dimension==='total'?(metric==='synergy'?'综合协同度':'综合指数'):dimension;
    pill.innerHTML=`<span>${esc(label)}</span><span class="metric-caret">⌄</span>`;pill.title=`${label} · 点击选择指标`;
    pill.classList.toggle('locked',lockedDimension!==null);
    chart.setOption(indexCarouselOption(metric,rows,step));
    const row=rows[step-1],prev=rows[step-2],mean=v=>v.reduce((s,x)=>s+x,0)/v.length;
    const value=mean(row.values),previous=prev?mean(prev.values):null,delta=previous===null?null:value-previous;
    $(`#${metric}Value`).textContent=metric==='synergy'?value.toFixed(2):value.toFixed(1);
    const change=$(`#${metric}Change`);change.textContent=delta===null?'—':`${delta>=0?'↑':'↓'} ${Math.abs(delta).toFixed(metric==='synergy'?2:1)} 分`;change.classList.toggle('negative',delta!==null&&delta<0);
    $(`#${metric}Year`).textContent=`${row.year} 年${metric==='synergy'&&row.year===2024?' · 含预测值':''}`;
  }
  draw();
  pill.addEventListener('click',e=>{
    e.stopPropagation();if(activeMetricTrigger===pill){closeMetricPopover();return;}closeMetricPopover();closeYearPopover();
    metricPopover=document.createElement('div');metricPopover.className='year-popover metric-popover';metricPopover.setAttribute('role','listbox');metricPopover.setAttribute('aria-label',metric==='synergy'?'协同度指标':'教育发展指标');
    const options=names.map((name,i)=>[name,i===0?(metric==='synergy'?'综合协同度':'综合指数'):name]);
    metricPopover.innerHTML=`<div class="year-popover-title"><span>选择指标</span><small>再点已选项恢复轮播</small></div><div class="metric-popover-list">${options.map(([value,label])=>`<button type="button" role="option" data-metric-value="${esc(value)}" aria-selected="${value===lockedDimension}">${esc(label)}</button>`).join('')}</div>`;
    document.body.appendChild(metricPopover);activeMetricTrigger=pill;pill.classList.add('open');pill.setAttribute('aria-expanded','true');
    const r=pill.getBoundingClientRect(),w=246,h=metricPopover.offsetHeight;metricPopover.style.left=Math.max(12,Math.min(innerWidth-w-12,r.right-w))+'px';metricPopover.style.top=(r.bottom+h+8>innerHeight?Math.max(12,r.top-h-8):r.bottom+8)+'px';
    requestAnimationFrame(()=>metricPopover?.classList.add('open'));
    metricPopover.addEventListener('click',event=>{const b=event.target.closest('[data-metric-value]');if(!b)return;
      lockedDimension=b.dataset.metricValue===lockedDimension?null:b.dataset.metricValue;
      nameIndex=lockedDimension===null?0:names.indexOf(lockedDimension);rows=indexRows(metric,names[nameIndex]);step=Math.min(trendPhase+1,rows.length);chart.clear();draw();closeMetricPopover();
    });
  });
  return phase=>{
    if(phase===0){nameIndex=lockedDimension===null?(nameIndex+1)%names.length:names.indexOf(lockedDimension);rows=indexRows(metric,names[nameIndex]);chart.clear();}
    step=Math.min(phase+1,rows.length);
    draw();
  };
}
function drawDetailChart(element, years, series, unit='', scoreScale=false) {
  const tooltip=scoreScale?{trigger:'axis',formatter:params=>params[0]?.axisValue+' 年<br>'+params.filter(p=>p.value!=null).map(p=>`${p.marker}${p.seriesName}：${Number(p.value).toFixed(1)} 分`).join('<br>')}:{trigger:'axis',valueFormatter:v=>typeof v==='number'?`${v.toFixed(4)}${unit}`:'—'};
  const chart=echarts.init(element);chart.setOption({color:['#39b9ff','#44d6bd','#ffc063','#d58af8'],legend:{textStyle:{color:'#d3e8f7',fontSize:11},top:0},grid:{left:45,right:18,top:48,bottom:32},tooltip,xAxis:{type:'category',data:years,axisLabel:{color:'#a8c9da'},axisLine:{lineStyle:{color:'#386e91'}}},yAxis:{type:'value',scale:!scoreScale,min:scoreScale?30:undefined,max:scoreScale?90:undefined,axisLabel:{color:'#a8c9da'},splitLine:{lineStyle:{color:'#18537b'}}},series:series.map(s=>({name:s.name,type:'line',smooth:true,symbolSize:5,data:s.values,lineStyle:{width:2.5}}))});setTimeout(()=>chart.resize(),100);return chart;
}
function openMetric(metric) {
  if(metric==='activity')return openActivityMetric();if(metric==='synergy')return openSynergyMetric();return openDevelopmentMetric();
}
function openActivityMetric() {
  const years=annualSeries('activity').map(x=>x.year);
  const series=[{name:'纳入新闻',values:years.map(y=>db.newsCounts[y]||0)}];
  openDrawer('年度详情 · 新闻篇数','教育协同活跃度',`<p class="detail-lead">按纳入新闻篇数统计，与 9 月 26 日计算表格的“当年新闻总数”一致。</p><div id="detailMain" class="detail-chart"></div><table class="detail-table"><thead><tr><th>年份</th><th>纳入新闻（篇）</th></tr></thead><tbody>${years.map(y=>`<tr><td>${y}</td><td>${db.newsCounts[y]||0}</td></tr>`).join('')}</tbody></table>`);
  drawDetailChart($('#detailMain'),years.map(String),series,' 篇');
}
function openDevelopmentMetric() {
  const years=[...new Set(db.development.map(x=>x.year))].filter(y=>y>=2014).sort();
  const {yearRange:[start,end],targetRange:[low,high]}=db.meta.developmentScoreMapping;
  openDrawer('指标详情 · 三地对比','京津冀教育发展指数',`<p class="detail-lead">每项指标分别用${start}—${end}年三地原值的最小值与最大值线性映射到${low}—${high}分。折线及悬停信息均显示映射分值。</p><label>指标 <select id="developmentDimension" class="detail-select"><option value="total">综合指数</option>${DIMENSIONS.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><div id="detailMain" class="detail-chart"></div><div class="warning-note">展示区间参照协同度现有分值范围；首页数值为三地映射分值的等权均值。两项指数的含义和评价体系仍不同。</div>`);
  const draw=()=>{const dim=$('#developmentDimension').value;const series=['北京','天津','河北'].map(region=>({name:region,values:years.map(y=>{const row=db.development.find(x=>x.region===region&&x.year===y);return row?(dim==='total'?row.score:row.dimensionScores[dim]):null;}),rawValues:years.map(y=>{const row=db.development.find(x=>x.region===region&&x.year===y);return row?(dim==='total'?row.value:row.dimensions[dim]):null;})}));const node=$('#detailMain');echarts.getInstanceByDom(node)?.dispose();drawDetailChart(node,years.map(String),series,' 分',true);};
  $('#developmentDimension').addEventListener('change',draw);draw();
}
function openSynergyMetric() {
  const years=db.synergy.filter(x=>x.year>=2014).map(x=>x.year);
  openDrawer('指标详情 · 跨地协同度','京津冀区域协同度',`<p class="detail-lead">综合协同度与四个一级协同度都是跨三地计算的分值（0—100）。下方可选择一项基础指标，在同一图中比较三地的标准化原始值。</p><div id="synergyOverall" class="detail-chart"></div><h3>三地基础指标对比</h3><select id="synergyIndicator" class="detail-select"></select><div id="synergyRegional" class="detail-chart"></div><div class="warning-note">2024 年综合协同度使用了预测观测值。基础指标是三地各自的标准化值，不是各地独立的“协同度”。</div>`);
  drawDetailChart($('#synergyOverall'),years.map(String),[{name:'综合协同度',values:years.map(y=>db.synergy.find(x=>x.year===y)?.value)},...DIMENSIONS.map(name=>({name,values:years.map(y=>db.synergy.find(x=>x.year===y)?.dimensions[name])}))]);
  const indicators=[...new Set(db.synergyInputs.map(x=>x.indicator))].filter(Boolean);
  $('#synergyIndicator').innerHTML=indicators.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  const draw=()=>{const ind=$('#synergyIndicator').value;const series=[['北京','beijing'],['天津','tianjin'],['河北','hebei']].map(([name,key])=>({name,values:years.map(y=>db.synergyInputs.find(x=>x.year===y&&x.indicator===ind)?.[key]??null)}));const node=$('#synergyRegional');echarts.getInstanceByDom(node)?.dispose();drawDetailChart(node,years.map(String),series);};
  $('#synergyIndicator').addEventListener('change',draw);draw();
}

async function init() {
  try {
    [db,mapData]=await Promise.all([fetch('./data.json?v=20261001a').then(r=>r.json()),fetch('./map.json').then(r=>r.json())]);
    db.eventById=Object.fromEntries(db.events.map(e=>[e.id,e]));
    structureChart=echarts.init($('#structureChart'));
    setupSelectors();renderWordCloud();renderTicker();renderStructure();renderMap();renderNetwork();setupTrends();updateMapScale();
    structureChart.on('click',p=>openCategory(p.name));
    let resizeTimer;window.addEventListener('resize',()=>{structureChart.resize();Object.values(trendCharts).forEach(c=>c.resize());updateMapScale();scheduleDragVisibility();clearTimeout(resizeTimer);resizeTimer=setTimeout(renderWordCloud,120);});
  } catch (err) {
    console.error(err);document.querySelector('main').innerHTML=`<div class="panel" style="padding:30px;margin-top:30px">数据加载失败：${esc(err.message)}。请通过本地 HTTP 服务打开页面。</div>`;
  }
}
init();
