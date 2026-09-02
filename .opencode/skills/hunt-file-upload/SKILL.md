---
name: hunt-file-upload
description: Hunt file upload vulnerabilities, race conditions, and business logic flaws. Covers upload bypass tables (extensions, content-type, magic bytes, polyglots, SVG XSS, zip slip), file→RCE chains, race conditions (single-packet attack, coupon/OTP/withdrawal races), and business logic abuse (price tampering, workflow bypass, negative quantities, role escalation). Use when testing file upload endpoints, promotional/coupon features, payments, ratings, or any check-then-act financial flow. Trigger keywords: file upload, race condition, business logic, coupon, OTP brute, double spend, price tampering, polyglot, zip slip.
---

# File Upload / Race Conditions / Business Logic

## File Upload

### Upload Bypass Table

| Bypass | Technique |
|---|---|
| Double extension | `file.php.jpg`, `file.php%00.jpg` |
| Case variation | `file.pHp`, `file.PHP5` |
| Alternative extensions | `.phtml`, `.phar`, `.shtml`, `.inc`, `.pht` |
| Content-Type spoof | `image/jpeg` header with PHP content |
| Magic bytes | `GIF89a; <?php system($_GET['c']); ?>` |
| .htaccess upload | `AddType application/x-httpd-php .jpg` |
| SVG XSS | `<svg onload=alert(1)>` |
| Race condition | Upload + execute before cleanup runs |
| Polyglot JPEG/PHP | Valid JPEG that is also valid PHP |
| Zip slip | `../../etc/cron.d/shell` in filename inside archive |
| Phar deserialization | `phar://` trigger on `.phar` upload |

### Magic Bytes Reference
| Type | Hex |
|---|---|
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47 0D 0A 1A 0A` |
| GIF | `47 49 46 38` |
| PDF | `25 50 44 46` |
| ZIP/DOCX/XLSX | `50 4B 03 04` |

### File Upload → RCE chain
1. Confirm upload location (static/CDN path)
2. Test executable extension handling (`.php`, `.phtml`, `.shtml`)
3. Test polyglot + `.htaccess` 
4. Test SVG for stored XSS (`<svg onload>` / `<script>`)
5. Test SVG/XML for XXE (SSRF/file read)
6. Test zip extraction for zip-slip path traversal
7. Race: upload then request before AV/cleanup deletes it

### Where upload bugs hide
- Avatar/photo upload with image processing (ImageMagick → command injection via filename/params, `ImageTragick` payloads)
- PDF/document converters (XXE, SSRF)
- CSV import (CSV injection = usually rejected, skip)
- Video/audio transcoders (ffmpeg SSRF)

## Race Conditions

### Profitable targets (check-then-act bugs)
- Coupon/promo code redemption
- Gift card redemption
- Fund transfer / withdrawal
- Voting / rating limits
- OTP verification brute via race
- Account creation with same email (double-registration race)
- Like/follow/referral rewards

### Detection: parallel requests
```bash
seq 20 | xargs -P 20 -I {} curl -s -X POST https://TARGET/redeem \
  -H "Authorization: Bearer $TOKEN" -d 'code=PROMO10' &
wait
```

### Turbo Intruder — Single-Packet Attack (all requests arrive in one TCP packet)
```python
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=1,
                           requestsPerConnection=1,
                           pipeline=False,
                           engine=Engine.BURP2)
    for i in range(20):
        engine.queue(target.req, gate='race1')
    engine.openGate('race1')  # all 20 fire simultaneously

def handleResponse(req, interesting):
    table.add(req)
