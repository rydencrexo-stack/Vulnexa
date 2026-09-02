---
name: hunt-sharepoint
description: SharePoint security hunting — EoL SP2013 CVE targeting, Authentication.asmx legacy SOAP login (no rate limit/MFA), ToolShell chain (CVE-2025-53770/71, machineKey NOT a gate), NTLM Type-2 AD topology, SafeControl enumeration, HTTP smuggling on AWS ELB+IIS, version→CVE matrix. Use when SPRequestGuid, _layouts/15, _vti_bin, _api/contextinfo, or MicrosoftSharePointTeamServices detected. Trigger keywords: SharePoint, Authentication.asmx, ToolShell, SP2013, SafeControl, _layouts.
---

# SharePoint — Deep Hunting

## THE GATE
Crown jewel: **EoL SP2013** (`15.0.5545.1000`, EoL 2023-04-11) — every post-April-2023 CVE is permanently unpatched.

## Attack Vectors
- **Authentication.asmx legacy SOAP login** — anonymous, no rate limit, bypasses branded-UI lockout/CAPTCHA/MFA. Confirm `Mode` op returns `<ModeResult>Forms</ModeResult>`, then 10-burst timing test.
- **ToolShell (CVE-2025-53770/53771)**: anonymous `/_layouts/15/ToolPane.aspx?DisplayMode=Edit` + anonymous `__REQUESTDIGEST` from `/_api/contextinfo` + `__VIEWSTATEENCRYPTED=""`. **Critical insight: machineKey is NOT a gate** — CVE-2025-49706 (crafted Referer → ToolPane auth bypass) + CVE-2025-49704 (deserialization) yield an initial shell; machineKey is *dumped by that shell* for persistence.
- **NTLM Type-2** anonymous challenge → AD topology (NetBIOS domain, DNS forest, hostname).
- **SafeControl enumeration** via Picker.aspx error differential — feeds CVE-2019-0604-family chains.
- **HTTP TE.CL smuggling** on AWS ELB + IIS (12s backend hang).
- Custom-branding dirs `/_layouts/15/<Customer>/` — JS bundles leak endpoints.

## Version → CVE Matrix (build `15.0.5545.1000`)
CVE-2023-29357, 33160/33157/36941, 2024-21318/30043/38023/38024/38094, 2025-53770/53771, 2025-29794. SP2016/2019 EoL 2026-07-14.

## Fingerprinting
`SPRequestGuid`, `X-MS-InvokeApp`, `X-SharePointHealthScore`, `MicrosoftSharePointTeamServices`; `/_layouts/15/`, `/_vti_bin/`, `/_api/`; `_vti_inf.html` FPVersion; `/_api/contextinfo` LibraryVersion.

## Validation
Authentication.asmx: 10-burst uniform timing (0.6–0.9s, identical 431-byte) proves unbounded brute force — enough, don't crack a cred. ToolShell precondition chain (3 curls) is sufficient — do NOT deliver a malicious ViewState. `download.aspx?SourceUrl=` URL echo is **NOT SSRF** (38 payloads / 12 params → zero callbacks) — retract without a Collaborator callback.

## Common Mistakes
Under-assessing farms because machineKey is unknown; treating download.aspx echo as SSRF; version disclosure alone as High; extension-blocklist as file-existence oracle.