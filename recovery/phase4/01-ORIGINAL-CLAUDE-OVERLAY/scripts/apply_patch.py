#!/usr/bin/env python3
"""Apply the recovered Claude COLOSSEUM source overlay to an EXISTING project.
Usage: python scripts/apply_patch.py /path/to/colosseum [--check]
Creates a timestamped backup of replaced files before altering anything.
"""
import argparse
import shutil
from datetime import datetime
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
PATCH = APP / 'patches' / 'claude-globals-additions.css'
FILES = [
    'lib/builds.ts', 'lib/store.ts',
    'components/skill-art.tsx', 'components/loadout.tsx', 'components/skill-detail.tsx',
    'components/workshop.tsx', 'components/skill-hall.tsx',
    'components/mutation-lab.tsx', 'components/lineage-tree.tsx',
    'tests/logic.test.ts',
]
MARKER = 'RPG interaction layer: tactile press'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', help='Existing COLOSSEUM Next.js repository root')
    parser.add_argument('--check', action='store_true', help='Validate prerequisites and report changes without writing')
    args = parser.parse_args()
    dest = Path(args.project).expanduser().resolve()
    required = ['package.json', 'lib/data.ts', 'components/rune.tsx',
                'components/contender-art.tsx', 'app/globals.css', 'data/skills.json']
    missing = [f for f in required if not (dest / f).is_file()]
    if missing:
        parser.error(f'{dest} is not the expected base project; missing: {", ".join(missing)}')
    print('Project:', dest)
    for file in FILES:
        print('REPLACE' if (dest / file).exists() else 'ADD', file)
    css = dest / 'app/globals.css'
    print('KEEP (styles already present)' if MARKER in css.read_text(encoding='utf-8') else 'APPEND CSS styles', css)
    if args.check:
        print('Check only: no changes made.')
        return
    backup = dest / '.recovery-backups' / datetime.now().strftime('%Y%m%d-%H%M%S')
    for file in FILES + ['app/globals.css']:
        prior = dest / file
        if prior.exists():
            target = backup / file
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(prior, target)
    for file in FILES:
        target = dest / file
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(APP / file, target)
    existing = css.read_text(encoding='utf-8')
    if MARKER not in existing:
        with css.open('a', encoding='utf-8') as f:
            f.write('\n\n' + PATCH.read_text(encoding='utf-8'))
    print('Applied successfully; originals backed up at', backup)
    print('Next: npm install (if needed); npx tsx tests/logic.test.ts; npm run build')


if __name__ == '__main__':
    main()
