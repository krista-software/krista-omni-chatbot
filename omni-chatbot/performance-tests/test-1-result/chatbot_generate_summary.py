#!/usr/bin/env python3
"""
Chatbot Load Test — Minimal Single-Page Summary
================================================
Run   : python3 chatbot_generate_summary.py
Reads : results/result.json  (produced by websocket_chatbot_test.py)
Writes: results/summary.txt   (plain-text console summary)
        results/summary.html  (clean single-page report, no external deps)

Adapted to the pool-entry boot flow:
  - "Auth Success" is based on get_pooled_auth (200) — it covers BOTH the pool
    path and the login+session fallback path. (The old "Login Success" metric
    only counted fallback logins, which under-reports now that most users
    authenticate via the pool.)
  - A pool-vs-fallback split (from auth_path) shows how often the pool served.
"""
import json
import os
import re
import statistics
from collections import Counter
from datetime import datetime


# ── helpers ───────────────────────────────────────────────────────────────────

def to_sec(val):
    """Parse '1.79 Sec' / 1.79 / None into float seconds or None."""
    if val is None:
        return None
    s = str(val).replace('Sec', '').strip()
    try:
        return float(s)
    except ValueError:
        return None


def is_ok(row, key):
    return str(row.get(key, '')).strip() == '200'


def has_value(v):
    return v is not None and str(v).strip() not in ('', 'None', 'null')


def pctl(sorted_vals, p):
    if not sorted_vals:
        return None
    n = len(sorted_vals)
    if n == 1:
        return sorted_vals[0]
    idx = (n - 1) * p / 100
    lo = int(idx)
    hi = min(lo + 1, n - 1)
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (idx - lo)


def stat_block(rows, key):
    vals = sorted(v for r in rows if (v := to_sec(r.get(key))) is not None)
    if not vals:
        return None
    return {
        'count': len(vals),
        'min': round(vals[0], 3),
        'avg': round(statistics.mean(vals), 3),
        'p50': round(pctl(vals, 50), 3),
        'p90': round(pctl(vals, 90), 3),
        'p95': round(pctl(vals, 95), 3),
        'max': round(vals[-1], 3),
    }


def positional_message_stats(rows):
    """Collapse the per-turn 'Message-<text>' keys to positional 'Message N'."""
    per_row = []
    max_len = 0
    for r in rows:
        msgs = [v for k, v in r.items() if k.startswith('Message-')]
        per_row.append(msgs)
        max_len = max(max_len, len(msgs))
    out = []
    for i in range(max_len):
        vals = sorted(
            s for row in per_row
            if i < len(row) and (s := to_sec(row[i])) is not None
        )
        if vals:
            out.append((f'Message {i + 1}', {
                'count': len(vals),
                'min': round(vals[0], 3),
                'avg': round(statistics.mean(vals), 3),
                'p50': round(pctl(vals, 50), 3),
                'p90': round(pctl(vals, 90), 3),
                'p95': round(pctl(vals, 95), 3),
                'max': round(vals[-1], 3),
            }))
    return out


def load_config(script_dir):
    """Config referenced by the test script's DEFAULT_CONFIG_FILE, else any config*.json."""
    p = os.path.join(script_dir, 'websocket_chatbot_test.py')
    if os.path.exists(p):
        try:
            with open(p) as f:
                m = re.search(r"DEFAULT_CONFIG_FILE\s*=\s*['\"](.+?)['\"]", f.read())
            if m:
                cp = os.path.join(script_dir, m.group(1))
                if os.path.exists(cp):
                    with open(cp) as cf:
                        return json.load(cf)
        except Exception:
            pass
    for name in sorted(os.listdir(script_dir)):
        if name.startswith('config') and name.endswith('.json'):
            try:
                with open(os.path.join(script_dir, name)) as cf:
                    return json.load(cf)
            except Exception:
                pass
    return {}


