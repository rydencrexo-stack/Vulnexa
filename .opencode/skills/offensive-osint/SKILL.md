---
name: offensive-osint
description: Reconnaissance arsenal — subdomain source stack (crt.sh fallback chain, Censys, CertSpotter, OTX), wordlist sources and sizes, infrastructure OSINT (Shodan/Censys/JARM/favicon mmh3, ASN bulk via Cymru), TLS deep audit, reverse DNS/IPv6, 48-pattern secret-regex catalog with severities, secret validators, dork corpus, identity-fabric endpoints, endpoint interest scoring rubric, attack-path hints. Use for any recon: asset discovery, attack-path mapping, secret triage. Trigger keywords: recon, subdomain enum, certificate transparency, secret scan, dork, attack surface, footprinting.
---

# Offensive OSINT — Recon Arsenal

> Authorized targets only. For the methodology/planning layer use the bug-bounty master skill's recon workflow.

## Subdomain-Source Stack (passive, by recall)
crt.sh (best single source, frequently 502s → fallback), VirusTotal, AlienVault OTX, Shodan `domain:`, BinaryEdge, FOFA/ZoomEye, Netlas, SecurityTrails, RapidDNS, Subfinder (30+ sources in one CLI), Amass, Recon-ng.

**DNS AXFR opportunism:** `dig @<ns-host> <target-domain> AXFR` — most reject; those that don't = full zone disclosure (CRITICAL).

### crt.sh Down? Fallback Chain
```bash
censys search "names: target.example" --index-type certificates --fields names | jq -r '.names[]' | sort -u
curl -sk "https://api.certspotter.com/v1/issuances?domain=D&include_subdomains=true&expand=dns_names" | jq -r '.[].dns_names[]' | sort -u
curl -sk "https://crt.calidog.io/?q=D" | jq -r '.[].name_value' | sort -u
subfinder -d D -all -recursive -silent
curl -sk "https://otx.alienvault.com/api/v1/indicators/domain/D/passive_dns" | jq -r '.passive_dns[].hostname' | sort -u
curl -sk "https://urlscan.io/api/v1/search/?q=domain:D" | jq -r '.results[].page.domain' | sort -u
```

### Wordlist Sources
Assetnote (`wordlists.assetnote.io` — best-curated), SecLists, jhaddix all.txt, OneListForAll, raft-large-words.txt. Sizes: <10k=fast; 10-100k=default; 100k-1M=thorough; >1M=exhaustive. Tooling:
```bash
subfinder -d target.example -all -recursive | tee passive.txt
puredns bruteforce assetnote-best-dns-wordlist.txt target.example -r resolvers.txt | tee brute.txt
ffuf -u "https://target.example/FUZZ" -w raft-large-words.txt -mc 200,301,403 -t 50 -ac
```

## Infrastructure OSINT
Shodan/Censys/GreyNoise/SecurityTrails/SpiderFoot/theHarvester/Recon-ng/Netlas/BinaryEdge/FOFA/ZoomEye/Robtex. **Favicon mmh3 hash** clusters shared infra; **JARM** clusters server configs; **httpx** one-shot probe (~600 Wappalyzer signatures, JARM, favicon, cert SHA256, headers, screenshots).

### Bulk IP → ASN (recipes that work)
```bash
echo -e "begin\nverbose\n8.8.8.8\n1.1.1.1\nend" | nc whois.cymru.com 43   # Cymru bulk, no key, no rate limit
curl -sk "https://stat.ripe.net/data/network-info/data.json?resource=8.8.8.8" | jq '.data'
```
bgpview.io undocumented ~1 req/min rate limit — not for bulk. PeeringDB is facility info only.

## Secret-Pattern Catalog (48 patterns — high-signal subset)
| Name | Regex | Sev |
|---|---|---|
| AWS Access Key | `\b(AKIA\|ASIA)[0-9A-Z]{16}\b` | CRITICAL |
| GCP SA JSON | `"type"\s*:\s*"service_account"` | CRITICAL |
| Google API Key | `\bAIza[0-9A-Za-z_\-]{35}\b` | HIGH |
| GitHub Classic PAT | `\bghp_[A-Za-z0-9]{36}\b` | CRITICAL |
| GitHub Fine-grained | `\bgithub_pat_[A-Za-z0-9_]{82}\b` | CRITICAL |
| Stripe Live | `\bsk_live_[0-9A-Za-z]{24,}\b` | CRITICAL |
| Slack Token | `\bxox[abpors]-[0-9A-Za-z\-]{10,48}\b` | HIGH |
| SendGrid | `\bSG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}\b` | HIGH |
| Twilio API Key | `\bSK[0-9a-fA-F]{32}\b` | HIGH |
| JWT | `\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b` | MEDIUM |
| RSA/EC/OpenSSH/Generic Private Key | `-----BEGIN (RSA\|EC\|OPENSSH\|DSA\|PGP \|)PRIVATE KEY-----` | CRITICAL |
| Anthropic | `\bsk-ant-(?:api03\|admin01)-[A-Za-z0-9_\-]{93,}\b` | CRITICAL |
| OpenAI Project | `\bsk-proj-[A-Za-z0-9_\-]{40,}T3BlbkFJ[A-Za-z0-9_\-]{40,}\b` | CRITICAL |
| HuggingFace | `\bhf_[A-Za-z0-9]{30,}\b` | HIGH |
| npm Token | `\bnpm_[A-Za-z0-9]{36}\b` | HIGH |
| PyPI Token | `\bpypi-AgENdGV[A-Za-z0-9_\-]+\b` | HIGH |
| Docker Hub PAT | `\bdckr_pat_[A-Za-z0-9_\-]{27,}\b` | HIGH |
| Atlassian | `\bATATT3xFfGF0[A-Za-z0-9_\-]{180,}\b` | HIGH |
| Discord Bot | `\b[MN][A-Za-z\d]{23}\.[\w\-]{6}\.[\w\-]{27}\b` | HIGH |
| Telegram Bot | `\b\d{8,10}:[A-Za-z0-9_\-]{35}\b` | HIGH |

**FP notes:** JWT/Bearer/Generic hit test data constantly — context matters (README example ≠ production .env). Order matters: most-specific patterns first. Always validate live (see validators).

## Endpoint Interest Score (0-100)
Unauth write +40; open GraphQL introspection +35; verb tampering +30; reflected CORS+creds +25; sensitive keyword in path +20; schema leak in error +20; API key in URL +15; wildcard CORS +10; missing rate-limit headers +10. Thresholds: ≥90 Critical, 70-89 High, 50-69 Medium, 25-49 Low, <25 Info. For ≥70 attach an attack-path hint.

## Attack-Path Hints (pick per trigger)
Unauth POST → try IDOR + privesc; open GraphQL introspection → enumerate mutations for createUser/setRole/transferFunds; reflected CORS+creds → host CSRF page; listable bucket → recursive listing for backups/logs/keys; .git exposed → git-dumper full history; /actuator/env → dump env for datasource password/JWT secrets; /actuator/heapdump → HPROF strings for cleartext secrets; open Redis → CONFIG SET + BGSAVE authorized_keys; open kubelet → POST /run; open etcd → /registry/secrets; subdomain takeover → register + pivot to OAuth/CSP/CORS/email chains.

## Mobile App Ownership Confidence (≥70 = accept)
Package reverse-DNS matches target +40; dev email @target-domain +25; dev website = target domain +20; app name contains brand keyword +10; ≥20 reviews +5.

## Do NOT
Paste creds/PII into cloud LLMs; run destructive probes outside aggressive mode; use validated creds beyond read-only liveness; single-source attribute; assume vendor labels are ground truth.