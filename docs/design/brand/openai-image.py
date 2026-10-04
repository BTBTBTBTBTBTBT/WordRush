#!/usr/bin/env python3
"""Paid OpenAI image API helper (founder-authorized 10-03, HARD CAP in CAP_USD). Every call is logged to
API-SPEND-2026-10-03.md with model / size / quality / tokens / cost (from the response's usage at the
model's list prices); the cap is checked against that log BEFORE each call. Billing / quota errors stop.
The key is read from ~/.wordocious-openai-key and never printed.

  python3 openai-image.py gen  out.png "prompt" [--size 1536x1024] [--quality medium]
  python3 openai-image.py edit out.png "prompt" ref1.png [ref2.png ...] [--size ...] [--quality ...] [--fidelity high]
"""
import base64, datetime, os, re, sys
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, 'API-SPEND-2026-10-03.md')
MODEL = 'gpt-image-1'
CAP_USD = 10.0
STOP_AT = 8.5
# gpt-image-1 list prices, USD per 1M tokens
PRICE = {'text_in': 5.0, 'image_in': 10.0, 'image_out': 40.0}


def spent():
    if not os.path.exists(LOG):
        return 0.0
    return sum(float(m) for m in re.findall(r'\| \$([0-9.]+) \|\s*$', open(LOG).read(), re.M))


def log(kind, out, size, quality, usage, cost, note=''):
    new = not os.path.exists(LOG)
    with open(LOG, 'a') as f:
        if new:
            f.write('# OpenAI image API spend — 2026-10-03 (founder-authorized, hard cap $%.0f)\n\n' % CAP_USD)
            f.write('Prices (gpt-image-1, per 1M tokens): text in $5, image in $10, image out $40. Cost = from each response\'s usage.\n\n')
            f.write('| time | call | model | size | quality | output | tokens (text in / image in / out) | cost |\n|---|---|---|---|---|---|---|---|\n')
        f.write('| %s | %s | %s | %s | %s | %s | %s | $%.4f |\n' % (
            datetime.datetime.now().strftime('%H:%M:%S'), kind + (' ' + note if note else ''), MODEL, size, quality,
            os.path.relpath(out, HERE), usage, cost))


def main():
    args = sys.argv[1:]
    opts = {'--size': '1536x1024', '--quality': 'medium', '--fidelity': ''}
    for k in list(opts):
        if k in args:
            i = args.index(k); opts[k] = args[i + 1]; del args[i:i + 2]
    kind, out, prompt, refs = args[0], args[1], args[2], args[3:]
    s = spent()
    if s >= STOP_AT:
        sys.exit(f'STOP: ${s:.2f} spent (stop at ${STOP_AT})')
    key = open(os.path.expanduser('~/.wordocious-openai-key')).read().strip()
    h = {'Authorization': 'Bearer ' + key}
    common = {'model': MODEL, 'prompt': prompt, 'size': opts['--size'], 'quality': opts['--quality'],
              'background': 'transparent', 'output_format': 'png', 'n': 1}
    if kind == 'gen':
        r = requests.post('https://api.openai.com/v1/images/generations', headers=h, json=common, timeout=300)
    else:
        if opts['--fidelity']:
            common['input_fidelity'] = opts['--fidelity']
        files = [('image[]', (os.path.basename(p), open(p, 'rb'), 'image/png')) for p in refs]
        r = requests.post('https://api.openai.com/v1/images/edits', headers=h, data={k: str(v) for k, v in common.items()},
                          files=files, timeout=300)
    if r.status_code != 200:
        err = r.json().get('error', {}) if r.headers.get('content-type', '').startswith('application/json') else {}
        msg = f"HTTP {r.status_code}: {err.get('code')} {err.get('type')} {err.get('message', r.text[:200])}"
        if r.status_code in (402, 429) or any(w in msg.lower() for w in ('billing', 'quota', 'insufficient', 'credit')):
            sys.exit('BILLING/QUOTA STOP — ' + msg)
        sys.exit(msg)
    d = r.json()
    u = d.get('usage', {})
    det = u.get('input_tokens_details', {})
    ti, ii, oo = det.get('text_tokens', 0), det.get('image_tokens', 0), u.get('output_tokens', 0)
    cost = (ti * PRICE['text_in'] + ii * PRICE['image_in'] + oo * PRICE['image_out']) / 1e6
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, 'wb').write(base64.b64decode(d['data'][0]['b64_json']))
    log(kind, os.path.abspath(out), opts['--size'], opts['--quality'], f'{ti} / {ii} / {oo}', cost)
    print(f'{out}  ${cost:.4f}  total ${spent():.4f}')


if __name__ == '__main__':
    main()
