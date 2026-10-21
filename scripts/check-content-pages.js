/* Validate public entry points, local assets and inline JavaScript without a browser. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const nav = JSON.parse(fs.readFileSync(path.join(root,'nav-links.json'),'utf8'));
const updates = JSON.parse(fs.readFileSync(path.join(root,'topic-updates.json'),'utf8'));
const files = new Set(['claude-account-safety.html',...Object.keys(updates.pages)]);
function walk(dir) { for (const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) { const p = path.posix.join(dir,item.name); if(item.isDirectory()) walk(p); else if(p.endsWith('.html')) files.add(p); } }
walk('ainews'); walk('skill');
let count = 0;
for(const file of files) {
  const html = fs.readFileSync(path.join(root,file),'utf8');
  assert(/<meta[^>]+name="viewport"/i.test(html),file+': missing viewport');
  assert(/<h1\b/i.test(html),file+': missing h1');
  // Existing topic pages may have unrelated legacy links; strictly check new pages.
  if(file.startsWith('ainews/') || file.startsWith('skill/') || file==='claude-account-safety.html') {
    for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url=match[1];
      if(/^(?:[a-z]+:|#|\/\/)/i.test(url)) continue;
      const relative = decodeURIComponent(url.split(/[?#]/)[0]);
      if(!relative) continue;
      let target=relative.startsWith('/') ? path.join(root,relative.slice(1)) : path.resolve(root,path.dirname(file),relative);
      assert(target.startsWith(root+path.sep),file+': local target outside site');
      if(fs.existsSync(target) && fs.statSync(target).isDirectory()) target=path.join(target,'index.html');
      assert(fs.existsSync(target),file+': missing '+url);
    }
    for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) if(!/\bsrc=/.test(match[1]) && !/application\/ld\+json/.test(match[1])) new vm.Script(match[2],{filename:file});
  }
  count++;
}
for(const item of nav.links.filter(x=>x.href && !/^https?:/.test(x.href))) {
  let file=path.join(root,item.href); if(fs.existsSync(file)&&fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
  assert(fs.existsSync(file),'Navigation target missing: '+item.href);
}
for(const dir of ['ainews','skill']) {
  const script = fs.readFileSync(path.join(root,dir,'snapshot-data.js'),'utf8'), context={window:{}};
  vm.runInNewContext(script,context);
  assert(context.window.AINAV_CONTENT.manifest.sourceUpdatedAt,dir+': no source date');
  assert(!/"(?:push_channel|push_status|content_hash|keyword|token|botToken|chatId)"\s*:/.test(script),dir+': private metadata present');
}
console.log(`PASS: ${count} content pages, navigation targets, inline scripts, public snapshots and local assets`);
