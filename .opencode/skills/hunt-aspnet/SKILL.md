---
name: hunt-aspnet
description: ASP.NET security hunting — ViewState deserialization → RCE (signed-only vs encrypted, machineKey recovery, dual-parser MAC-bypass), Telerik RAU RCE (CVE-2017-11317 / CVE-2019-18935), trace.axd / elmah.axd disclosure, WCF metadata, request-validator bypass contexts, SafeControl enumeration. Use when X-AspNet-Version, .ASPXAUTH, __VIEWSTATE, or Microsoft-IIS detected. Trigger keywords: ASP.NET, ViewState, machineKey, Telerik, trace.axd, elmah, .NET.
---

# ASP.NET — Deep Hunting

## THE GATE
Highest-payout class: **ViewState deserialization → RCE**. Pay tiers: Telerik > WCF > Webforms > Sitecore/DNN/Umbraco.

## Attack Vectors
- **ViewState signed-only vs encrypted**: `__VIEWSTATEENCRYPTED` empty = signed-only via `<machineKey>` → recover `validationKey` alone → forge. Non-empty = both keys needed.
- **Dual-parser MAC-bypass**: `ObjectStateFormatter` (legacy) vs `LosFormatter` (modern) deserialize in different orders relative to MAC check. Send 7+ payload shapes (trivial garbage, real, flipped-bit, oversize, base64, **XML-shaped `<xss/>`**, LosFormatter `/wEPDwUK...`) — XML/LosFormatter shapes yielding *"state information is invalid"* (vs *"Validation of viewstate MAC failed"*) prove a second parser path before MAC validation.
- **Telerik RCE**: `/Telerik.Web.UI.WebResource.axd?type=rau` — pre-2017Q1 (≤2017.1.118) = CVE-2017-11317 RAU RCE (keys baked in public DLLs); 2017Q3–2019Q3 = CVE-2019-18935 (needs telerikEncryptionKey).
- **Disclosure**: `/trace.axd` (per-request dump incl. Authorization headers), `/elmah.axd` (error log incl. connection strings), `customErrors mode="Off"` stack traces.
- **WCF**: `*.svc?wsdl` / `?mex` — metadata often anonymously enumerable.
- **Request-validator bypass**: validator covers only querystring + URL-encoded body — **not** cookies, Referer, JSON/XML bodies, multipart fields. Try `javascript:alert(1)`, NUL-byte `<%00script>`, payloads in Cookie/Referer.
- **SafeControl enumeration**: `Picker.aspx?PickerDialogType=<TypeName>` returns distinct errors for exists-not-whitelisted vs does-not-exist → map reachable gadget classes (CVE-2019-0604-family recon).

## Config/Keys Worth Stealing
`web.config` `<machineKey>` (validationKey + decryptionKey) from source leaks, GitHub, elmah; Telerik keys.

## Fingerprinting
`X-AspNet-Version: 4.0.30319`, `.ASPXAUTH`/`ASP.NET_SessionId` cookies, `__VIEWSTATE`+`__VIEWSTATEGENERATOR`, `Server: Microsoft-IIS`.

## Validation
trace.axd 200 with live tokens = Critical; elmah 200 = High; empty `__VIEWSTATEENCRYPTED` WITHOUT key recovery = Low-Medium primitive only. `ysoserial.net`/`viewgen` for PoCs.

## Common Mistakes
Rating signed-only ViewState Critical without key recovery; treating bare stack traces as High; assuming request validator covers all contexts.