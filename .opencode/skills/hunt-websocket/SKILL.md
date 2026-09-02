---
name: hunt-websocket
description: WebSocket security hunting — CSWSH (cross-site WebSocket hijacking) requires all 3 conditions, per-connection token test, no per-message auth, socket.io protocol specifics (Engine.IO v4, 40/42 packets, namespace joins), SignalR/Phoenix authz, handshake upgrade smuggling, ReDoS via extensions. Use when WS/wss endpoints, socket.io, SignalR, or Phoenix channels are detected. Trigger keywords: websocket, CSWSH, socket.io, cross-site WebSocket, wss, SignalR.
---

# WebSocket Security — Deep Hunting

## THE GATE
CSWSH requires **all three**: ambient-cookie handshake + no per-connection token (URL/sub-protocol/first frame) + no Origin enforcement. A foreign-Origin 101 is only a candidate — many servers accept then close at the message layer. Real PoC: attacker-origin page, *different* victim account logged in, unique marker in subscribe frame, exfil received data to Collaborator. **Per-connection token present ⇒ not cross-site exploitable.**

## High-Value Chains
CSWSH + token in stream → ATO (Critical); no per-message auth (`{"action":"deleteUser"}` as low-priv); message tampering (price/amount/userId — must persist server-side, not UI echo); socket.io namespace/room authz bypass.

## socket.io Protocol Specifics
Engine.IO v4 packet `4`=MESSAGE wrapping socket.io `0`=CONNECT; join namespace with `40/admin,` (NOT `?nsp=` — silently ignored); `42`=MESSAGE+EVENT for room joins like `42/admin,["join",{"room":"user_999_private"}]`. A `40` ack without subsequent data is an open-but-empty namespace — require receiving another user's `42` events. SignalR: negotiate → hub Invoke method-level authz. Phoenix: `phx_join` topic authz.

## Handshake Upgrade Smuggling
Once upgraded, WS frames are never re-parsed as HTTP. The bug lives at the handshake — e.g. `Sec-WebSocket-Version: 777` → origin replies 426 while proxy already "upgraded" and tunnels raw bytes → smuggle HTTP past WAF. Drive via Burp HTTP Request Smuggler; validate desync + OAST-confirmed impact.

## ReDoS / DoS
Crafted `Sec-WebSocket-Extensions` (CVE-2020-7662); handshake header floods (CVE-2024-37890).

## Reject
101 alone; accepted-but-ignored frames; self-echoes; connected-but-empty namespaces.

## PARAMETER COVERAGE — every message key, every channel/room (MANDATORY)
The #1 miss: testing only the first `action`/`method` field of one message and
skipping the rest. WS authz bugs hide in EVERY message field and EVERY channel/
room/namespace the app exposes.

1. **Enumerate** every channel/room/namespace (socket.io `nsp`, SignalR hub
   methods, Phoenix topics), and for each, the FULL message shape: `action`/
   `method`/`type`, object IDs (`user_id`, `room_id`, `message_id`), room/topic
   joins, and every nested payload key.
2. **Per-message authz sweep on EACH action**: send admin/user-deleting/
   money/private-room actions as low-priv, on EVERY channel — no per-message
   auth = the finding (must persist server-side, not UI echo).
3. **IDOR via message fields**: swap object IDs in subscribe/join/read frames
   to enter other users' private rooms/namespaces.
4. **CSWSH**: for EVERY WS endpoint, test all three conditions (ambient
   cookie, no per-connection token, no Origin enforcement) with attacker-origin
   page + victim session + unique marker in subscribe frame + OOB exfil.
5. **Handshake**: tamper `Sec-WebSocket-Version`, sub-protocols, extensions
   (ReDoS CVE-2020-7662), and test upgrade-smuggling per handshake surface.
6. **Re-sweep per auth context** and per namespace.
7. **Track** `endpoint → channel → field → result` in the journal; every
   unlogged field/channel = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: websocket — 45 disclosed H1 reports (19 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `id`
- `access_token`
- `EIO`
- `transport`
- `WOPISrc`
- `compat`
- `deviceId`
- `flowBeginTime`
- `flowId`
- `broker`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Denial of Service by resource exhaustion CWE-400 due to unfinished HTTP/1.1 requests** (Uncontrolled Resource Consumption)
  - Signal: **Summary:** Node.js is vulnerable to HTTP denial of service (DOS) attacks based on delayed requests submission which can make the server unable to accept new connections. **Descri
- **[critical] Account takeover via XSS** (Cross-site Scripting (XSS) - Stored)
  - Signal: **Summary:** By combining AutoLinker and Markdown an attacker is able to inject malicious scripts. **Description:** By combining AutoLinker and Markdown we can trick the parser int
- **[critical] XSS in steam react chat client** (Cross-site Scripting (XSS) - Stored)
  - Signal: The Steam chat client both sends and receives bbcode format chat messages. These map to HTML elements, and notably the [url] bbcode tag is supported for arbitrary URLs. React has s
- **[critical] [uchat.uberinternals.com] Mattermost doesn't check Origin in Websockets, which leads to the Critical Inforamation Leakage.** (Cross-Site Request Forgery (CSRF))

