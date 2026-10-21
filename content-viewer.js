(function () {
  'use strict';
  function safeUrl(value) {
    try {
      var url = new URL(value);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }
  function selectItems(rows, options) {
    var opts = options || {}, query = String(opts.q || '').trim().toLocaleLowerCase();
    var filtered = rows.filter(function (row) {
      return (!opts.category || [row.category].concat(row.categories || [], row.discoveryLabels || []).includes(opts.category)) && (!opts.type || row.type === opts.type) && (!opts.date || String(row.time || '').slice(0, 10) === opts.date) &&
        (!query || [row.title, row.description, row.source, row.category, row.original, (row.categories || []).join(' '), (row.discoveryLabels || []).join(' ')].join(' ').toLocaleLowerCase().includes(query));
    });
    filtered.sort(function (a, b) {
      if (opts.sort === 'stars') return (Number(b.stars) || 0) - (Number(a.stars) || 0) || String(a.title).localeCompare(String(b.title));
      var key = opts.sort === 'created' ? 'created' : 'time';
      return String(b[key] || '').localeCompare(String(a[key] || '')) || String(a.title).localeCompare(String(b.title));
    });
    var size = Math.max(1, Number(opts.size) || 30), pages = Math.max(1, Math.ceil(filtered.length / size));
    var page = Math.min(pages, Math.max(1, Math.floor(Number(opts.page) || 1)));
    return { items: filtered.slice((page - 1) * size, page * size), total: filtered.length, pages: pages, page: page };
  }
  if (typeof module !== 'undefined') module.exports = { selectItems: selectItems, safeUrl: safeUrl };
  if (typeof document === 'undefined') return;
  var config = window.AINAV_VIEW || {}, data = window.AINAV_CONTENT;
  var list = document.getElementById('content-list');
  if (!list) return;
  if (!data) { list.textContent = '公开数据加载失败，请重新加载页面。若持续失败，请返回导航首页。'; return; }
  function node(tag, text, className) {
    var el = document.createElement(tag);
    if (text !== undefined) el.textContent = String(text);
    if (className) el.className = className;
    return el;
  }
  var rows = [];
  if (config.kind === 'records') {
    rows = data.records.map(function (row) {
      var r = row.repo, e = row.enrichment || {}, t = e.translation || {};
      return { title: t.titleZh || e.name || r.full_name, description: t.descriptionZh || e.description || r.description,
        original: [r.full_name, e.description || r.description].filter(Boolean).join(' — '),
        url: e.skillUrl || r.html_url, category: row.label, categories: e.categories || [], discoveryLabels: e.discoveryLabels || [],
        type: e.resourceType || (/mcp/i.test(row.label) ? 'mcp' : row.type === 'skill' ? 'skill-candidate' : 'project'),
        structure: e.structureStatus || 'pending', translation: t.status || 'pending', classification: e.classificationMethod || 'rules',
        path: e.skillPath, source: r.full_name, stars: r.stargazers_count, time: r.updated_at, created: r.created_at };
    });
  } else if (config.kind === 'news') {
    rows = data.news.map(function (row) { return { title: row.title, description: row.content, category: row.category || '未分类', source: row.source, url: row.url, time: row.time }; });
  } else if (config.kind === 'daily' || config.kind === 'weekly') {
    rows = data.reports.filter(function (row) { return row.kind === config.kind; }).map(function (row) { return { title: row.date + (row.kind === 'daily' ? ' 日报' : ' 周报'), description: [row.summary].concat(row.insights || [], [row.outlook]).filter(Boolean).join('\n\n'), category: row.method || '历史分析', time: row.date, id: row.id, source: '自动分析 · 请核对原始资讯' }; });
  } else {
    rows = (data[config.kind] || []).map(function (row) { return { title: row.fullName || row.title, description: row.description || '', url: row.url, category: row.repoType || '', source: row.language || (config.kind === 'hackernews' ? 'Hacker News' : '榜单快照'), stars: row.stars || row.likes || row.score || 0, time: row.crawledAt || row.time, extra: row.todayStars || (row.downloads ? '下载 ' + row.downloads : ''), comments: row.comments, id: row.id }; });
  }
  var params = new URLSearchParams(location.search);
  var state = { q: params.get('q') || '', category: params.has('category') ? params.get('category') : config.label || '', type: params.get('type') || '', date: params.get('date') || '', sort: params.get('sort') || 'updated', page: Number(params.get('page')) || config.page || 1 };
  if (!['updated', 'created', 'stars'].includes(state.sort)) state.sort = 'updated';
  var search = document.getElementById('content-search'), category = document.getElementById('content-category'), dateInput = document.getElementById('content-date'), sort = document.getElementById('content-sort');
  search.value = state.q;
  var resourceType = null;
  var typeNames = { skill: 'Skill · 结构通过', 'skill-candidate': 'Skill 候选 · 待核实', mcp: 'MCP 相关项目', project: '生态项目' };
  if (config.kind === 'records') {
    var label = node('label', '资源类型'); resourceType = node('select'); resourceType.id = 'content-type';
    var all = node('option', '全部类别'); all.value = ''; resourceType.appendChild(all);
    Object.keys(typeNames).forEach(function (key) { var option = node('option', typeNames[key]); option.value = key; resourceType.appendChild(option); });
    resourceType.value = state.type; label.appendChild(resourceType); sort.parentElement.before(label);
  } else state.type = '';
  Array.from(new Set(rows.flatMap(function (r) { return r.categories && r.categories.length ? r.categories : [r.category]; }).filter(Boolean))).sort().forEach(function (value) { var option = node('option', value); option.value = value; category.appendChild(option); });
  if (state.category && !Array.from(category.options).some(function (o) { return o.value === state.category; })) { var option = node('option', state.category); option.value = state.category; category.appendChild(option); }
  category.value = state.category;
  sort.value = state.sort;
  if (dateInput) {
    Array.from(new Set(rows.map(function (r) { return String(r.time || '').slice(0, 10); }).filter(Boolean))).sort().reverse().forEach(function (value) { var option = node('option', value); option.value = value; dateInput.appendChild(option); });
    if (state.date && !Array.from(dateInput.options).some(function (o) { return o.value === state.date; })) { var option = node('option', state.date + '（无数据）'); option.value = state.date; dateInput.appendChild(option); }
    dateInput.value = state.date;
  }
  var sourceDate = data.manifest.sourceUpdatedAt || '';
  var warning = document.getElementById('content-status');
  var stale = !sourceDate || Date.now() - Date.parse(sourceDate) > 7 * 86400000;
  warning.textContent = (stale ? '历史快照' : '公开数据快照') + '：源数据截至 ' + (sourceDate.slice(0, 10) || '未知') + '。导出时间 ' + data.manifest.exportedAt.slice(0, 10) + '；导出不代表已重新采集。各榜单时间见条目。';
  if (config.kind === 'records' && data.pipeline) {
    var p = data.pipeline, st = p.structure || {}, tr = p.translation || {};
    warning.textContent = '最近采集：' + (String(p.collectedAt || '').slice(0, 10) || '尚无成功记录') +
      '；' + (p.sourceRepositories || 0) + ' 个项目，' + rows.length + ' 个公开条目。结构通过 ' + (st.valid || 0) +
      '，待检查 ' + (st.pending || 0) + '。AI 已翻译 ' + (tr.translated || 0) + '，原文中文 ' + (tr.original_zh || 0) +
      '，待翻译 ' + (tr.pending || 0) + '，失败待重试 ' + (tr.failed || 0) + '。结构检查不代表代码安全审计。';
    stale = !p.collectedAt || Date.now() - Date.parse(p.collectedAt) > 7 * 86400000;
  }
  if (stale) warning.classList.add('is-stale');
  function render(updateUrl) {
    var selected = rows;
    var selectedReport = params.get('id') || params.get('week');
    if (selectedReport && (config.kind === 'daily' || config.kind === 'weekly')) selected = rows.filter(function (r) { return r.id === selectedReport || r.id === 'weekly_' + selectedReport; });
    var result = selectItems(selected, state);
    state.page = result.page;
    list.replaceChildren();
    document.getElementById('content-count').textContent = result.total + ' 条结果';
    if (!result.total) list.appendChild(node('p', '没有符合条件的内容。可清除搜索或筛选；空榜单表示本次源数据没有条目。', 'empty'));
    result.items.forEach(function (row) {
      var card = node('article', undefined, 'content-card'), title = node('h2'), url = safeUrl(row.url);
      if (url) { var a = node('a', row.title); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; title.appendChild(a); }
      else title.textContent = row.title;
      card.appendChild(title);
      var metadata = [row.source, row.category, row.time ? String(row.time).replace('T', ' ').slice(0, 19) : '时间未提供'];
      if (row.categories && row.categories.length) metadata[1] = row.categories.join(' / ');
      if (row.type) metadata.unshift(typeNames[row.type] || '未验证');
      if (typeof row.stars === 'number') metadata.push((config.kind === 'hf_trending' ? '喜欢 ' : config.kind === 'hackernews' ? '得分 ' : 'Stars ') + row.stars);
      if (row.extra) metadata.push(row.extra);
      card.appendChild(node('p', metadata.filter(Boolean).join(' · '), 'content-meta'));
      if (row.description) {
        var detail = node('p', row.description, 'content-description');
        card.appendChild(detail);
      }
      if (config.kind === 'records') {
        var states = {valid:'SKILL.md 结构通过',invalid:'SKILL.md 结构不完整',partial:'目录检查不完整',no_skill_found:'本次目录未找到 SKILL.md',pending:'尚未检查结构'};
        var translations = {translated:'AI 中文翻译',original_zh:'原文中文',pending:'待翻译 · 显示原文',failed:'翻译失败待重试 · 显示原文'};
        card.appendChild(node('p', [states[row.structure], translations[row.translation], row.classification === 'ai' ? 'AI 分类' : '规则分类', row.path].filter(Boolean).join(' · '), 'content-meta'));
        var original = node('details'), summary = node('summary', '查看原文与项目名称');
        original.append(summary, node('p', row.original, 'content-description')); card.appendChild(original);
      }
      if (config.kind === 'hackernews' && Number.isSafeInteger(Number(row.id)) && Number(row.id) > 0) { var comments = node('a', (row.comments || 0) + ' 条讨论'); comments.href = 'https://news.ycombinator.com/item?id=' + Number(row.id); comments.target = '_blank'; comments.rel = 'noopener noreferrer'; card.appendChild(comments); }
      list.appendChild(card);
    });
    var pagination = document.getElementById('content-pagination'); pagination.replaceChildren();
    function pageButton(label, page, disabled) { var b = node('button', label); b.type = 'button'; b.disabled = disabled; b.onclick = function () { state.page = page; render(true); list.scrollIntoView({ behavior: 'instant', block: 'start' }); }; return b; }
    pagination.append(pageButton('上一页', state.page - 1, state.page === 1), node('span', state.page + ' / ' + result.pages), pageButton('下一页', state.page + 1, state.page === result.pages));
    if (updateUrl) {
      var url = new URL(location.href);
      ['q', 'category', 'type', 'date', 'sort', 'page'].forEach(function (key) { if (state[key] || (key === 'category' && config.label)) url.searchParams.set(key, state[key]); else url.searchParams.delete(key); });
      try { history.replaceState(null, '', url); } catch (_) { /* file:// browsers may disallow history changes */ }
    }
  }
  function changed() { state.q = search.value; state.category = category.value; state.type = resourceType ? resourceType.value : ''; state.date = dateInput ? dateInput.value : ''; state.sort = sort.value; state.page = 1; render(true); }
  search.addEventListener('input', changed); category.addEventListener('change', changed); sort.addEventListener('change', changed);
  if (dateInput) dateInput.addEventListener('change', changed);
  if (resourceType) resourceType.addEventListener('change', changed);
  document.getElementById('content-reset').onclick = function () { search.value = ''; category.value = ''; if (dateInput) dateInput.value = ''; if(resourceType) resourceType.value = ''; sort.value = 'updated'; params.delete('id'); params.delete('week'); var u = new URL(location.href); u.searchParams.delete('id'); u.searchParams.delete('week'); try { history.replaceState(null, '', u); } catch (_) {} changed(); };
  render(false);
})();
