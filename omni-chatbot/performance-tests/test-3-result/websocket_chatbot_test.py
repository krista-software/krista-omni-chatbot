#!/usr/bin/env python3
"""
Chatbot WebSocket Performance Test  — async edition (httpx HTTP/2 + websockets)

Uses asyncio instead of threading:
  - No GIL contention between concurrent users
  - HTTP/2 multiplexing: all assets over one TCP connection per client
  - Accurate timing with no thread-scheduling noise

Usage:
  python websocket_chatbot_test.py config_chatbot_ep.json
  python websocket_chatbot_test.py config_chatbot_ef4.json
"""

import asyncio
import json
import os
import re
import resource
import ssl
import sys
import time
import uuid
import logging
import urllib3
from urllib.parse import urljoin, quote
from bs4 import BeautifulSoup
import httpx
import websockets
import websockets.exceptions

# websockets < 14 (legacy client) uses extra_headers; >= 14 (asyncio client) uses additional_headers
_WS_MAJOR = int(websockets.__version__.split('.')[0])

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ── File descriptor limit ─────────────────────────────────────────────────────
try:
    _soft, _hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    _target = min(_hard, 65536)
    resource.setrlimit(resource.RLIMIT_NOFILE, (_target, _hard))
    print(f"File descriptor limit: {_soft} → {_target}")
except Exception as _e:
    print(f"Warning: Could not raise FD limit: {_e}")

# ============================================================================
# CONFIGURATION
# ============================================================================
DEFAULT_CONFIG_FILE = "config_chatbot_ep.json"
config_file = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CONFIG_FILE
config_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), config_file)

if not os.path.exists(config_file_path):
    print(f"Error: Config file not found: {config_file_path}")
    sys.exit(1)

with open(config_file_path) as f:
    config = json.load(f)

print(f"Loaded config: {config.get('chatbot_type')} from {config_file}")

extension_url   = config["extension_url"]
routing_id      = config["routing_id"]
initial_message = config["initial_message"]
base_api_url    = f"https://{extension_url}{config['base_api_path']}/{routing_id}"

chatbot_ui_url      = f"{base_api_url}/chatbot/ui"
chatbot_config_url  = f"{base_api_url}/chatbot/config"
chatbot_login_url   = f"{base_api_url}/chatbot/authn/login"
chatbot_session_url = f"{base_api_url}/chatbot/session"
# Pooled-auth now comes from a dedicated endpoint. The inline
# window.__POOLED_AUTH__ block was removed from the /chatbot/ui/ HTML, so the
# SPA fetches a fresh pooled identity from here on boot (200 → {authData, inboxId};
# 204 → pool empty → fall back to login + session).
pool_entry_url      = f"{base_api_url}/chatbot/authn/pool-entry"
websocket_base_url  = f"wss://{extension_url}{config['websocket_path']}/{routing_id}/ws"

REQUEST_TIMEOUT                  = config.get("request_timeout", 120)
user_agent                       = config.get("user_agent", "Mozilla/5.0")
num_users                        = config.get("num_users", 100)
ws_thread_timeout_sec            = config.get("ws_thread_timeout_sec", 100)
max_concurrent_threads           = config.get("max_concurrent_threads", 500)
sleep_sec_after_max_concurrent   = config.get("sleep_sec_after_max_concurrent", 60)
expected_msg_count               = config.get("expected_msg_count", 3)
close_connection_on_expected_msg_reached = config.get("close_connection_on_expected_msg_reached", False)

if num_users is None:
    num_users = int((ws_thread_timeout_sec / sleep_sec_after_max_concurrent) * max_concurrent_threads)

# ── Shared state ──────────────────────────────────────────────────────────────
session_inbox_list = []
thread_timing      = {}
running_threads    = set()

