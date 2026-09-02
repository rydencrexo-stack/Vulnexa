---
name: hunt-saml
description: SAML / SSO assertion security — XML Signature Wrapping (XSW), comment injection in NameID (C14N stripping), signature stripping, XXE in assertion, encoding details (POST=raw base64, Redirect=DEFLATE), NameID manipulation, replay/audience confusion, parser-differential CVEs (GitHub CVE-2025-25291). Use when SAMLResponse in POST bodies, SAML endpoints, or SSO flows exist. Trigger keywords: SAML, SAMLResponse, XSW, signature wrapping, assertion, NameID, SSO bypass.
---

# SAML / SSO Assertion — Deep Hunting

## THE GATE
- **XSW (XML Signature Wrapping)**: signer validates a benign `<Assertion ID="legit">`; inject sibling `<Assertion ID="evil">` with attacker NameID FIRST — signature still covers #legit, app processes first assertion found.
- **Parser differentials**: two parsers, same XPath → different nodes (GitHub CVE-2025-25291/292).

## Comment Injection in NameID
Register `admin@company.com.evil.com`, submit `<NameID>admin@company.com<!---->.evil.com</NameID>`. Signer's C14N-without-comments strips comment → signs "admin@company.com.evil.com"; app's text extraction reads up to comment → "admin@company.com" — signed identity ≠ evaluated identity. (CVE-2017-11428, CVE-2016-5697.)

## Signature Stripping
Delete entire `<Signature>` element, change NameID to `admin@company.com`, re-encode.

**Encoding detail**: POST binding = raw base64 NO compression; Redirect binding = DEFLATE (not gzip).

## XXE in Assertion
`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>` with `<NameID>&xxe;</NameID>` → file read/SSRF when parser lacks `disallow-doctype-decl`.

## NameID Manipulation
`admin@company.com`, `administrator@company.com`, `${7*7}` (SSTI if rendered).

## Replay / Audience Confusion
Same assertion accepted twice within validity window; audience-restriction not validated → assertion intended for IdP-A accepted by SP-B.

## Workflow
base64 → xmllint → edit → `base64 -w0` → URL-encode before sending as `SAMLResponse`.

## Detection
`/saml/acs`, `/Shibboleth.sso`, `/sso/saml/`, `/auth/saml/callback`, ADFS endpoints.

## Validation
ATO via altered NameID or admin role via altered AttributeStatement — the auth-decision-changing step is the gate; modifying display-name/locale is Informational.

## Triage
XSW = Critical, sig stripping = Critical, comment injection = High, XXE = High, NameID manip = Medium/High. SAML-fronted OAuth issuers turn assertion bugs into token-level ATO.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: saml — 52 disclosed H1 reports (18 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `tgname`
- `email`
- `remember_me`
- `AAAAAAVVAacibcMeQaa-JKcUyH-R0itjt2o5kIUgVaclQb7SjFgL4eFSChKpRUFWw5I6mpFBaG331jUn5d3UQLI_WQvnxl7pF0SjzIKjWb9DdUnLhg`
- `feature`
- `configUrl`
- `format`
- `a0`
- `a1`
- `a2`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Remotely trigger an assertion on a TLS server with a malformed certificate string** (Improper Certificate Validation)
  - Signal: **Summary:** Connecting to a NodeJS TLS server with a client certificate that has a type 19 string in its subjectAltName will crash the TLS server if it tries to read the peer cert
- **[critical] [meemo-app] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `meemo-app` module. It allows a malicious attacker to send a crafted input that is interpreted as an 
- **[critical] [cloudron-surfer] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `cloudron-surfer` module. It allows a malicious attacker to send a malformed input that is interprete
- **[critical] Buffer overrun in Steam SILK voice decoder** (Classic Buffer Overflow)
  - Signal: #Vulnerability The SteamWorks SDK has a function available named [DecompressVoice()](https://partner.steamgames.com/doc/api/ISteamUser#DecompressVoice), which takes as input some c

