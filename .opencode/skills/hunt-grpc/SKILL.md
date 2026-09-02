---
name: hunt-grpc
description: gRPC / gRPC-Web / Connect API hunting — reflection on/off workflows, edge-auth trust collapse (x-user-id, -bin binary metadata smuggling, x-envoy-internal), gRPC-Web/grpc-gateway transcoding as the external surface, framing details (flag byte + 4-byte length + protobuf), Rapid Reset CVE-2023-44487 version gate, grpc-status trailer as the oracle. Use when grpc-status trailers, ALPN h2, ports 50051/443/8443/9090, or protobuf APIs are detected. Trigger keywords: gRPC, protobuf, Connect, grpc-gateway, grpc-Web, reflection.
---

# gRPC API Security — Deep Hunting

## THE GATE
Fingerprint: `grpc-status` trailer (12=UNIMPLEMENTED on bogus path = it's gRPC); ALPN must negotiate `h2`. Ports: 50051 native, 443/8443 TLS+ALPN, 9090/8080 h2c. Reflection on (`grpcurl list`/`describe`) = full catalog; reflection off = guess methods or rebuild from leaked `.proto` via `-protoset bundle.bin`.

## Crown Jewel = Edge-Auth Trust Collapse
Proxy authenticates, backend trusts proxy-injected metadata. Test `x-user-id: 1`, `x-authenticated-user: admin`, `x-tenant-id: 0`, `x-internal-request: true`, `x-envoy-internal: true`, and **`-bin` binary metadata smuggling** (`auth-token-bin:` base64 — middleware inspecting text metadata misses it). Prove the *public proxy forwards* the spoofed header, not just the bypassed backend port. Also: forged `alg:none` JWT; IDOR over enumerable `user_id`.

## gRPC-Web / grpc-gateway / Connect (the realistic external surface)
REST-annotated or default routes (`/v1/admin/users:list`, `/admin.AdminService/ListUsers`) hit with plain JSON; real gRPC-Web frame = 1 flag byte (0x00) + 4-byte big-endian length + protobuf (protoscope); `grpc-web+json` and Connect (`connect-protocol-version: 1`) need no framing. Confirm unauth/low-priv reachability, not mesh-internal.

## Rapid Reset (CVE-2023-44487)
Authorization-gated — version-match instead of flooding (nghttp2 ≥1.57.0, Envoy ≥1.27.1, grpc-go ≥1.56.3/1.57.1/1.58.3 mitigated); ghz/h2load CANNOT emit HEADERS+immediate-RST_STREAM interleave.

## Validation
Read the `grpc-status` trailer (0=OK); 16/7 mean auth WORKS; reflection/health endpoints are often intentionally public — the finding is the *sensitive method callable unauth*, proven with an authed-vs-unauth state delta or confirmed side-effect. Empty responses can be error frames.

## PARAMETER COVERAGE — every method, every field, every metadata key (MANDATORY)
The #1 miss: testing only one or two "interesting" methods and the one known
metadata header. gRPC bugs hide in EVERY method's fields and EVERY metadata
key the backend trusts.

1. **Enumerate the full method catalog** (reflection or leaked proto); for
   EVERY method list its request fields (recursively through nested messages,
   including optional/pagination/tenant/ID fields) and the metadata keys
   (`x-user-id`, `x-tenant-id`, `x-authenticated-user`, `x-internal-request`,
   `x-envoy-internal`, `authorization`).
2. **Sweep edge-auth trust collapse on EVERY metadata key**: spoof
   `x-user-id: <victim>`, `x-tenant-id: 0`, `x-envoy-internal: true`, and
   `-bin` binary-metadata smuggling variants on each; prove the public proxy
   forwards the spoofed header, and confirm per-method.
3. **IDOR**: swap every `user_id`/`tenant_id`/`account_id` field on every
   method (read AND write).
4. **Injection**: SQLi/NoSQLi/SSTI on every string field of every method;
   protobuf type-confusion (send wrong-type bytes per field).
5. **gRPC-Web/gateway/Connect transcoding**: hit the REST-annotated routes
   with plain JSON for EVERY method, unauth and low-priv.
6. **Re-sweep per auth context** and per service.
7. **Track** `service → method → field/metadata → payload → grpc-status` in
   the journal; every unlogged method/field = gap.