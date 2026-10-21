"""Read local collectors without running them; export only public presentation data."""
import argparse
from collections import Counter
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
TASKS = {'coding':'编程开发','documents':'文档处理','data':'数据与表格','research':'搜索与研究','design':'设计与前端','content':'写作与媒体','automation':'自动化工作流','ops':'部署与运维','security':'安全检查','business':'产品与商业','general':'通用工具'}


def safe_url(value):
    value = str(value or '').strip()
    try:
        url = urlsplit(value)
        return value if url.scheme in ('http', 'https') and url.netloc and not url.username and not url.password else ''
    except ValueError:
        return ''


def text(value, limit=2000):
    return str(value or '')[:limit]


def read_json(path, default=None):
    if not path.exists() and default is not None:
        return default
    return json.loads(path.read_text(encoding='utf-8-sig'))


def export_news(db_path, days=7):
    db_path = Path(db_path).resolve()
    if not db_path.is_file():
        raise FileNotFoundError(db_path)
    result = {}
    with closing(sqlite3.connect(db_path.as_uri() + '?mode=ro', uri=True)) as con:
        latest = con.execute('SELECT MAX(push_date) FROM push_records').fetchone()[0]
        if not latest:
            raise ValueError('News database has no records; keeping existing public snapshot')
        anchor = date.fromisoformat(latest)
        if anchor > date.today():
            raise ValueError('News database contains a future date')
        oldest = (anchor - timedelta(days=days - 1)).isoformat()
        rows = con.execute('SELECT source,title,content,category,url,push_time,push_date FROM push_records WHERE push_date BETWEEN ? AND ? ORDER BY push_time DESC', (oldest, latest)).fetchall()
    grouped, seen = {}, set()
    for source, title, content, category, url, timestamp, day in rows:
        key = (day, source, title, url)
        if key in seen:
            continue
        seen.add(key)
        grouped.setdefault(day, []).append(dict(source=text(source, 200), title=text(title, 400), content=text(content, 1200), category=text(category, 100), url=safe_url(url), time=text(timestamp, 40)))
    dates = sorted(grouped, reverse=True)
    for day in dates:
        result[f'api/ainews_{day}.json'] = grouped[day]
    result['api/latest_date.json'] = {'latest_date': latest, 'dates': dates}
    result['api/news.json'] = [item for day in dates for item in grouped[day]]
    return result


def public_record(row, verified_public=()):
    repo = row.get('repo', {})
    if repo.get('private') is True:
        raise ValueError('Refusing to export a private repository')
    if repo.get('private') is not False and repo.get('full_name') not in verified_public:
        raise ValueError('Repository visibility has not been verified')
    out = {key: text(repo.get(key), 2000) for key in ('full_name', 'description', 'language', 'created_at', 'updated_at', 'pushed_at')}
    out['html_url'] = safe_url(repo.get('html_url'))
    for key in ('stargazers_count', 'forks_count'):
        out[key] = max(0, int(repo.get(key) or 0))
    result = {'label': text(row.get('label'), 100), 'type': text(row.get('type'), 40), 'foundAt': text(row.get('foundAt'), 40), 'repo': out}
    if row.get('resource_type'):
        categories=[key for key in row.get('categories',[]) if key in TASKS][:3] or ['general']
        status=row.get('structure_status')
        status=status if status in ('valid','invalid','partial','no_skill_found','pending') else 'pending'
        kind=row.get('resource_type')
        kind=kind if kind in ('skill','skill-candidate','mcp','project') else 'project'
        if kind=='skill' and status!='valid': kind='skill-candidate'
        translation=row.get('translation',{})
        translated_status=translation.get('status')
        translated_status=translated_status if translated_status in ('translated','original_zh','pending','failed') else 'pending'
        result['label']=TASKS[categories[0]]
        result['enrichment']={
            'id':text(row.get('id'),500),'name':text(row.get('name'),200),'description':text(row.get('description'),2000),
            'resourceType':kind,'structureStatus':status,'inspectedAt':text(row.get('inspected_at'),40),
            'skillPath':text(row.get('skill_path'),500),'skillUrl':safe_url(row.get('skill_url')),
            'compatibility':text(row.get('compatibility'),500),'categories':[TASKS[key] for key in categories],
            'classificationMethod':'ai' if row.get('classification_method')=='ai' else 'rules',
            'discoveryLabels':[text(label,100) for label in row.get('labels',[row.get('label')]) if isinstance(label,str)][:30],
            'translation':{'status':translated_status,'titleZh':text(translation.get('title_zh'),200) if translated_status in ('translated','original_zh') else '',
                           'descriptionZh':text(translation.get('description_zh'),2400) if translated_status in ('translated','original_zh') else ''}}
    return result