# ── Logging ───────────────────────────────────────────────────────────────────
script_dir  = os.path.dirname(os.path.abspath(__file__))
results_dir = os.path.join(script_dir, 'results')
os.makedirs(results_dir, exist_ok=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
_fh = logging.FileHandler(os.path.join(results_dir, 'logfile.log'), mode='w')
_fh.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(_fh)
logger.propagate = False

# Suppress noisy third-party loggers from the console
for _noisy in ('httpx', 'httpcore', 'hpack', 'websockets'):
    logging.getLogger(_noisy).setLevel(logging.WARNING)
logger.info(f"Total Users: {num_users}")

# ── HTTP headers ──────────────────────────────────────────────────────────────
common_headers = {
    'User-Agent':      user_agent,
    'Accept':          '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer':         f'{chatbot_ui_url}/',
    'Origin':          f'https://{extension_url}',
    'Cache-Control':   'no-cache',
    'Pragma':          'no-cache',
}

# ── SSL for WebSocket ─────────────────────────────────────────────────────────
_ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode    = ssl.CERT_NONE


# ============================================================================
# TIMING DECORATOR  (async)
# ============================================================================
def measure_time(func):
    async def wrapper(*args, **kwargs):
        start        = time.time()
        thread_index = kwargs.get('thread_index', 'main')
        result       = await func(*args, **kwargs)
        elapsed      = time.time() - start
        if thread_index not in thread_timing:
            thread_timing[thread_index] = {}
        sc = result.get('status_code') if isinstance(result, dict) else None
        thread_timing[thread_index][func.__name__] = {'time': elapsed, 'status_code': sc}
        return result
    return wrapper


# ============================================================================
# HTTP HELPERS
# ============================================================================
def _record(timings, resp, url, duration, kind, thread_index):
    filename    = os.path.basename(url) or 'index'
    text_length = len(resp.text)
    status      = resp.status_code
    ctype       = resp.headers.get('content-type', 'unknown')
    logger.info(f"Thread {thread_index}: {kind} Content-Type: {ctype}")
    if status == 200 and text_length > 0:
        logger.info(f"Thread {thread_index}: ✅ Verified {url} (len: {text_length}) in {duration:.2f} sec")
    else:
        logger.error(f"Thread {thread_index}: ❌ {kind} {url} status={status} len={text_length} {duration:.2f}s")
    timings.append({
        f"{filename}_status": status,
        f"{filename}_length": text_length,
        f"{filename}_time":   f"{round(duration, 3)} Sec",
    })


@measure_time
async def get_pooled_auth(client, thread_index=None):
    """
    GET /chatbot/ui/ (+ download all linked assets) → GET /chatbot/authn/pool-entry.
    pool-entry 200 → {authData, inboxId}; 204 → fall back to login + session.
    """
    if thread_index not in thread_timing:
        thread_timing[thread_index] = {}
    timings = []
    result  = {'response': None, 'status_code': None}

    try:
        logger.info(f"Thread {thread_index}: Fetching chatbot UI from: {chatbot_ui_url}/")
        t0 = time.time()
        r  = await client.get(chatbot_ui_url + '/', headers=common_headers)
        _record(timings, r, chatbot_ui_url + '/', time.time() - t0, "html", thread_index)

        if r.status_code != 200:
            result = {'response': None, 'status_code': r.status_code}
            return result

        # Collect asset URLs from HTML <link> tags
        soup = BeautifulSoup(r.text, 'html.parser')
        asset_urls, seen = [], set()
        for tag in soup.find_all('link'):
            href    = tag.get('href', '')
            rel     = tag.get('rel', [])
            as_attr = tag.get('as', '')
            url = None
            if 'modulepreload' in rel and href.endswith('.js'):
                url = urljoin(base_api_url + '/', href)
            elif ('stylesheet' in rel or as_attr == 'style') and href.endswith('.css'):
                url = urljoin(base_api_url + '/', href)
            if url and url not in seen:
                seen.add(url)
                asset_urls.append(url)

        # Fetch assets sequentially with retry on StreamReset (server rate-limits
        # large files under concurrent load; one retry is almost always enough).
        for url in asset_urls:
            for attempt in range(3):
                try:
                    t0 = time.time()
                    r2 = await client.get(url, headers=common_headers)
                    _record(timings, r2, url, time.time() - t0, "dynamic", thread_index)
                    break
                except Exception as e:
                    if attempt < 2:
                        await asyncio.sleep(0.3 * (attempt + 1))
                    else:
                        logger.error(f"Thread {thread_index}: ❌ Exception fetching {url}: {e}")

        # Config API — the SPA fetches GET /chatbot/config on boot (in parallel
        # with pool-entry). Record its timing as the "config" asset so the report
        # can show config API latency separately.
        t0 = time.time()
        cr = await client.get(chatbot_config_url, headers=common_headers)
        _record(timings, cr, chatbot_config_url, time.time() - t0, "api", thread_index)

        # Pooled auth now comes from the dedicated GET /chatbot/authn/pool-entry
        # endpoint (the inline window.__POOLED_AUTH__ block was removed). This
        # mirrors the SPA's real boot flow:
        #   200 → {authData, inboxId} (pool path)
        #   204 → pool empty → fall back to login + session
        t0 = time.time()
        pr = await client.get(pool_entry_url, headers=common_headers)
        _record(timings, pr, pool_entry_url, time.time() - t0, "api", thread_index)

        if pr.status_code == 200:
            auth_data = pr.json()
            logger.info(
                f"Thread {thread_index}: Pooled auth (pool-entry) — "
                f"clientSessionId={auth_data.get('authData', {}).get('clientSessionId')}, "
                f"inboxId={auth_data.get('inboxId')}"
            )
            result = {'response': auth_data, 'status_code': 200}
        elif pr.status_code == 204:
            logger.warning(f"Thread {thread_index}: Pool exhausted (204) — falling back to login/session API")
            login = await chatbot_login(client, thread_index=thread_index)
            if not login['response']:
                result = {'response': None, 'status_code': login['status_code']}
                return result
            ld = login['response']
            sess = await chatbot_session(client, ld['clientSessionId'], thread_index=thread_index)
            if not sess['response']:
                result = {'response': None, 'status_code': sess['status_code']}
                return result
            auth_data = {
                'authData': {
                    'clientSessionId': ld['clientSessionId'],
                    'name':            ld['name'],
                    'accountId':       ld['accountId'],
                },
                'inboxId': sess['response'].strip('"'),
            }
            logger.info(f"Thread {thread_index}: Fallback auth OK — clientSessionId={ld['clientSessionId']}")
            result = {'response': auth_data, 'status_code': 200}
        else:
            logger.error(f"Thread {thread_index}: pool-entry failed: {pr.status_code} {pr.text[:200]}")
            result = {'response': None, 'status_code': pr.status_code}

        return result

    except Exception as e:
        logger.error(f"Thread {thread_index}: ❌ Exception in get_pooled_auth: {e}")
        result = {'response': None, 'status_code': None}
        return result
    finally:
        flat = {}
        for item in timings:
            flat.update(item)
        existing = thread_timing[thread_index].get("ui_file_downloads", {})
        existing.update(flat)
        thread_timing[thread_index]["ui_file_downloads"] = existing


@measure_time
async def download_ui_files(client, thread_index=None):
    """Fetch runtime-loaded assets not in HTML links (i18n only)."""
    timings = []
    url = f"{chatbot_ui_url}/assets/i18n/en.json"
    logger.info(f"Thread {thread_index}: Verifying static file: {url}")
    for attempt in range(3):
        try:
            t0 = time.time()
            r  = await client.get(url, headers=common_headers)
            _record(timings, r, url, time.time() - t0, "static", thread_index)
            break
        except Exception as e:
            if attempt < 2:
                await asyncio.sleep(0.3 * (attempt + 1))
            else:
                logger.error(f"Thread {thread_index}: ❌ Exception fetching {url}: {e}")

    if thread_index not in thread_timing:
        thread_timing[thread_index] = {}
    flat = {}
    for item in timings:
        flat.update(item)
    existing = thread_timing[thread_index].get("ui_file_downloads", {})
    existing.update(flat)
    thread_timing[thread_index]["ui_file_downloads"] = existing
    return {'response': 'done', 'status_code': 200}


@measure_time
async def chatbot_login(client, thread_index=None):
    """Fallback: POST /chatbot/authn/login when pool is exhausted."""
    headers = {
        **common_headers,
        'content-type': 'application/json',
        'source':        'chatbot',
        'Referer':       f'{chatbot_ui_url}/',
    }
    try:
        r = await client.post(chatbot_login_url, headers=headers, json={})
        if r.status_code != 200:
            logger.error(f"Thread {thread_index}: chatbot_login failed: {r.status_code} {r.text}")
            return {'response': None, 'status_code': r.status_code}
        return {'response': r.json(), 'status_code': r.status_code}
    except Exception as e:
        logger.error(f"Thread {thread_index}: chatbot_login exception: {e}")
        return {'response': None, 'status_code': None}


@measure_time
async def chatbot_session(client, device_id, thread_index=None):
    """Fallback: POST /chatbot/session to obtain an inboxId after login."""
    krista_ctx = quote(json.dumps({"clientSessionId": device_id}, separators=(',', ':')))
    headers = {
        **common_headers,
        'accept':             'application/json;charset=UTF-8',
        'content-type':       'application/json;charset=UTF-8',
        'chatbot-session-id': device_id,
        'X-Krista-Context':   krista_ctx,
        'Cookie': (f"chatbotSessionId={device_id}; "
                   f"X-Krista-Context={krista_ctx}; "
                   f"chatbotSessionId={device_id}"),
        'Referer': f'{chatbot_ui_url}/chat',
    }
    try:
        r = await client.post(chatbot_session_url, headers=headers, json={"languageCode": "en"})
        if r.status_code != 200:
            logger.error(f"Thread {thread_index}: chatbot_session failed: {r.status_code} {r.text}")
            return {'response': None, 'status_code': r.status_code}
        return {'response': r.text, 'status_code': r.status_code}
    except Exception as e:
        logger.error(f"Thread {thread_index}: chatbot_session exception: {e}")
        return {'response': None, 'status_code': None}


# ============================================================================
# WEBSOCKET
# ============================================================================
def step_reply():
    return []
    # Uncomment and populate to auto-reply to specific chatbot prompts:
    # return [
    #     {"step_message": "Enter value for sum",
    #      "field_values": {}, "submit_type": "submit", "submit_value": ""},
    # ]


async def _heartbeat(ws, thread_index):
    while thread_index in running_threads:
        try:
            await ws.send(json.dumps({
                "signal":  "ping",
                "payload": {"timestamp": time.time(), "reference": str(uuid.uuid4())}
            }))
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Thread {thread_index} WebSocket is closed. Stopping heartbeat.")
            break
        except Exception as e:
            logger.error(f"Thread {thread_index}: Error sending ping: {e}")
            break
        await asyncio.sleep(5)


async def _close_after(ws, thread_index):
    await asyncio.sleep(ws_thread_timeout_sec)
    logger.info(f"Thread {thread_index}: Closing WebSocket after {ws_thread_timeout_sec}s")
    try:
        await ws.close()
    except Exception:
        pass


async def _handle_messages(ws, thread_index, inbox_id, account_id, user_name):
    received_count    = 0
    previous_msg_time = None
    ws_open_time      = time.time()

    async for raw_msg in ws:
        msg = json.loads(raw_msg)
        if msg['signal'] == 'pong':
            continue

        payload_type = msg['payload']['type']

        if payload_type == 'ConnectionEstablished':
            conn_time = time.time() - ws_open_time
            thread_timing[thread_index]['ws_connection_established_time'] = {
                'time': conn_time, 'status_code': None
            }
            thread_timing[thread_index].setdefault('message_timings', []).append(
                {'Websocket Connection Establish': conn_time}
            )
            previous_msg_time = time.time()

            # Send welcome signal
            await asyncio.sleep(5)
            await ws.send(json.dumps({
                "signal":  "notification",
                "payload": {
                    "type":      "welcome",
                    "timestamp": int(time.time() * 1000),
                    "payload":   {"inboxId": inbox_id},
                }
            }))
            logger.info(f"Thread {thread_index}: WebSocket is connected, Sent the initial message")
            thread_timing[thread_index]['send_initial_message'] = {'time': 0, 'status_code': None}

            # Send conversation start
            await asyncio.sleep(5)
            await ws.send(json.dumps({
                "signal":  "notification",
                "payload": {
                    "type":      "Message",
                    "timestamp": int(time.time() * 1000),
                    "payload": {
                        "inboxId": inbox_id,
                        "message": {
                            "sessionId": inbox_id.replace("inbox_", ""),
                            "id":        "M_" + str(uuid.uuid4()),
                            "inboxId":   inbox_id,
                            "type":      "MessageInform",
                            "sender":    {"id": account_id, "name": user_name},
                            "message":   initial_message,
                        }
                    }
                }
            }))
            logger.info(f"Thread {thread_index}: WebSocket is connected, Sent the Start Conversation message")

        elif payload_type == 'NewMessages':
            current_time   = time.time()
            received_count += 1
            msgs = msg['payload']['payload'].get('messages', [])

            if msgs and msgs[0].get('message') and \
                    msgs[0]['message'] != "Something went wrong: System Fault":
                cnt = thread_timing[thread_index].get('total_messages_count', 0) + 1
                thread_timing[thread_index]['total_messages_count'] = cnt
                logger.info(
                    f"Thread {thread_index}: Message Count - {cnt}: "
                    f"Received message: {raw_msg}"
                )

            if previous_msg_time is not None and msgs:
                diff = current_time - previous_msg_time
                logger.info(f"Thread {thread_index}: Time since previous message: {diff:.2f} Sec")
                thread_timing[thread_index].setdefault('message_timings', []).append(
                    {msgs[0]['message']: diff}
                )

            previous_msg_time = current_time

            # Auto-reply if step_reply list is populated
            if msg['signal'] == 'notification' and msgs:
                p_msg    = msgs[0]
                matching = [s for s in step_reply() if s.get('step_message') == p_msg.get('message')]
                if matching:
                    s = matching[0]
                    await ws.send(json.dumps({
                        "signal":  "notification",
                        "payload": {
                            "type":      "MessageAnswer",
                            "timestamp": int(time.time() * 1000),
                            "payload": {
                                "inboxId": p_msg['inboxId'],
                                "message": {
                                    "targetMessageId": p_msg['id'],
                                    "creationTime":    int(time.time() * 1000),
                                    "submitType":      s['submit_type'],
                                    "submitValue":     s['submit_value'],
                                    "fieldValues":     s['field_values'],
                                }
                            }
                        }
                    }))

            if received_count >= expected_msg_count and close_connection_on_expected_msg_reached:
                await ws.close()
                return


async def open_websocket_connection(client, index):
    start_time = time.time()
    thread_timing[index] = {}

    # ── Auth ──────────────────────────────────────────────────────────────────
    auth_resp = await get_pooled_auth(client, thread_index=index)
    if not auth_resp or not auth_resp.get('response'):
        return
    auth_data         = auth_resp['response']['authData']
    client_session_id = auth_data['clientSessionId']
    user_name         = auth_data['name']
    account_id        = auth_data['accountId']
    inbox_id          = auth_resp['response']['inboxId']

    # ── Runtime assets ────────────────────────────────────────────────────────
    await download_ui_files(client, thread_index=index)

    thread_timing[index]['inbox_id']     = inbox_id
    thread_timing[index]['account_name'] = user_name
    thread_timing[index]['account_id']   = account_id
    session_inbox_list.append({"device_id": client_session_id, "inbox_id": inbox_id})
    logger.info(
        f"Thread {index}: client_session_id:{client_session_id}, "
        f"inbox_id:{inbox_id}, account_id:{account_id}"
    )

    # ── WebSocket ─────────────────────────────────────────────────────────────
    ws_url     = f"{websocket_base_url}?chatbotSessionId={client_session_id}"
    krista_ctx = quote(json.dumps({"clientSessionId": client_session_id}, separators=(',', ':')))
    ws_headers = {
        "Cookie":  (f"chatbotSessionId={client_session_id}; "
                    f"X-Krista-Context={krista_ctx}; "
                    f"chatbotSessionId={client_session_id}"),
        "Origin":     f"https://{extension_url}",
        "User-Agent": user_agent,
    }

    running_threads.add(index)
    ws_connect_start = time.time()

    _hdr_kwarg = {'extra_headers': ws_headers} if _WS_MAJOR < 14 else {'additional_headers': ws_headers}
    try:
        async with websockets.connect(
            ws_url,
            **_hdr_kwarg,
            ssl=_ssl_ctx,
            ping_interval=None,
            open_timeout=REQUEST_TIMEOUT,
        ) as ws:
            logger.info(f"Thread {index}: WebSocket connection opened")
            thread_timing[index]['web_socket_create_time'] = {
                'time': time.time() - ws_connect_start, 'status_code': None
            }
            thread_timing[index]['on_open'] = {'time': 0, 'status_code': None}

            hb_task    = asyncio.create_task(_heartbeat(ws, index))
            close_task = asyncio.create_task(_close_after(ws, index))

            try:
                await _handle_messages(ws, index, inbox_id, account_id, user_name)
            except websockets.exceptions.ConnectionClosed as e:
                code = e.rcvd.code if e.rcvd else None
                logger.info(f"Thread {index}: WebSocket closed — code={code}")
                thread_timing[index]['on_close'] = {'time': 0, 'status_code': code}
            finally:
                hb_task.cancel()
                close_task.cancel()
                try:
                    await hb_task
                except asyncio.CancelledError:
                    pass
                try:
                    await close_task
                except asyncio.CancelledError:
                    pass

    except Exception as e:
        logger.error(f"on_error Thread {index}: {e}")
        thread_timing[index]['on_error'] = {'time': 0, 'status_code': None}
    finally:
        running_threads.discard(index)

    thread_timing[index]['open_websocket_connection'] = {
        'time': time.time() - start_time, 'status_code': None
    }


# ============================================================================
# SUMMARY
# ============================================================================
def print_thread_summary():
    result = []
    for key, values in thread_timing.items():
        row = {
            "Thread index":                   f"Thread {key}",
            "get_pooled_auth time":           f"{values['get_pooled_auth']['time']:.2f} Sec" if values.get('get_pooled_auth') else None,
            "get_pooled_auth status_code":    str(values['get_pooled_auth']['status_code']) if values.get('get_pooled_auth') else None,
            "auth_path":                      "fallback" if values.get('chatbot_login') else "pool",
            "chatbot_login time":             f"{values['chatbot_login']['time']:.2f} Sec" if values.get('chatbot_login') else None,
            "chatbot_login status_code":      str(values['chatbot_login']['status_code']) if values.get('chatbot_login') else None,
            "chatbot_session time":           f"{values['chatbot_session']['time']:.2f} Sec" if values.get('chatbot_session') else None,
            "chatbot_session status_code":    str(values['chatbot_session']['status_code']) if values.get('chatbot_session') else None,
            "inbox_id":                       values.get("inbox_id"),
            "account_name":                   values.get("account_name"),
            "account_id":                     values.get("account_id"),
            "open_websocket_connection time": f"{values['open_websocket_connection']['time']:.2f} Sec" if values.get('open_websocket_connection') else None,
            "web_socket_create_time time":    f"{values['web_socket_create_time']['time']:.2f} Sec" if values.get('web_socket_create_time') else None,
            "web_socket_establish_time time": f"{values['ws_connection_established_time']['time']:.2f} Sec" if values.get('ws_connection_established_time') else None,
            "send_initial_message time":      f"{values['send_initial_message']['time']:.2f} Sec" if values.get('send_initial_message') else None,
            "on_open time":                   f"{values['on_open']['time']:.2f} Sec" if values.get('on_open') else None,
            "on_close time":                  f"{values['on_close']['time']:.2f} Sec" if values.get('on_close') else None,
            "total_messages_count":           str(values['total_messages_count']) if 'total_messages_count' in values else None,
        }

        if values.get('message_timings'):
            for mt in values['message_timings']:
                for msg_key, timing in mt.items():
                    row[f"Message-{msg_key}"] = f"{timing:.2f} Sec"

        ui_files = values.get("ui_file_downloads", {})
        if ui_files:
            grouped = {}
            for k, v in ui_files.items():
                if "_" in k:
                    prefix, metric = k.rsplit("_", 1)
                    grouped.setdefault(prefix, {})[metric] = v
            for prefix, metrics in grouped.items():
                row[f"{prefix}_status"] = metrics.get("status")
                row[f"{prefix}_length"] = metrics.get("length")
                row[f"{prefix}_time"]   = metrics.get("time")

        result.append(row)

    with open(os.path.join(results_dir, "result.json"), "w") as f:
        json.dump(result, f, indent=4)
    with open(os.path.join(results_dir, "session_inbox_list.json"), "w") as f:
        json.dump(session_inbox_list, f, indent=4)
    print(f"Report written: {os.path.join(results_dir, 'result.json')}")


# ── Run once at import to generate empty report if needed ─────────────────────
print_thread_summary()

# ============================================================================
# MAIN
# ============================================================================
if __name__ == "__main__":
    async def run():
        semaphore = asyncio.Semaphore(max_concurrent_threads)

        async def run_user(i):
            async with semaphore:
                # Each user gets its own HTTP/2 connection — prevents StreamReset
                # from too many concurrent streams on a shared connection.
                async with httpx.AsyncClient(
                    http2=True,
                    verify=False,
                    timeout=httpx.Timeout(REQUEST_TIMEOUT),
                    limits=httpx.Limits(max_connections=5, max_keepalive_connections=3),
                ) as client:
                    await open_websocket_connection(client, i)

        tasks = []
        for i in range(num_users):
            tasks.append(asyncio.create_task(run_user(i)))
            await asyncio.sleep(0.1)

            if i % max_concurrent_threads == 0 and i > 0:
                await asyncio.sleep(sleep_sec_after_max_concurrent)
                print_thread_summary()

        await asyncio.gather(*tasks, return_exceptions=True)

        logger.info("========== Test is finished ==========")
        print_thread_summary()

    asyncio.run(run())
