# RESOURCES

## Bug Bounty Platforms
- [HackerOne Hacktivity](https://hackerone.com/hacktivity) — disclosed reports
- [Bugcrowd Crowdstream](https://bugcrowd.com/crowdstream) — public findings
- [Intigriti Leaderboard](https://www.intigriti.com/researcher/leaderboard)
- [Immunefi](https://immunefi.com) — web3/smart contract bounties
- [YesWeHack](https://yeswehack.com) — EU-focused programs

## Learning
- [PortSwigger Web Academy](https://portswigger.net/web-security) — free vuln labs (best)
- [HackTricks](https://book.hacktricks.xyz) — attack technique reference
- [PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings) — payload reference
- [Solodit](https://solodit.cyfrin.io) — 50K+ searchable audit findings (Web3)
- [ProjectDiscovery Chaos](https://chaos.projectdiscovery.io) — free subdomain datasets
- [OWASP Agentic Applications Top 10](https://genai.owasp.org/) — ASI01-ASI10
- [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) — LLM01-LLM10

## Wordlists
- [SecLists](https://github.com/danielmiessler/SecLists) — comprehensive wordlists
- [HowToHunt](https://github.com/KathanP19/HowToHunt) — step-by-step vuln hunting
- [DefaultCreds](https://github.com/ihebski/DefaultCreds-cheat-sheet) — default credentials

## Payload Databases & OOB
- [XSSHunter](https://xsshunter.trufflesecurity.com/) — blind XSS detection
- [interactsh](https://app.interactsh.com) — OOB callback server
- [Burp Collaborator](https://portswigger.net/burp/documentation/collaborator) — OOB callbacks

## Methodology References (from internet research)
- BBLabs: How to do bug bounty step-by-step (2026) — bblabs.es/en/como-hacer-bug-bounty
- The-XSS-Rat: 2026 Bug Bounty Guide (GitHub, SecurityTesting repo) — parameter tables, per-class testing
- ItsDarker: Bug-Bounty-Methodology-2026 (GitHub) — 7-phase pipeline, testing priority order
- su6osec: Bug-Bounty-Hunting-Methodology-2026 / HuntBook (GitHub) — 100+ tools, per-vuln guides (IDOR, SSRF, XXE, AWS/GCP/Azure)
- SecurityCipher: IDOR Hunting Playbook 2026 — Autorize workflow, GUID leak chains, blind IDOR
- bug-bounties.as93.net — SSRF hunting techniques & escalation, AI/LLM security testing for bounties
- bugbounty.info — The Bug Bounty Playbook (AI/LLM attack surface)
- OWASP secure-agent-playbook — prompt injection testing taxonomy (intents × techniques × evasions)
- elementalsouls/Claude-BugHunter — hunt-llm-ai skill (exfil proof gates, ASCII smuggling)
- Cyfrin: Solodit Smart Contract Audit Checklist (370 items, 13 categories)
- Hackcert Blog: Advanced Tactics for Bug Bounty Hunting — recon discipline, chaining

## AI Security Testing Tools
- [garak](https://github.com/NVIDIA/garak) — LLM vulnerability scanner (prompt injection probes)
- [PyRIT](https://github.com/Azure/PyRIT) — Microsoft red-teaming toolkit for AI
- [Rebuff](https://github.com/protectai/rebuff) — prompt injection detection framework
- [Promptmap](https://github.com/utkusen/promptmap) — maps AI app behavior boundaries

## Tools Install Reference
```bash
# Go binaries (ProjectDiscovery + friends)
go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
go install github.com/projectdiscovery/katana/cmd/katana@latest
go install github.com/tomnomnom/waybackurls@latest
go install github.com/lc/gau/v2/cmd/gau@latest
go install github.com/ffuf/ffuf/v2@latest
go install github.com/tomnomnom/anew@latest
go install github.com/tomnomnom/qsreplace@latest
go install github.com/tomnomnom/assetfinder@latest
go install github.com/tomnomnom/gf@latest
go install github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest
go install github.com/hahwul/dalfox/v2@latest

# Python
pip3 install arjun paramspider cloud_enum xsstrike sqlmap semgrep

# GitHub secret scanning
brew install gitleaks trufflehog  # or download releases
```
