---
name: hunt-m365
description: Microsoft 365 / Entra ID attack — AADSTS code oracle (which codes mean valid password), OneDrive personal-site user enum (no lockout risk), functional/shared-mailbox MFA-exempt class, the 50076 access_token substring trap, serial-not-parallel anti-spray discipline, Smart Lockout math, CA bypass menu (per-app client_ids, FOCI, geo-VPN). Use when Microsoft login, autodiscover, or Entra tenant endpoints are in scope. Trigger keywords: Microsoft 365, Entra ID, Azure AD, AADSTS, OneDrive enum, spray, password oracle.
---

# Microsoft 365 / Entra ID — Deep Hunting

## THE GATE — AADSTS Code Oracle (memorize)
`{53003, 50076, 50079, 50158, 530003}` all mean **password is valid** — MS only returns them post-credential-validation. 50053 = locked (pre-existing if cap=1), 50126 = wrong pw (+1 counter), 50034 = no user (no counter), 700016/90002 = wrong tenant.

## OneDrive Personal-Site User Enum (still works)
`GET /personal/<user>_<domain>_com/_layouts/15/onedrive.aspx` on `<tenant>-my.sharepoint.com` — 302/200→exists, 404→doesn't; zero auth attempts, zero lockout impact; ~40ms vs ~600ms timing oracle. Cross-ref OneDrive 200/404 with ROPC codes to classify licensed vs **functional/shared-mailbox accounts (404+50126)** — the MFA-exempt class prime for password guessing (`noreply@`, `purchase@`, `postmaster@`).

## CRITICAL TRAP
AADSTS50076 error bodies contain the literal substring `"access_token"` inside the CA `claims` challenge JSON — substring matching false-positives every MFA-blocked attempt as token issuance. Always parse JSON and check `"access_token" in parsed_dict`.

## Never Parallelize
Entra's IP-reputation anti-spray trips on concurrency → mass false AADSTS50053 (observed: 183 in 15s at 12 threads vs 1 across 454 paced). Serial + 1.5–5s jitter; hard cap ≤2 attempts/user; atomic state file.

## Smart Lockout Math
1 attempt/user can't cause lockout (1<10) → any 50053 is pre-existing → **active-attacker detection finding** (cluster locked users alphabetically; diff locks over session).

## CA Bypass Menu
Per-app client_ids (Graph PS `1b730954-1685-4b74-9bfd-dac224a7b894`, Azure CLI `04b07795-8ddb-461a-bbee-02f9e1bf7b46`, Office `d3590ed6-52b3-4102-aeff-aad2292ab01c`), FOCI refresh-token cross-client, geo-VPN; universal-CA tenants defeat all — phishing cookie-steal is the only realistic path.

## Key Commands
```
POST https://login.microsoftonline.com/common/oauth2/token  (resource=graph.windows.net, grant_type=password)
GET /personal/u_domain_com/_layouts/15/onedrive.aspx  Host: <tenant>-my.sharepoint.com
SAML flow via Playwright → detect "convergedconditionalaccess"/53003
```

## Validation
JSON parse + key check, not substring; prove CA-block with `ConvergedConditionalAccess` page screenshot; 3 deliverables: JSONL attempt log, per-user atomic tracker, IP rotation log.

## Common Mistakes
Concurrency; retrying locked accounts; substring `access_token` matching; testing only one tenant of a multi-tenant org; retracting CA-block findings (the password IS correct).

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: enumeration — 429 disclosed H1 reports (142 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `url`
- `_pageLabel`
- `name`
- `scope`
- `email`
- `id`
- `content`
- `password`
- `rcnum`
- `defid`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Attacker can add arbitrary data to the blockchain without paying gas** (Deserialization of Untrusted Data)
  - Signal: **Summary:** Due to a missing sanity check in Transaction::rlpParse, an attacker can append arbitrary RLP-encoded data to the end of an otherwise valid transaction, and that data w
- **[critical] Project Template functionality can be used to copy private project data, such as repository, confidential issues, snippets, and merge requests** (Privilege Escalation)
  - Signal: I've found a three minor vulnerabilities which, when combined, allow an attacker to copy private repositories, confidential issues, private snippets, and then some. I'll go through
- **[critical] RCE via the DecompressedArchiveSizeValidator and Project BulkImports (behind feature flag)** (Command Injection - Generic)
  - Signal: ### Summary The `DecompressedArchiveSizeValidator` is used to check the size of a archive before extracting it: https://gitlab.com/gitlab-org/gitlab/-/blob/v15.1.0-ee/lib/gitlab/im
- **[critical] Stored XSS in Private Message component (BuddyPress)** (Cross-site Scripting (XSS) - Stored)
  - Signal: ## Description: WordPress version: **5.0.3** BuddyPress version: **4.1.0** Users with accounts can send private messages containing rendered HTML to other uses, this includes being