def load_window(results_dir):
    win = {'start': 'N/A', 'end': 'N/A', 'duration': 'N/A'}
    logfile = os.path.join(results_dir, 'logfile.log')
    if not os.path.exists(logfile):
        return win
    try:
        with open(logfile) as f:
            lines = [l.strip() for l in f if l.strip()]
        pat = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})')
        fmt = '%Y-%m-%d %H:%M:%S'
        start = end = None
        m = pat.match(lines[0]) if lines else None
        if m:
            start = datetime.strptime(m.group(1), fmt)
            win['start'] = start.strftime(fmt)
        for line in reversed(lines):
            m = pat.match(line)
            if m:
                end = datetime.strptime(m.group(1), fmt)
                win['end'] = end.strftime(fmt)
                break
        if start and end:
            sec = int((end - start).total_seconds())
            h, r = divmod(sec, 3600)
            mm, ss = divmod(r, 60)
            win['duration'] = (f'{h}h {mm}m {ss}s' if h else
                               f'{mm}m {ss}s' if mm else f'{ss}s')
    except Exception:
        pass
    return win


# ── analysis ──────────────────────────────────────────────────────────────────

def msg_count(r):
    try:
        return int(str(r.get('total_messages_count', '0')).strip() or '0')
    except ValueError:
        return 0


def auth_ok(r):
    # New flow: get_pooled_auth 200 covers pool + fallback. Fall back to the old
    # chatbot_login field for result.json produced by the legacy test script.
    if 'get_pooled_auth status_code' in r:
        return is_ok(r, 'get_pooled_auth status_code')
    return is_ok(r, 'chatbot_login status_code')


def analyze(rows):
    total = len(rows)

    a_ok = sum(1 for r in rows if auth_ok(r))
    session_ok = sum(1 for r in rows if has_value(r.get('inbox_id')))
    ws_ok = sum(1 for r in rows if to_sec(r.get('web_socket_establish_time time')) is not None)
    conv_ok = sum(1 for r in rows if msg_count(r) > 0)

    pool_count = sum(1 for r in rows if r.get('auth_path') == 'pool')
    fallback_count = sum(1 for r in rows if r.get('auth_path') == 'fallback')

    auth_fail = [r for r in rows if not auth_ok(r)]
    ws_fail = [r for r in rows
               if auth_ok(r) and to_sec(r.get('web_socket_establish_time time')) is None]

    timing = {}
    for label, key in [
        ('Pooled Auth',        'get_pooled_auth time'),
        ('Login (fallback)',   'chatbot_login time'),
        ('Session (fallback)', 'chatbot_session time'),
        ('WS Create',          'web_socket_create_time time'),
        ('WS Establish',       'web_socket_establish_time time'),
    ]:
        s = stat_block(rows, key)
        if s:
            timing[label] = s

    return {
        'total': total,
        'auth_ok': a_ok, 'session_ok': session_ok, 'ws_ok': ws_ok, 'conv_ok': conv_ok,
        'pool_count': pool_count, 'fallback_count': fallback_count,
        'auth_fail': len(auth_fail), 'ws_fail': len(ws_fail),
        'timing': timing,
        'messages': positional_message_stats(rows),
        'msg_dist': dict(sorted(Counter(msg_count(r) for r in rows).items())),
    }


def pct(n, d):
    return f'{(100 * n / d):.1f}%' if d else '0.0%'


# ── text report ─────────────────────────────────────────────────────────────

