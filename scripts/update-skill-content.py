"""Run the private Skill pipeline, then export only its public presentation data."""
import argparse
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-collect',action='store_true')
    parser.add_argument('--inspect-limit',type=int)
    parser.add_argument('--translation-requests',type=int)
    args=parser.parse_args()
    source=ROOT/'AINav_art/skill/pipeline.py'
    if not source.is_file():
        parser.error('Private Skill collector is not installed in AINav_art/skill. The public site can still use npm run build.')
    command=[sys.executable,str(source)]
    if args.skip_collect:command.append('--skip-collect')
    if args.inspect_limit is not None:command+=['--inspect-limit',str(args.inspect_limit)]
    if args.translation_requests is not None:command+=['--translation-requests',str(args.translation_requests)]
    subprocess.run(command,cwd=ROOT,check=True)
    subprocess.run([sys.executable,str(ROOT/'scripts/sync-public-content.py'),'--skill-only'],cwd=ROOT,check=True)
    subprocess.run(['node',str(ROOT/'scripts/build-content-pages.js')],cwd=ROOT,check=True)
