"""Release QA only: sample total Chromium resident memory, not a model-only estimate.
Shared pages can be counted more than once. This is a cloud-process measurement.
"""
from pathlib import Path
import json, time
out=Path('.validation/phase4/browser-memory.json')
qa=[]
for p in Path('/proc').iterdir():
    if p.name.isdigit():
        try:
            cmd=(p/'cmdline').read_bytes().split(b'\0')
            if cmd and cmd[0].endswith(b'node') and b'scripts/verify-browser-models.mjs' in cmd:
                qa.append(int(p.name))
        except (OSError, PermissionError): pass
if len(qa)!=1: raise SystemExit(f'Expected one browser verification process, found {qa}')
owner=qa[0]
def descendants(pid):
    parents={}
    for p in Path('/proc').iterdir():
        if not p.name.isdigit(): continue
        try:
            lines=(p/'status').read_text().splitlines()
            parent=int(next(l for l in lines if l.startswith('PPid:')).split()[1])
            parents.setdefault(parent,[]).append(int(p.name))
        except (OSError,StopIteration,ValueError): pass
    result=[];queue=[pid]
    while queue:
        children=parents.get(queue.pop(),[]);result.extend(children);queue.extend(children)
    return result
samples=[]
for _ in range(600):
    if not Path(f'/proc/{owner}').exists(): break
    rows=[]
    for pid in descendants(owner):
        try:
            p=Path(f'/proc/{pid}')
            cmd=(p/'cmdline').read_bytes()
            if b'chromium' not in cmd: continue
            value=next(line for line in (p/'status').read_text().splitlines() if line.startswith('VmRSS:'))
            rows.append({'pid':pid,'residentBytes':int(value.split()[1])*1024})
        except (OSError,StopIteration): pass
    if rows: samples.append({'at':int(time.time()*1000),'residentBytes':sum(r['residentBytes'] for r in rows),'processCount':len(rows)})
    out.write_text(json.dumps({'scope':'Aggregate Chromium process RSS, including UI/runtime and potentially double-counted shared pages; not model-only or visitor device memory','intervalSeconds':1,'peakResidentBytes':max((s['residentBytes'] for s in samples),default=0),'samples':samples},indent=2))
    time.sleep(1)
print('Measured Chromium resident memory:',max((s['residentBytes'] for s in samples),default=0),'bytes')