def render_text(a, cfg, win):
    t = a['total']
    L = []
    L.append('=' * 66)
    L.append(' CHATBOT LOAD TEST — SUMMARY')
    L.append('=' * 66)
    if cfg:
        L.append(f" Host             : {cfg.get('extension_url', 'N/A')}")
        L.append(f" Type             : {cfg.get('chatbot_type', 'N/A')}")
        L.append(f" Total users      : {cfg.get('num_users', 'N/A')}")
        L.append(f" Concurrent users : {cfg.get('max_concurrent_threads', 'N/A')}")
    L.append(f" Test window      : {win['start']} -> {win['end']}  ({win['duration']})")
    L.append(f" Generated        : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    L.append('')
    L.append(' FUNNEL')
    L.append(' ' + '-' * 64)
    L.append(f"   Total threads        : {t}")
    L.append(f"   Auth success         : {a['auth_ok']:>5}  ({pct(a['auth_ok'], t)})")
    L.append(f"   Session created      : {a['session_ok']:>5}  ({pct(a['session_ok'], t)})")
    L.append(f"   WebSocket established : {a['ws_ok']:>5}  ({pct(a['ws_ok'], t)})")
    L.append(f"   Conversation (>=1)   : {a['conv_ok']:>5}  ({pct(a['conv_ok'], t)})")
    L.append('')
    L.append(f"   Auth path: pool={a['pool_count']}  fallback={a['fallback_count']}")
    L.append('')
    L.append(' TIMINGS (seconds)')
    L.append(' ' + '-' * 64)
    L.append(f"   {'Stage':<20}{'count':>7}{'min':>8}{'avg':>8}{'p50':>8}{'p90':>8}{'p95':>8}{'max':>8}")
    for label, s in a['timing'].items():
        L.append(f"   {label:<20}{s['count']:>7}{s['min']:>8}{s['avg']:>8}"
                 f"{s['p50']:>8}{s['p90']:>8}{s['p95']:>8}{s['max']:>8}")
    if a['messages']:
        L.append('')
        L.append('   Chatbot message response times:')
        for label, s in a['messages']:
            L.append(f"   {label:<20}{s['count']:>7}{s['min']:>8}{s['avg']:>8}"
                     f"{s['p50']:>8}{s['p90']:>8}{s['p95']:>8}{s['max']:>8}")
    L.append('')
    L.append(' DROP-OFFS')
    L.append(' ' + '-' * 64)
    L.append(f"   Auth failures        : {a['auth_fail']}")
    L.append(f"   WS-establish failures: {a['ws_fail']}")
    L.append('')
    L.append(' MESSAGES RECEIVED PER USER')
    L.append(' ' + '-' * 64)
    for count, n in a['msg_dist'].items():
        bar = '#' * int(40 * n / t) if t else ''
        L.append(f"   {count:>2} msgs : {n:>5}  {bar}")
    L.append('=' * 66)
    return '\n'.join(L)


# ── html report ─────────────────────────────────────────────────────────────

def render_html(a, cfg, win):
    t = a['total']

    def card(label, ok):
        rate = (100 * ok / t) if t else 0
        color = '#10b981' if rate >= 99 else '#f59e0b' if rate >= 80 else '#ef4444'
        return f"""
        <div class="card">
          <div class="card-lbl">{label}</div>
          <div class="card-val">{ok}<span class="card-of"> / {t}</span></div>
          <div class="bar"><div class="bar-fill" style="width:{rate:.1f}%;background:{color}"></div></div>
          <div class="card-pct" style="color:{color}">{rate:.1f}%</div>
        </div>"""

    cards = (card('Auth Success', a['auth_ok']) +
             card('Session Created', a['session_ok']) +
             card('WebSocket Established', a['ws_ok']) +
             card('Conversation Reached', a['conv_ok']))

    def timing_rows(items):
        out = ''
        for label, s in items:
            out += (f"<tr><td>{label}</td><td>{s['count']}</td><td>{s['min']}</td>"
                    f"<td>{s['avg']}</td><td>{s['p50']}</td><td>{s['p90']}</td>"
                    f"<td>{s['p95']}</td><td>{s['max']}</td></tr>")
        return out

    timing_html = timing_rows(list(a['timing'].items()))
    msg_html = timing_rows(a['messages'])

    drop_html = (f"<tr><td>Auth failures</td><td>{a['auth_fail']}</td></tr>"
                 f"<tr><td>WS-establish failures</td><td>{a['ws_fail']}</td></tr>")

    dist_html = ''
    for count, n in a['msg_dist'].items():
        w = (100 * n / t) if t else 0
        dist_html += (f"<tr><td>{count} msgs</td><td>{n}</td>"
                      f"<td class='barcell'><div class='dbar' style='width:{w:.1f}%'></div></td></tr>")

    cfg_line = ''
    if cfg:
        cfg_line = (f"Host: {cfg.get('extension_url', 'N/A')} &nbsp;·&nbsp; "
                    f"Type: {cfg.get('chatbot_type', 'N/A')} &nbsp;·&nbsp; "
                    f"Total users: <b>{cfg.get('num_users', 'N/A')}</b> &nbsp;·&nbsp; "
                    f"Concurrent users: <b>{cfg.get('max_concurrent_threads', 'N/A')}</b>")

    pool_line = (f"Auth path &nbsp;·&nbsp; pool: <b>{a['pool_count']}</b> &nbsp; "
                 f"fallback: <b>{a['fallback_count']}</b>")

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chatbot Load Test — Summary</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f1f5f9;color:#0f172a;padding:32px 20px;line-height:1.5}}
.wrap{{max-width:920px;margin:0 auto}}
h1{{font-size:20px;margin-bottom:4px}}
.meta{{font-size:13px;color:#64748b;margin-bottom:24px}}
.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:18px}}
.card{{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;box-shadow:0 1px 2px rgba(0,0,0,.05)}}
.card-lbl{{font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}}
.card-val{{font-size:30px;font-weight:700}}
.card-of{{font-size:15px;font-weight:400;color:#94a3b8}}
.bar{{height:6px;background:#e2e8f0;border-radius:3px;margin:10px 0 6px;overflow:hidden}}
.bar-fill{{height:100%;border-radius:3px}}
.card-pct{{font-size:13px;font-weight:600}}
.poolbar{{font-size:13px;color:#475569;margin-bottom:24px}}
.sec{{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 22px;margin-bottom:20px;box-shadow:0 1px 2px rgba(0,0,0,.05)}}
.sec h2{{font-size:15px;margin-bottom:14px}}
table{{width:100%;border-collapse:collapse;font-size:13px}}
th,td{{text-align:right;padding:7px 10px;border-bottom:1px solid #eef2f7}}
th:first-child,td:first-child{{text-align:left}}
th{{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}}
tr:last-child td{{border-bottom:none}}
.barcell{{width:55%}}
.dbar{{height:14px;background:#3b82f6;border-radius:3px}}
.footer{{text-align:center;font-size:12px;color:#94a3b8;margin-top:8px}}
</style></head><body><div class="wrap">
<h1>Chatbot Load Test — Summary</h1>
<div class="meta">{cfg_line}<br>Test window: {win['start']} → {win['end']} ({win['duration']}) &nbsp;·&nbsp; Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>

<div class="cards">{cards}</div>
<div class="poolbar">{pool_line}</div>

<div class="sec">
  <h2>Stage Timings (seconds)</h2>
  <table>
    <thead><tr><th>Stage</th><th>Count</th><th>Min</th><th>Avg</th><th>P50</th><th>P90</th><th>P95</th><th>Max</th></tr></thead>
    <tbody>{timing_html}</tbody>
  </table>
</div>

{f'''<div class="sec">
  <h2>Chatbot Message Response Times (seconds)</h2>
  <table>
    <thead><tr><th>Message</th><th>Count</th><th>Min</th><th>Avg</th><th>P50</th><th>P90</th><th>P95</th><th>Max</th></tr></thead>
    <tbody>{msg_html}</tbody>
  </table>
</div>''' if msg_html else ''}

<div class="sec">
  <h2>Drop-offs</h2>
  <table><tbody>{drop_html}</tbody></table>
</div>

<div class="sec">
  <h2>Messages Received per User</h2>
  <table><tbody>{dist_html}</tbody></table>
</div>

<div class="footer">{t} threads · minimal summary report</div>
</div></body></html>"""


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    results_dir = os.path.join(script_dir, 'results')
    json_path = os.path.join(results_dir, 'result.json')

    if not os.path.exists(json_path):
        print(f'Error: {json_path} not found')
        return
    with open(json_path) as f:
        rows = json.load(f)
    if not rows:
        print('Error: result.json is empty')
        return

    cfg = load_config(script_dir)
    win = load_window(results_dir)
    a = analyze(rows)

    text = render_text(a, cfg, win)
    print(text)

    with open(os.path.join(results_dir, 'summary.txt'), 'w', encoding='utf-8') as f:
        f.write(text + '\n')
    with open(os.path.join(results_dir, 'summary.html'), 'w', encoding='utf-8') as f:
        f.write(render_html(a, cfg, win))

    print(f"\nSaved: {os.path.join(results_dir, 'summary.txt')}")
    print(f"Saved: {os.path.join(results_dir, 'summary.html')}")


if __name__ == '__main__':
    main()
