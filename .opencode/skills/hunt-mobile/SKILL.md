---
name: hunt-mobile
description: Mobile app (APK/iOS) red-team pipeline — APK acquisition (APKPure direct, XAPK splits), 60-pattern secret catalog, expired-JWT intel, pinned certs revealing internal hosts, exported components → intent injection, Firebase tests from google-services.json, Frida pinning bypass, iOS distribution-channel insight (TestFlight/enterprise IPAs not FairPlay-encrypted), ATS misconfig, URL scheme enum, keychain groups, entitlements. Use when mobile apps are in scope. Trigger keywords: APK, mobile, Frida, jadx, Firebase, ATS, TestFlight, keychain, intent injection.
---

# Mobile (APK / iOS) Red-Team — Deep Hunting

## THE GATE — APK Acquisition
APKPure direct (`https://d.apkpure.net/b/APK/<pkg>?version=latest`) with 302-follow; XAPK = zip of split APKs; truncated EOCD = CDN rate-limit → `7z x` is more lenient.

## 60-Pattern Secret Catalog (high-signal, not generic grep)
`AKIA[A-Z0-9]{16}`, `AIza...35`, `ya29.` (Google OAuth refresh), `ghp_`/`glpat-`, `xoxp/xoxb`, `sk-...48` (OpenAI), `AC...32` (Twilio), `sk_live_`/`pk_live_`, `SG.` SendGrid, JWT `eyJ...`, Firebase config keys, `client_secret`.

## Don't Discount Expired JWTs
The path tokens, endpoint list, and HS256 algorithm are intel; recovered HS256 secret = arbitrary token forgery.

## Key Vectors
- **Pinned certs** in `assets/*.cer` reveal internal API hosts passive recon missed.
- **Exported components** (`android:exported="true"`) → intent injection into WebViews/URI extras (SSRF/redirect).
- **Firebase tests** from `google-services.json`: `https://<project>.firebaseio.com/.json`, Firestore REST, storage.
- **Frida pinning bypass**: OkHttp `CertificatePinner.check`, Conscrypt `TrustManagerImpl.verifyChain`; objection `android hooking watch class_method`.

## iOS Distribution Insight
TestFlight and enterprise/ad-hoc IPAs (from `itms-services://` `manifest.plist`) are **not FairPlay-encrypted** — no jailbreak/decryption needed; TestFlight builds are less hardened. App Store binaries need `frida-ios-dump`/`bagbak`.
- Entitlements from `codesign -d --entitlements` / `embedded.mobileprovision` — not Info.plist; shared `keychain-access-groups` = cross-app keychain read.
- **ATS misconfig** is the #1 iOS finding: `NSAllowsArbitraryLoads=true`, per-domain exceptions, `NSAllowsArbitraryLoadsInWebContent=true` (WKWebView blind spot).
- **BoringSSL pinning bypass** (`SSL_CTX_set_custom_verify`) catches URLSession/AFNetworking/Alamofire/TrustKit at once.
- URL scheme enum: `myapp://reset-password?redirect=https://evil.com` → WebView open-redirect chain; scheme squatting; Universal Links degrade to custom scheme when AASA missing.

## Key Commands
```
jadx -d decompiled/ pkg.apk; find . -name "classes*.dex" -exec strings -8 {} \;
curl -s "https://firestore.googleapis.com/v1/projects/<pid>/databases/(default)/documents/users"
aws sts get-caller-identity   # validate any AKIA
curl -s https://T/manifest.plist | plutil -convert xml1 -o - -   # find software-package URL
codesign -d --entitlements :- Payload/AppName.app
plutil -extract NSAppTransportSecurity xml1 -o - Info.plist
curl -s https://<domain>/.well-known/apple-app-site-association
```

## Validation
Every secret must authenticate (STS call, API hit) or be pinned/expired-but-intel; decision tree maps each finding to next move. Reverse *older* versions too (secrets removed client-side but still valid server-side).

## Common Mistakes
Generic "password" grep (noise); skipping split APKs; trusting "pinning present = safe"; running Frida on production devices; ignoring Firebase on "simple" apps.