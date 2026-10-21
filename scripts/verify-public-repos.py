"""Verify legacy repository visibility anonymously; never use GitHub credentials."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def is_public(name):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', name):
        return False
    url = 'https://github.com/' + name
    try:
        request = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'AINav-public-visibility-check/1.0'})
        with urllib.request.urlopen(request, timeout=18) as response:
            # Redirects to login or another product do not prove public visibility.
            return response.status == 200 and response.url.rstrip('/').lower() == url.lower()
    except Exception:
        return False


def verify(source, output):
    records = json.loads(Path(source).read_text(encoding='utf-8-sig'))
    names = {str(row.get('repo', {}).get('full_name', '')) for row in records}
    public = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        pending = {pool.submit(is_public, name): name for name in names}
        for i, task in enumerate(as_completed(pending), 1):
            if task.result():
                public.append(pending[task])
            if i % 50 == 0:
                print(f'Visibility checked: {i}/{len(names)}; public {len(public)}', flush=True)
    if not public:
        raise RuntimeError('No anonymous visibility checks succeeded; keeping previous evidence')
    result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'method': 'anonymous-github-head-exact-url', 'repositories': sorted(public)}
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'Public visibility verified: {len(public)}/{len(names)}. Unverified names are not published.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--records', type=Path, default=ROOT / 'AINav_art/skill/data/records.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'skill-public-repos.json')
    args = parser.parse_args()
    verify(args.records, args.output)
