const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectItems, safeUrl } = require('../content-viewer.js');

test('sorts the entire collection before pagination and combines search and category', () => {
  const rows = Array.from({ length: 65 }, (_, i) => ({ title: `Repo ${i}`, category: i % 2 ? 'Claude' : 'RAG', stars: i, time: `2026-06-${String(i % 28 + 1).padStart(2, '0')}` }));
  const result = selectItems(rows, { sort: 'stars', category: 'Claude', q: 'repo', page: 2, size: 10 });
  assert.equal(result.total, 32);
  assert.equal(result.items[0].stars, 43);
  assert.equal(result.items.length, 10);
});
test('clamps invalid pages and reports an empty search accurately', () => {
  assert.equal(selectItems([{ title: 'Claude' }], { page: 99 }).page, 1);
  assert.deepEqual(selectItems([{ title: 'Claude' }], { q: 'absent' }).items, []);
  assert.equal(selectItems([{ title: 'Claude' }], { page: NaN }).page, 1);
});
test('rejects script URLs and credential-bearing links', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('https://user:secret@example.com'), '');
  assert.equal(safeUrl('https://example.com/article'), 'https://example.com/article');
});
test('keeps collector resource types distinct when filtering', () => {
  const rows = [{title:'A',type:'skill'},{title:'B',type:'project'}];
  assert.deepEqual(selectItems(rows,{type:'skill'}).items.map(x=>x.title),['A']);
});

test('filters secondary tasks and searches original descriptions after translation', () => {
  const rows = [{title:'表格助手',original:'spreadsheet workbook',category:'文档处理',categories:['文档处理','数据与表格'],discoveryLabels:['Legacy']}];
  assert.equal(selectItems(rows,{category:'数据与表格',q:'workbook'}).total,1);
  assert.equal(selectItems(rows,{category:'Legacy'}).total,1);
});
