(() => {
  const $ = selector => document.querySelector(selector);
  const modal = $('#knowledgeBackdrop');
  const details = $('#knowledgeDetails');
  const colors = ['#3aa8ff', '#b987ff', '#ff7686', '#ffd66e', '#48e1d3'];
  let data, chart, orgById, eventById, eventsByOrg, orgsByEvent, partnersByOrg, rankedOrgs;
  let mode = 'organizations', focusedOrgId = null, selectedEventId = null, previousOverflow = '';
  const el = (tag, value, className) => {
    const node = document.createElement(tag);
    if (value != null) node.textContent = String(value);
    if (className) node.className = className;
    return node;
  };
  const nice = value => Number(value || 0).toLocaleString('zh-CN');
  const short = (value, size = 10) => value.length > size ? value.slice(0, size) + '…' : value;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const orgCategory = org => ({学校:0,其他机构:1,政府部门:2,企业:3})[org.org_type] ?? 1;
  const orgEvents = id => (eventsByOrg.get(id) || []).map(eventId => eventById.get(eventId)).filter(Boolean).sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
  const partners = id => (partnersByOrg.get(id) || []).sort((a,b) => b.count-a.count);

  function addButtonList(parent, title, rows, label, action, empty = '暂无记录') {
    parent.append(el('h4', title));
    const list = el('div', null, 'kg-list');
    if (!rows.length) list.append(el('div', empty, 'kg-empty'));
    for (const row of rows) {
      const button = el('button'); button.type = 'button';
      button.append(el('span', label(row)), el('small', row.meta || '›'));
      button.addEventListener('click', () => action(row)); list.append(button);
    }
    parent.append(list);
  }
  function metrics(rows) {
    const box = el('div', null, 'kg-metrics');
    for (const [value, name] of rows) {
      const item = el('span'); item.append(el('b', nice(value)), document.createTextNode(name)); box.append(item);
    }
    details.append(box);
  }
  function showOverview() {
    details.replaceChildren(el('h3', '知识图谱总览'), el('p', '图上先显示活跃机构及主要关系；搜索可定位全部机构。点击节点查看合作伙伴和关联事件。'));
    metrics([[data.organizations.length,'机构'],[data.events.length,'事件'],[data.participated_in.length,'参与关系'],[data.co_participated_with.length,'机构合作关系']]);
    addButtonList(details, '活跃机构', rankedOrgs.slice(0, 24), org => org.org_name, org => focusOrg(org.org_id));
  }
  function showOrganization() {
    const org = orgById.get(focusedOrgId);
    if (!org) return showOverview();
    const associated = orgEvents(org.org_id), linked = partners(org.org_id);
    details.replaceChildren(el('h3', org.org_name), el('span', org.org_type, 'kg-badge'));
    metrics([[org.news_count,'关联新闻'],[associated.length,'参与事件'],[linked.length,'合作关联主体']]);
    addButtonList(details, '合作关联主体', linked.map(item => ({...item, meta: `${item.count} 次` })), item => orgById.get(item.id)?.org_name || item.id, item => focusOrg(item.id));
    addButtonList(details, '参与事件', associated.map(item => ({...item, meta: item.date || '日期未核'})), item => item.title, item => showEvent(item.event_id));
  }
  function showEvent(eventId) {
    selectedEventId = eventId; mode = 'events';
    syncMode(); render();
  }
  function showEventDetails() {
    const event = eventById.get(selectedEventId);
    if (!event) return focusedOrgId ? showOrganization() : showOverview();
    details.replaceChildren(el('h3', event.title));
    for (const text of [event.date || '日期未核', event.main_category, event.region, event.source]) {
      if (text) details.append(el('span', text, 'kg-badge'));
    }
    if (event.summary) details.append(el('p', event.summary));
    if (/^https?:\/\//i.test(event.url || '')) {
      const link = el('a', '查看新闻原文 ↗'); link.href = event.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; details.append(link);
    }
    const participants = (orgsByEvent.get(eventId) || []).map(id => orgById.get(id)).filter(Boolean);
    addButtonList(details, '参与机构', participants, org => org.org_name, org => focusOrg(org.org_id));
  }
  function showDetails() {
    if (selectedEventId) showEventDetails();
    else if (focusedOrgId) showOrganization();
    else showOverview();
  }
  function focusOrg(id) {
    focusedOrgId = id; selectedEventId = null;
    $('#knowledgeSearch').value = orgById.get(id)?.org_name || '';
    render();
  }
  function syncMode() {
    document.querySelectorAll('[data-kg-mode]').forEach(button => button.classList.toggle('active', button.dataset.kgMode === mode));
  }
  function orgNode(org, label, selected = false) {
    const size = Math.min(46, 13 + Math.sqrt(Number(org.news_count) || 1) * 2.8);
    return { id:'org:' + org.org_id, name:org.org_name, kind:'organization', orgId:org.org_id,
      category:orgCategory(org), symbolSize:selected ? size + 4 : size,
      label:{show:label,formatter:short(org.org_name, 11)},
      itemStyle:{borderColor:selected?'#fff':'#a7eaff',borderWidth:selected?2.4:0.8,shadowBlur:selected?20:10,shadowColor:colors[orgCategory(org)]} };
  }
  function organizationGraph() {
    const ids = focusedOrgId
      ? [focusedOrgId, ...partners(focusedOrgId).slice(0, 38).map(item => item.id)]
      : rankedOrgs.slice(0, 40).map(org => org.org_id);
    const included = new Set(ids);
    const nodes = ids.map((id,index) => orgNode(orgById.get(id), index < 12, id === focusedOrgId));
    const edges = data.co_participated_with.filter(row => included.has(row.org_id_1) && included.has(row.org_id_2)
      && (focusedOrgId ? row.org_id_1 === focusedOrgId || row.org_id_2 === focusedOrgId : row.shared_event_count >= 3));
    return { nodes, links:edges.map(row => ({source:'org:'+row.org_id_1,target:'org:'+row.org_id_2,value:row.shared_event_count,
      lineStyle:{width:Math.min(3.8,0.5+Math.log2(row.shared_event_count+1)*0.65),opacity:focusedOrgId?.43:.24}})) };
  }
  function eventGraph() {
    let events = focusedOrgId ? orgEvents(focusedOrgId).slice(0, 28)
      : [...data.events].filter(event => event.date).sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0, 15);
    if (selectedEventId && !events.some(event => event.event_id === selectedEventId)) events = [eventById.get(selectedEventId), ...events].filter(Boolean).slice(0, 28);
    const counts = new Map();
    for (const event of events) for (const id of orgsByEvent.get(event.event_id) || []) counts.set(id,(counts.get(id)||0)+1);
    const orgIds = [...counts].sort((a,b) => b[1]-a[1]).map(x => x[0]);
    if (focusedOrgId) orgIds.unshift(focusedOrgId);
    const chosen = [...new Set(orgIds)].slice(0, 36), included = new Set(chosen);
    const nodes = chosen.map((id,index) => orgNode(orgById.get(id), id === focusedOrgId || index < 13, id === focusedOrgId));
    const links = [];
    for (const [index,event] of events.entries()) {
      nodes.push({id:'event:'+event.event_id,name:event.title,kind:'event',eventId:event.event_id,category:4,
        symbol:'diamond',symbolSize:event.event_id===selectedEventId?24:17,
        label:{show:index<7||event.event_id===selectedEventId,formatter:short(event.title, 13)},
        itemStyle:{borderColor:'#cafff8',borderWidth:1,shadowBlur:12,shadowColor:'#48e1d3'}});
      for (const id of orgsByEvent.get(event.event_id) || []) if (included.has(id)) links.push({source:'org:'+id,target:'event:'+event.event_id,lineStyle:{width:1.1,opacity:.42,color:'#55e2d5'}});
    }
    return {nodes,links};
  }
  function render() {
    if (!data || !chart) return;
    const graph = mode === 'events' ? eventGraph() : organizationGraph();
    chart.setOption({backgroundColor:'transparent',animationDuration:450,
      tooltip:{trigger:'item',backgroundColor:'#06284af5',borderColor:'#55bfe4',textStyle:{color:'#eafaff',fontSize:12},
        formatter:params => params.dataType === 'edge'
          ? `${escapeHtml(orgById.get(params.data.source.slice(4))?.org_name || params.data.source)} ↔ ${escapeHtml(orgById.get(params.data.target.slice(4))?.org_name || eventById.get(params.data.target.slice(6))?.title || params.data.target)}${params.data.value ? `<br>${params.data.value} 个共同事件` : ''}`
          : escapeHtml(params.data.name)},
      series:[{type:'graph',layout:'force',roam:true,draggable:true,focusNodeAdjacency:true,
        left:55,right:65,top:50,bottom:55,
        force:{repulsion:mode==='events'?300:220,edgeLength:mode==='events'?[70,145]:[65,130],gravity:.07,friction:.62},
        data:graph.nodes,links:graph.links,categories:['学校','其他机构','政府部门','企业','事件'].map((name,index) => ({name,itemStyle:{color:colors[index]}})),
        edgeSymbol:['none','none'],lineStyle:{color:'#6ac6f0',opacity:.32,curveness:.07},
        label:{position:'right',color:'#eafaff',fontSize:11,fontWeight:600,textBorderColor:'#052443',textBorderWidth:3}}]},true);
    showDetails();
  }
  function indexData() {
    orgById = new Map(data.organizations.map(row => [row.org_id,row]));
    eventById = new Map(data.events.map(row => [row.event_id,row]));
    eventsByOrg = new Map(); orgsByEvent = new Map(); partnersByOrg = new Map();
    for (const row of data.participated_in) {
      if (!eventsByOrg.has(row.org_id)) eventsByOrg.set(row.org_id,[]);
      if (!orgsByEvent.has(row.event_id)) orgsByEvent.set(row.event_id,[]);
      eventsByOrg.get(row.org_id).push(row.event_id); orgsByEvent.get(row.event_id).push(row.org_id);
    }
    for (const row of data.co_participated_with) for (const [id,other] of [[row.org_id_1,row.org_id_2],[row.org_id_2,row.org_id_1]]) {
      if (!partnersByOrg.has(id)) partnersByOrg.set(id,[]);
      partnersByOrg.get(id).push({id:other,count:row.shared_event_count});
    }
    rankedOrgs = [...data.organizations].sort((a,b) => (partnersByOrg.get(b.org_id)?.length || 0)-(partnersByOrg.get(a.org_id)?.length || 0));
    $('#knowledgeCounts').textContent = `${nice(data.organizations.length)} 个机构 · ${nice(data.events.length)} 个事件`;
  }
  async function open() {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; document.body.classList.add('knowledge-open');
    modal.classList.remove('hidden'); $('#knowledgeClose').focus();
    try {
      if (!data) {
        details.replaceChildren(el('p','正在读取知识图谱数据…'));
        const response = await fetch('./knowledge-graph.json?v=20261009a');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        data = await response.json(); indexData();
      }
      if (!chart) {
        chart = echarts.init($('#knowledgeGraph'));
        chart.on('click', params => {
          if (params.dataType !== 'node') return;
          if (params.data.kind === 'organization') focusOrg(params.data.orgId);
          else showEvent(params.data.eventId);
        });
      }
      chart.resize(); render();
    } catch (error) {
      console.error('Knowledge graph loading failed:',error);
      details.replaceChildren(el('h3','图谱暂时无法加载'),el('p','请稍后重新打开。'));
    }
  }
  function close() {
    modal.classList.add('hidden'); document.body.classList.remove('knowledge-open');
    document.body.style.overflow = previousOverflow;
    chart?.dispose(); chart = null; $('#knowledgeOpen').focus();
  }
  $('#knowledgeOpen').addEventListener('click',open);
  $('#knowledgeClose').addEventListener('click',close);
  modal.addEventListener('click',event => { if (event.target === modal) close(); });
  document.addEventListener('keydown',event => { if (event.key === 'Escape' && !modal.classList.contains('hidden')) {event.stopImmediatePropagation();close();} },true);
  document.querySelectorAll('[data-kg-mode]').forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.kgMode; selectedEventId = null; syncMode(); render();
  }));
  $('#knowledgeReset').addEventListener('click', () => {
    focusedOrgId = null; selectedEventId = null; mode = 'organizations'; $('#knowledgeSearch').value = ''; syncMode(); render();
  });
  $('#knowledgeSearchForm').addEventListener('submit', event => {
    event.preventDefault(); if (!data) return;
    const query = $('#knowledgeSearch').value.trim().toLocaleLowerCase(); if (!query) return;
    const exact = data.organizations.find(org => org.org_name.toLocaleLowerCase() === query);
    if (exact) return focusOrg(exact.org_id);
    const matches = data.organizations.filter(org => org.org_name.toLocaleLowerCase().includes(query)).sort((a,b) => b.news_count-a.news_count);
    details.replaceChildren(el('h3',`搜索“${$('#knowledgeSearch').value.trim()}”`),el('p',`找到 ${nice(matches.length)} 个机构，请选择一个查看关系。`));
    addButtonList(details,'匹配机构',matches.slice(0,80),org => org.org_name,org => focusOrg(org.org_id),'没有匹配机构');
  });
  window.addEventListener('resize',() => { if (chart && !modal.classList.contains('hidden')) chart.resize(); });
})();