```

### Race window patterns
- **Financial ops**: check-then-deduct as two DB operations = double-spend
- **TOCTOU**: verify balance/availability, then act, then confirm
- Use HTTP/2 single-packet attack for microsecond windows

## Business Logic

### Core principle
Read the docs, understand the product, then ask **"what does the developer assume?"** The hardest bugs to automate — do these manually.

### Test list
- Negative quantities in cart / price parameter tampering
- Workflow skip (pay without checkout, checkout without payment, order status manipulation)
- Role escalation via registration fields (`role=admin`)
- Privilege persistence after downgrade
- Type juggling in payment amounts (`100.0` vs `1e2` vs `"100"`)
- Integer overflow / extremely large quantities
- Reuse of single-use coupons / unlimited referral codes
- Account creation race → email impersonation
- Payment-flow steps skippable in different order
- Bundle/pricing logic — free tier tricks, trial abuse
- Refund/credit manipulation (negative refund, double refund)

### Where business logic hides
- Imports, integrations, multi-tenancy, multi-step workflows (feature complexity = bug surface)
- Payment, billing, credits, refunds ("follow the money")
- New features in last 30 days (lowest security maturity)
- Any "import from URL", "export to", webhook, sync feature

## PARAMETER COVERAGE — every upload field and every business-logic param (MANDATORY)
The #1 miss: testing only the file content/extension and skipping every other
field of the multipart request, plus skipping fields of adjacent endpoints.

1. **Uploads — enumerate EVERY multipart field**: `file`, `filename` (separate
   from content!), `name`, `title`, `type`/`content-type`, `size`, `path`,
   `dir`, `bucket`, `mime`, `extension`, `file_type`, any `*_url`, plus query
   params on the upload endpoint. Sweep each:
   - `filename`: extension/case/double-extension/`.htaccess`/null-byte ladders,
     path traversal (`../../x.php`), zip-slip inside archives
   - `type`/`mime`: spoof `image/jpeg` with executable content
   - `path`/`dir`/`bucket`: traversal and arbitrary write location
   - image-processing params: ImageMagick/ffmpeg command-injection and SSRF
     via filename, profile, and metadata fields
   - SVG/XML fields: XSS + XXE on the upload AND every re-render endpoint
2. **Race — apply to EVERY check-then-act endpoint**: coupon redeem, gift
   card, withdrawal, OTP verify, vote, like, double-registration. Sweep the
   single-packet attack on each (N=30, gate-open) and watch for double-spend.
3. **Business logic — enumerate EVERY field of money/workflow endpoints**:
   price/quantity/amount/coupon/status/role — test negative, huge, float-vs-
   string (`"100"` vs `1e2`), overflow, workflow-skip (pay-without-checkout,
   checkout-without-payment, order-status manipulation), and extra JSON keys
   (mass assignment of `role`/`paid`/`verified`) on EACH.
4. **Re-sweep per auth context and per tier** (free vs paid) — logic often
   differs by role.
5. **Track** `endpoint → field → technique → result` in the journal; every
   unlogged field = gap.

## FIELD DATA — mined from HackerOne disclosed reports (10k-report corpus)

### Class: file-upload — 184 disclosed H1 reports (104 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `type`
- `token`
- `file.path`
- `PackageID`
- `id`
- `redirectUrl`
- `directory`
- `external`
- `client_id`
- `callback`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] RCE when removing metadata with ExifTool** (Code Injection)
  - Signal: ### Summary When uploading image files, GitLab Workhorse passes any files with the extensions [jpg|jpeg|tiff](https://gitlab.com/gitlab-org/gitlab/-/blob/v13.10.2-ee/workhorse/inte
- **[critical] RCE via the DecompressedArchiveSizeValidator and Project BulkImports (behind feature flag)** (Command Injection - Generic)
  - Signal: ### Summary The `DecompressedArchiveSizeValidator` is used to check the size of a archive before extracting it: https://gitlab.com/gitlab-org/gitlab/-/blob/v15.1.0-ee/lib/gitlab/im
- **[critical] [cloudron-surfer] Denial of Service via LDAP Injection** (LDAP Injection)
  - Signal: I would like to report `Denial of service via LDAP Injection` vulnerability in `cloudron-surfer` module. It allows a malicious attacker to send a malformed input that is interprete
- **[critical] Remote Code Execution in Slack desktop apps + bonus** (Code Injection)
  - Signal: # Summary With any in-app redirect - logic/open redirect, HTML or javascript injection it's possible to execute arbitrary code within Slack desktop apps. This report demonstrates a

### Class: race-condition — 99 disclosed H1 reports (21 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `client_id`
- `redirect_uri`
- `code`
- `id`
- `authenticity_token`
- `client_secret`
- `getsc`
- `experiment_d2x_2020ify_buttons`
- `experiment_d2x_sso_login_link`
- `experiment_d2x_google_sso_gis_parity`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Project Template functionality can be used to copy private project data, such as repository, confidential issues, snippets, and merge requests** (Privilege Escalation)
  - Signal: I've found a three minor vulnerabilities which, when combined, allow an attacker to copy private repositories, confidential issues, private snippets, and then some. I'll go through
- **[critical] Webshell via File Upload on ecjobs.starbucks.com.cn** (OS Command Injection)
  - Signal: **Summary:** OS Command Injection which can let the attacker who get more important information of the server,such as disclosures internal source code of the webapp,database data a
- **[critical] Unauthenticated request smuggling on launchpad.37signals.com** (HTTP Request Smuggling)
  - Signal: ## Description By sending an ambiguous request on the rails application on `launchpad.37signals.com`, an attacker can desynchronise frontend and backend servers, leaving the socket
- **[critical] Misconfigurated login page able to lock login action for any account without user interaction** (None)
  - Signal: ## Summary While observing a few things about the login feature, I found that the account was locked after a certain number of requests. Although this feature is actually added to 

### Class: business-logic — 318 disclosed H1 reports (61 High/Critical)

**Parameters seen in real findings** (recurring; test each on every endpoint):

- `key`
- `email`
- `name`
- `load`
- `config`
- `lang`
- `amount`
- `client_id`
- `source`
- `xtl_coupon_code`

**Representative finding shapes** (real report titles, genericized — use as test-case ideas, not templates):

- **[critical] Unrestricted File Upload Leading to Remote Code Execution** (Business Logic Errors)
  - Signal: ### Description As an administrator user it is possible to create files and directories in any location on the file system of the server. This can be abused to write files to any s
- **[critical] An attacker can run pipeline jobs as arbitrary user** (Business Logic Errors)
  - Signal: ### Summary An attacker can run arbitrary pipeline jobs as a `victim` user. This means the attacker can access the user private repositories, member only repositories, registry, et
- **[critical] [yarn] yarn.lock integrity & hash check logic is broken** (Business Logic Errors)
  - Signal: I would like to report a vulnerability in `yarn`. It allows to pollute yarn cache via a crafted `yarn.lock` file and place a malicious package into cache under any name/version, by
- **[critical] Modify in-flight data to payment provider Smart2Pay** (Business Logic Errors)
  - Signal: I have found vulnerability which allows attacker to generate steam wallet balance. Firstly you will have to change yours steam account email to something like (I will explain why i

