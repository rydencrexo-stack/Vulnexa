---
name: hunt-ntlm
description: NTLM / AD topology discovery — anonymous Type-1 → Type-2 challenge capture, keep-alive raw socket discipline (one-shot curl never receives Type-2), AV_PAIR decode (NetBIOS/DNS/forest tree), default-hostname signal, clock-sync → golden-ticket intel, IIS Extended Protection, probe paths, severity/chain guidance. Use when WWW-Authenticate: NTLM/Negotiate appears or Microsoft endpoints are present. Trigger keywords: NTLM, Negotiate, Type-2 challenge, AV_PAIR, AD domain, forest topology.
---

# NTLM & AD Topology — Deep Hunting

## THE GATE — Anonymous Type-1 → Type-2 capture
Send `Authorization: NTLM TlRMTVNTUAABAAAAB4IIogAAAAAAAAAAAAAAAAAAAAAGAbEdAAAADw==` (negotiates UNICODE|OEM|NTLM|SIGN|KEY_EXCH|56|128|TARGET_INFO; OS field = Win7 build 7601, accepted by virtually every responder).

## CRITICAL: Keep-Alive Raw Socket
Most HTTP libraries close the connection between Type-1 send and Type-2 reception. Use Burp Repeater with `Connection: keep-alive`, Burp `send_http1_request`, or Python raw socket + `ssl.wrap_socket`.

## AV_PAIR Decode (from Type-2)
AvId 1=NetBIOS Computer Name, 2=NetBIOS Domain, 3=DNS Computer FQDN, 4=DNS Domain (AD domain), 5=DNS Tree (forest root), 7=Timestamp (FILETIME), 9=Target Name.

## Signals
- `WIN-XXXXXXXXXXX` default hostname = never renamed post-install → lazy provisioning → likely default service-account passwords.
- Forest topology: DNS Tree `customer.parent-corp.example` reveals a child domain inside corporate global AD (cross-trust risk).
- Timestamp within ~5s of `Date:` header = synced clock → Kerberos golden-ticket intel.
- IIS Extended Protection `None` (default) sends challenge to any anonymous client; `Required` mitigates.

## Probe Paths
`/_api/web/CurrentUser`, `/_vti_bin/*.asmx`, `/EWS/Exchange.asmx`, `/Autodiscover/Autodiscover.xml`, `/Microsoft-Server-ActiveSync`, `/PowerShell`.

## Detection
`WWW-Authenticate: NTLM` / `Negotiate`; headers `Microsoft-IIS/*`, `Microsoft-HTTPAPI/2.0`.

## Validation & Severity
Leak is synchronous (Collaborator NOT needed); reproducible in <5 min. Internet-exposed + default hostname + corporate-AD-tree = Medium; intranet-only = Informational; combine with `Authentication.asmx` brute endpoint = Critical chain.

## Common Mistakes
One-shot curl that never receives Type-2; reporting intranet leaks (intended NTLM behavior); not checking program scope acceptance of info-disclosure findings.