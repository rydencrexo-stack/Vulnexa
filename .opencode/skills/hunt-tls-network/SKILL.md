---
name: hunt-tls-network
description: TLS / network layer findings — the reality gate (what pays vs best-practice noise), DMARC spoof discipline (swaks Inbox proof, not dig p=none), mTLS header spoof bypass, dangling-CNAME, AXFR, named old-crypto caveats (POODLE/DROWN/FREAK/SWEET32), CAA as recon-only. Use when network-level config findings are candidates. Trigger keywords: TLS, HSTS, DMARC, mTLS, CAA, heartbleed, AXFR, cipher.
---

# TLS & Network Layer — Deep Hunting

## THE REALITY GATE
Most items here are Info/Low and routinely rejected as "best-practice noise." **Only file:**
1. Dangling-CNAME takeover with canary served (High; Critical at OAuth/SSO or shared `.target.com` cookies).
2. Spoofable DMARC *proven by delivered-to-inbox email*.
3. AXFR returning internal hosts (Medium).
4. mTLS bypass reaching authed functionality.
5. Live Heartbleed with key/cookie dump.

## What Does NOT Pay Standalone
Missing CAA (absence does not enable issuance — attacker still needs DCV control); missing HSTS without downgrade-capture PoC; weak-cipher support without a decrypt; missing headers alone; TLS 1.0/1.1 without a victim.

## Old-Crypto Caveats
POODLE needs SSLv3 actually enabled (modern OpenSSL dropped `-ssl3`); DROWN needs SSLv2 on *some* host sharing the cert/key (scan SANs); FREAK needs export-grade RSA; SWEET32 practically undemonstrable remotely.

## DMARC Spoof Discipline
`dig` reading `p=none` = Info, do not file. Spoofability is a receiver decision — the only proof is a `swaks`-sent mail `From: CEO <ceo@target.com>` landing in a real **Inbox** (not Spam) with `Authentication-Results:` showing dmarc fail/none yet delivered.

## mTLS Bypass
Edge terminates mTLS and forwards verdict as a header backend trusts — if not stripped, spoof `X-SSL-Client-Verify: SUCCESS` + `X-SSL-Client-S-DN: CN=admin`, `X-Forwarded-Client-Cert: By=spiffe://x;...`. Validate you reached *authenticated-only* data (403→200 flip), not a generic 200.

## CAA Is Recon-Only
`issue`/`issuewild` values reveal the CA/ACME automation — useful for where a real takeover could mint certs via DCV, never a finding itself.