def export_skill(source, visibility_path=ROOT / 'skill-public-repos.json'):
    source = Path(source)
    enriched = read_json(source / 'data/enriched.json', {})
    records = enriched.get('records') if enriched else read_json(source / 'data/records.json')
    if not isinstance(records, list) or not records:
        raise ValueError('Skill records must be a non-empty array')
    evidence = read_json(Path(visibility_path), {})
    public_names = set()
    checked = evidence.get('checkedAt')
    if checked and evidence.get('method') == 'anonymous-github-head-exact-url':
        age = datetime.now(timezone.utc) - datetime.fromisoformat(checked)
        if timedelta(0) <= age <= timedelta(days=1):
            public_names = set(evidence.get('repositories', []))
    verified = []
    for row in records:
        try:
            verified.append(public_record(row, public_names))
        except ValueError:
            # Do not log names of private or unverified repositories.
            pass
    print(f'Skill visibility: {len(verified)}/{len(records)} records approved for public export')
    records = verified
    if not records:
        raise ValueError('No repositories have current public visibility evidence; run verify-public-repos.py first')
    records.sort(key=lambda row: row['repo']['updated_at'], reverse=True)
    labels = Counter(row['label'] for row in records)
    result = {'api/records.json': records, 'api/labels.json': [{'name': name, 'count': count} for name, count in sorted(labels.items())]}
    latest = max((row['repo']['updated_at'] for row in records), default='')
    result['api/stats.json'] = {'total': len(records), 'labelCount': dict(labels), 'typeCount': dict(Counter(row['type'] for row in records)), 'lastUpdated': latest}
    if enriched:
        pipeline=enriched.get('pipeline',{})
        result['api/pipeline.json']={key:pipeline.get(key) for key in ('lastRunAt','collectedAt','sourceRepositories','entries','structure','translation','classification','aiConfigured')}
        result['api/pipeline.json']['collectionStatus']=pipeline.get('collection',{}).get('status','unknown')
    specs = {
        'trending': ('data/trending.json', ('fullName', 'description', 'language', 'stars', 'todayStars', 'crawledAt'), 'url'),
        'hf_trending': ('data/hf_trending.json', ('repoType', 'fullName', 'description', 'likes', 'downloads', 'crawledAt'), 'url'),
        'hackernews': ('data/hackernews/latest.json', ('title', 'score', 'comments', 'by', 'time', 'id'), 'url'),
    }
    for name, (filename, fields, url_key) in specs.items():
        file = source / filename
        if name == 'hackernews' and not file.exists():
            files = sorted((source / 'data/hackernews').glob('*.json'))
            file = files[-1] if files else file
        rows = read_json(file, []) or []
        if not isinstance(rows, list):
            raise ValueError(f'{name} must be an array')
        cleaned = []
        for row in rows:
            item = {key: row[key] for key in fields if isinstance(row.get(key), (str, int, float))}
            item['url'] = safe_url(row.get(url_key))
            if name == 'hf_trending' and item.get('fullName'):
                kind = item.get('repoType', 'model')
                prefix = {'model': '', 'dataset': 'datasets/', 'space': 'spaces/'}.get(kind)
                if prefix is not None:
                    item['url'] = safe_url('https://huggingface.co/' + prefix + item['fullName'])
            cleaned.append(item)
        result[f'api/{name}.json'] = cleaned
    return result


def export_reports(source):
    """Project report summaries only; never copy generated HTML or internal navigation."""
    result = []
    for kind, folder, pattern in [('daily', 'daily_analysis', 'analysis_*.json'), ('weekly', 'weekly_analysis', 'weekly_*.json')]:
        for file in sorted((Path(source) / folder).glob(pattern)):
            row = read_json(file)
            analysis = row.get('analysis', {})
            if not isinstance(analysis, dict):
                continue
            result.append({'kind': kind, 'date': text(row.get('date') or row.get('week_start'), 20), 'id': file.stem,
                           'method': text(row.get('analysis_method'), 80),
                           'summary': text(analysis.get('core_summary') or analysis.get('week_summary'), 12000),
                           'insights': [text(item, 3000) for item in analysis.get('key_insights', []) if isinstance(item, str)],
                           'outlook': text(analysis.get('outlook'), 6000)})
    return {'api/reports.json': sorted(result, key=lambda row: row['date'], reverse=True)}


def sync_content(news_source, skill_source, target=ROOT, days=7, skill_only=False):
    if days < 1 or days > 366:
        raise ValueError('days must be between 1 and 366')
    target = Path(target).resolve()
    sources = [Path(news_source).resolve(), Path(skill_source).resolve()]
    if any(target == source or target.is_relative_to(source) for source in sources):
        raise ValueError('Public output must not be inside a private source')
    # Validate every source before any public mutation.
    news = None
    if not skill_only:
        news = export_news(sources[0] / 'push_logs.db', days)
        news.update(export_reports(sources[0]))
    skill = export_skill(sources[1])
    for name, payload in [('ainews', news), ('skill', skill)]:
        if payload is None: continue
        latest = payload['api/latest_date.json']['latest_date'] if name == 'ainews' else payload['api/stats.json']['lastUpdated']
        payload['api/manifest.json'] = {'sourceUpdatedAt': latest, 'exportedAt': datetime.now(timezone.utc).isoformat(), 'mode': 'local-snapshot', 'note': '导出不是采集；数据日期早于今天时请按历史快照阅读。'}
        if 'api/pipeline.json' in payload:
            pipeline=payload['api/pipeline.json']
            payload['api/manifest.json'].update(mode='skill-pipeline',collectedAt=pipeline.get('collectedAt'),collectionStatus=pipeline.get('collectionStatus'))
        for filename, value in payload.items():
            path = target / name / filename
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix('.json.tmp')
            temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
            temporary.replace(path)
        print(f'{name}: exported {len(payload)} public JSON files; source date {latest}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--news-source', type=Path, default=ROOT / 'AINav_art/ainews')
    parser.add_argument('--skill-source', type=Path, default=ROOT / 'AINav_art/skill')
    parser.add_argument('--output', type=Path, default=ROOT)
    parser.add_argument('--days', type=int, default=7)
    parser.add_argument('--skill-only', action='store_true')
    args = parser.parse_args()
    sync_content(args.news_source, args.skill_source, args.output, args.days, args.skill_only)
