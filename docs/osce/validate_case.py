#!/usr/bin/env python3
"""Check an OSCE case package. Usage: python3 validate_case.py case.json [images_dir]
Prints ERROR lines (must fix) and WARN lines (review). Exit code 1 if any ERROR."""
import json, os, re, sys

path = sys.argv[1]
img_dir = sys.argv[2] if len(sys.argv) > 2 else None
errors, warns = [], []
E = lambda m: errors.append(m)
W = lambda m: warns.append(m)

try:
    pkg = json.load(open(path, encoding='utf-8'))
except Exception as ex:
    print('ERROR: not valid JSON:', ex); sys.exit(1)

cases = pkg.get('cases') or []
if len(cases) != 1:
    E(f'expected exactly 1 case, found {len(cases)}')
c = cases[0] if cases else {}
doc = c.get('case_data') or {}
slug = c.get('slug', '')
if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', slug):
    E(f'slug "{slug}" must be lower-case kebab-case')
stype = c.get('station_type')
if stype not in ('short', 'long'):
    E('station_type must be short or long')
if c.get('difficulty') not in ('core', 'intermediate', 'advanced'):
    E('difficulty must be core, intermediate or advanced')

def count(name, items, lo, hi):
    n = len(items)
    if n < lo or n > hi:
        W(f'{name}: {n} (expected {lo} to {hi})')

ABSENT = re.compile(r"\b(no [a-z\- ]{0,30}(is|are|was|were) (seen|present|found|visible)|not present|is absent|are absent|there is no|there are no|without (any )?(obvious|gross|convincing)|no convincing|in this teaching case|not expected in this)\b", re.I)

if stype == 'long':
    secs = doc.get('sections') or []
    count('history sections', secs, 7, 9)
    for s in secs:
        count(f'exchanges in "{s.get("title")}"', s.get('exchanges') or [], 4, 10)
    count('differentials', doc.get('differentials') or [], 4, 6)
    count('viva questions', (doc.get('practice') or {}).get('questions') or [], 6, 12)
    count('checklist sections', (doc.get('practice') or {}).get('checklist') or [], 4, 7)
