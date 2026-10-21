/* Build public snapshots without reading the ignored collector directory. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read = (dir, name) => JSON.parse(fs.readFileSync(path.join(root, dir, 'api', name + '.json'), 'utf8'));
const scriptJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
function write(dir, file, text) { const p = path.join(root, dir, file); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, text); }
function shell(dir, filename, title, config) {
  const nested = filename.includes('/'), base = nested ? '../' : '', home = nested ? '../../' : '../';
  const links = dir === 'skill' ? [['index.html','全部项目','records'],['trending.html','GitHub Trending','trending'],['huggingface.html','Hugging Face','hf_trending'],['hackernews.html','Hacker News','hackernews']] : [['index.html','资讯','news'],['daily_analysis_index.html','日报摘要','daily'],['weekly_analysis_index.html','周报摘要','weekly']];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · AINav</title><meta name="description" content="${esc(title)}，支持搜索、筛选与排序，标明源数据日期的公开快照。"><link rel="canonical" href="https://aiv123.com/${dir}/${filename}"><link rel="stylesheet" href="${home}content-viewer.css"></head><body><div class="content-wrap"><nav class="content-nav" aria-label="内容导航"><a href="${home}index.html">AINav 首页</a>${links.map(([href,label,kind])=>`<a href="${base}${href}"${config.kind === kind && !config.label ? ' aria-current="page"' : ''}>${label}</a>`).join('')}<a href="${home}${dir === 'skill' ? 'ainews' : 'skill'}/">${dir === 'skill' ? 'AI 资讯' : 'Skill 动态'}</a><a href="${home}skill-plan.html">Skill 实践</a></nav><header><h1>${esc(title)}</h1><p>${dir === 'skill' ? '发现 AI 开源项目、模型与社区讨论。搜索和排序覆盖当前频道全部数据，再按页展示。' : '按日期、分类和关键词查看公开资讯。日报与周报展示历史自动分析摘要，请结合原始来源阅读。'}</p></header><p id="content-status" class="content-status" role="status">正在读取数据快照…</p><div class="content-controls"><label>搜索<input id="content-search" type="search" placeholder="标题、描述、来源或分类"></label><label>分类<select id="content-category"><option value="">全部分类</option></select></label>${dir === 'ainews' ? '<label>日期<select id="content-date"><option value="">全部可用日期</option></select></label>' : ''}<label>排序<select id="content-sort"><option value="updated">时间从新到旧</option>${dir === 'skill' ? '<option value="stars">Stars / 喜欢 / 得分</option>' : ''}${config.kind === 'records' ? '<option value="created">创建时间</option>' : ''}</select></label><button id="content-reset" type="button">清除筛选</button></div><p id="content-count" aria-live="polite"></p><main id="content-list" aria-label="内容列表"></main><nav id="content-pagination" aria-label="分页"></nav><noscript>请启用 JavaScript 查看、搜索和筛选公开快照。原始数据可在本目录 api/ 中查看。</noscript><footer>公开快照独立于采集程序更新。<a href="${base}api/manifest.json">数据日期</a> · <a href="${home}claude-account-safety.html">Claude 账号指南</a> · <a href="${home}privacy.html">隐私政策</a></footer></div><script>window.AINAV_VIEW=${JSON.stringify(config).replace(/</g,'\\u003c')};</script><script src="${base}snapshot-data.js"></script><script src="${home}content-viewer.js"></script></body></html>\n`;
}
function build(dir) {
  if (!fs.existsSync(path.join(root,dir,'api/manifest.json'))) { console.log(`${dir}: no public manifest, skipped`); return; }
  const data = {manifest:read(dir,'manifest')}, pages = [];
  if (dir === 'skill') {
    for (const name of ['records','labels','trending','hf_trending','hackernews']) data[name] = read(dir,name) || [];
    pages.push(['index.html','AI Skill 动态',{kind:'records'}],['trending.html','GitHub Trending',{kind:'trending'}],['huggingface.html','Hugging Face 动态',{kind:'hf_trending'}],['hackernews.html','Hacker News AI',{kind:'hackernews'}]);
    const total = Math.ceil(data.records.length / 30);
    for(let i=2;i<=Math.max(total,12);i++) pages.push([`index-page-${i}.html`,'AI Skill 动态',{kind:'records',page:i}]);
    // Preserve old label URLs, including labels no longer represented in data.
    const labels = new Set(data.labels.map(x=>x.name));
    const oldDir = path.join(root,dir,'label');
    if(fs.existsSync(oldDir)) for(const file of fs.readdirSync(oldDir)) if(file.endsWith('.html')) labels.add(file.replace(/-page-\d+(?=\.html$)/,'').slice(0,-5));
    for(const label of labels) {
      if (/[\\/\x00-\x1f]/.test(label) || label === '..' || label === '.') throw new Error('Invalid label name');
      const count = data.records.filter(x=>x.label===label).length;
      pages.push([`label/${label}.html`,label,{kind:'records',label}]);
      const oldPages = fs.existsSync(oldDir) ? fs.readdirSync(oldDir).filter(x=>x.startsWith(label+'-page-')).length+1 : 1;
      for(let i=2;i<=Math.max(oldPages,Math.ceil(count/30));i++) pages.push([`label/${label}-page-${i}.html`,label,{kind:'records',label,page:i}]);
    }
  } else {
    data.news=read(dir,'news'); data.reports=read(dir,'reports');
    pages.push(['index.html','AI 资讯',{kind:'news'}],['daily_analysis_index.html','AI 日报摘要',{kind:'daily'}],['daily_analysis.html','AI 日报摘要',{kind:'daily'}],['weekly_analysis_index.html','AI 周报摘要',{kind:'weekly'}],['weekly_analysis.html','AI 周报摘要',{kind:'weekly'}]);
  }
  write(dir,'snapshot-data.js','window.AINAV_CONTENT='+scriptJson(data)+';\n');
  for(const [filename,title,config] of pages) write(dir,filename,shell(dir,filename,title,config));
  write(dir,'sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pages.map(([file])=>`<url><loc>https://aiv123.com/${dir}/${esc(file.split('/').map(encodeURIComponent).join('/'))}</loc></url>`).join('')+'</urlset>\n');
  console.log(`${dir}: built ${pages.length} pages from public JSON`);
}
build('ainews'); build('skill');
