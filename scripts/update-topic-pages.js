const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'topic-updates.json'), 'utf8'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const start = '<!-- topic-update:start -->', end = '<!-- topic-update:end -->';
for (const [file, page] of Object.entries(data.pages)) {
  const p = path.join(root, file);
  let html = fs.readFileSync(p, 'utf8');
  const section = `${start}\n<section class="topic-update" aria-label="内容更新说明" style="margin:1.25rem auto;padding:1rem 1.15rem;max-width:76rem;border:1px solid var(--border,#8b98a9);border-left:4px solid var(--accent,#675ad1);border-radius:8px;line-height:1.7;font-size:.9rem;overflow-wrap:anywhere"><strong>${esc(data.checkedAt)} 巡检：${esc(page.status)}</strong><ul>${page.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${page.sources.length ? '<p>来源：'+page.sources.map(([title,url])=>`<a href="${esc(url)}">${esc(title)}</a>`).join(' · ')+'</p>' : ''}<p style="margin-bottom:0">本次更新仅覆盖以上说明；下方原表格和测评保留原核实日期，未完成复核的价格、额度与排名请勿当作当前数据。</p></section>\n${end}`;
  const existing = new RegExp(start+'[\\s\\S]*?'+end);
  if (existing.test(html)) html = html.replace(existing, () => section);
  else {
    const heading = /<h1\b[^>]*>[\s\S]*?<\/h1>/i;
    if (!heading.test(html)) throw new Error('No h1 in '+file);
    html = html.replace(heading, match=>match+'\n'+section);
  }
  fs.writeFileSync(p, html);
}
console.log('Updated topic notes for '+Object.keys(data.pages).length+' pages; historical dates preserved.');