else:
    scenes = doc.get('scenes') or []
    signs = doc.get('signs') or []
    chain = doc.get('chain') or []
    sids = [s.get('id') for s in scenes]
    gids = [s.get('id') for s in signs]
    for label, ids in (('scene', sids), ('finding', gids)):
        dup = {i for i in ids if ids.count(i) > 1}
        if dup: E(f'duplicate {label} ids: {sorted(dup)}')
    if 'body' not in sids: E('there is no "body" scene')
    count('region scenes', [s for s in scenes if s.get('id') != 'body'], 5, 8)
    count('findings', signs, 16, 24)
    count('mechanism steps', chain, 5, 8)
    count('investigations', doc.get('investigations') or [], 6, 10)
    count('treatment groups', doc.get('treatment') or [], 3, 4)
    pr = doc.get('practice') or {}
    count('checklist sections', pr.get('checklist') or [], 5, 7)
    count('viva questions', pr.get('questions') or [], 8, 12)
    sm = doc.get('summary') or {}
    count('keyPoints', sm.get('keyPoints') or [], 5, 8)
    count('osceTips', sm.get('osceTips') or [], 5, 8)
    if doc.get('sounds'): E('"sounds" must be empty; recordings are attached by hand')

    reach = {}
    for sc in scenes:
        sid = sc.get('id')
        if sc.get('slot_key') != f'scene:{sid}': E(f'scene {sid}: slot_key should be scene:{sid}')
        hs = sc.get('hotspots') or []
        if sid != 'body' and len(hs) < 2: W(f'scene {sid}: only {len(hs)} hotspot(s); region scenes need 2 or more')
        seen_t = set()
        for i, h in enumerate(hs):
            x, y = h.get('x'), h.get('y')
            if not (isinstance(x, (int, float)) and isinstance(y, (int, float)) and 0 <= x <= 1 and 0 <= y <= 1):
                E(f'scene {sid} hotspot {i}: x,y must be numbers from 0 to 1 (got {x},{y})')
            tt, tid = h.get('target_type'), h.get('target_id')
            if tt == 'scene':
                if tid not in sids: E(f'scene {sid} hotspot "{h.get("label")}" targets missing scene {tid}')
                if sid != 'body': E(f'scene {sid}: only the body scene may open a region')
            elif tt == 'sign':
                if tid not in gids: E(f'scene {sid} hotspot "{h.get("label")}" targets missing finding {tid}')
                if sid == 'body': E('the body scene may only open regions, not findings')
                reach[tid] = reach.get(tid, 0) + 1
            else:
                E(f'scene {sid} hotspot {i}: bad target_type {tt}')
            if (tt, tid) in seen_t: E(f'scene {sid}: two hotspots point at {tid}')
            seen_t.add((tt, tid))
        stacked = []
        for a in range(len(hs)):
            for b in range(a + 1, len(hs)):
                try:
                    if abs(hs[a]['x'] - hs[b]['x']) < 0.04 and abs(hs[a]['y'] - hs[b]['y']) < 0.04:
                        stacked.append((hs[a].get('label'), hs[b].get('label')))
                except Exception:
                    pass
        if stacked:
            E(f'scene {sid}: {len(stacked)} pair(s) of hotspots are stacked at the same place, for example "{stacked[0][0]}" and "{stacked[0][1]}". Spread them out')
        brief = sc.get('brief', '')
        if sid != 'body' and not brief.startswith('FRAMING:'): W(f'scene {sid}: brief should start with "FRAMING:"')
        if sid != 'body' and re.search(r'full[- ]length|full patient|whole patient', brief, re.I): E(f'scene {sid}: brief asks for the whole patient; only scene:body may')

    sign_scene = {}
    for sg in signs:
        i = sg.get('id')
        if sg.get('scene_id') == 'body' or sg.get('scene_id') not in sids: E(f'finding {i}: scene_id "{sg.get("scene_id")}" must be a REGION scene, never body')
        if i not in reach: E(f'finding {i} is not reachable from any hotspot')
        if sg.get('media_slot') != f'sign:{i}': E(f'finding {i}: media_slot should be sign:{i}')
        if sg.get('method') not in ('inspection', 'palpation', 'percussion', 'auscultation', 'symptom'): E(f'finding {i}: bad method')
        if sg.get('region') not in ('head', 'neck', 'chest', 'abdomen', 'groin', 'hands', 'legs', 'general'): E(f'finding {i}: bad region')
        for k in ('what', 'how', 'why'):
            if not str(sg.get(k, '')).strip(): E(f'finding {i}: {k} is empty')
        how = str(sg.get('how', ''))
        if 'Normal:' not in how or 'Pitfall:' not in how: W(f'finding {i}: "how" should contain "Normal:" and "Pitfall:"')
        if ABSENT.search(str(sg.get('what', '')) + ' ' + how[:200]): E(f'finding {i}: text says the sign is ABSENT; every finding must be present in this patient')
        b = sg.get('brief', '')
        if b and not b.startswith('FRAMING:'): W(f'finding {i}: brief should start with "FRAMING:"')
        if b and re.search(r'full[- ]length|whole patient|same \d+-year-old', b, re.I): E(f'finding {i}: brief pulls in the whole patient; describe only the crop')
        if sg.get('compare') and sg['compare'].get('media') != f'sign:{i}-normal': E(f'finding {i}: compare.media should be sign:{i}-normal')
    if sum(1 for s in signs if s.get('compare')) < 4: W('fewer than 4 findings have a "compare" normal picture')
    techs = {s.get('method') for s in signs}
    for t in ('inspection', 'palpation'):
        if t not in techs: W(f'no {t} findings at all')
    regs = {s.get('region') for s in signs}
    if 'legs' not in regs: W('no findings in the legs region; check whether oedema, bruising or wasting apply')

    steps = [s.get('step') for s in chain]
    if steps != list(range(1, len(chain) + 1)): E(f'chain steps must be 1..{len(chain)} in order, got {steps}')
    for s in chain:
        if s.get('media') != f'chain:{s.get("step")}': E(f'chain step {s.get("step")}: media should be chain:{s.get("step")}')
    con = sm.get('connect') or {}
    if isinstance(con, dict):
        for k, v in con.items():
            if k not in gids: E(f'connect: unknown finding {k}')
            if v not in steps: E(f'connect: {k} points at missing step {v}')
        miss = [g for g in gids if g not in con]
        if miss: W(f'findings with no mechanism link (fine only if no step really explains them): {miss}')
    else:
        E('summary.connect must be an object of finding id to step number')

    # checklist / tips / viva mention signs that must exist
    text = ' '.join(json.dumps(pr.get('checklist') or []).lower().split())
    for kw in ('asterixis', 'spider naevi', 'clubbing', 'jvp', 'oedema', 'splenomegaly', 'hepatomegaly', 'apex', 'heave', 'murmur', 'crackles', 'caput', 'ascites', 'jaundice'):
        if kw in text and not any(kw.split()[0] in (s.get('name', '') + s.get('id', '')).lower() for s in signs):
            W(f'the checklist mentions "{kw}" but no finding is named for it')

    # pictures
    if img_dir:
        slots = {sc.get('slot_key') for sc in scenes} | {s.get('media_slot') for s in signs} | {s.get('media') for s in chain}
        slots |= {s['compare']['media'] for s in signs if s.get('compare')}
        slots = {x for x in slots if x}
        have = {}
        for f in os.listdir(img_dir) if os.path.isdir(img_dir) else []:
            stem, ext = os.path.splitext(f)
            if ext.lower() in ('.jpg', '.jpeg', '.png', '.webp'): have[stem] = os.path.join(img_dir, f)
        try:
            from PIL import Image
        except Exception:
            Image = None; W('Pillow not installed: image ratio check skipped (pip install pillow)')
        for slot in sorted(slots):
            stem = slot.replace(':', '-')
            if stem not in have:
                (E if slot.startswith('scene:') else W)(f'missing picture for {slot} (expected {stem}.jpg/.png/.webp)'); continue
            fp = have[stem]
            if os.path.getsize(fp) > 6 * 1024 * 1024: E(f'{stem}: larger than 6 MB')
            if Image:
                w, h = Image.open(fp).size
                want = 3 / 4 if slot == 'scene:body' else 4 / 3
                if abs(w / h - want) > 0.03: E(f'{stem}: ratio {w}x{h} is wrong (want {"3:4" if slot == "scene:body" else "4:3"})')
        extra = set(have) - {s.replace(':', '-') for s in slots}
        if extra: W(f'pictures with no matching slot: {sorted(extra)}')

for m in errors: print('ERROR:', m)
for m in warns: print('WARN: ', m)
print(f'\n{len(errors)} error(s), {len(warns)} warning(s)')
sys.exit(1 if errors else 0)
