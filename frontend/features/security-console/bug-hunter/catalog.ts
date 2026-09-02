export type Severity = "critical" | "high" | "medium" | "low" | "informational";

export interface VulnSkill {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  owasp?: string;
  description: string;
}

export interface SkillGroup {
  id: string;
  label: string;
  hint: string;
  skills: VulnSkill[];
}

export const VULN_SKILLS: SkillGroup[] = [
  {
    id: "xss",
    label: "Cross-Site Scripting (XSS)",
    hint: "Injection into browser-executable contexts. Encode per output context; CSP is defense-in-depth.",
    skills: [
      { id: "xss-dom", name: "DOM XSS", category: "XSS", severity: "high", owasp: "A03", description: "Unsafe DOM sinks reachable from attacker-controlled source." },
      { id: "xss-stored", name: "Stored XSS", category: "XSS", severity: "high", owasp: "A03", description: "Payload persisted and rendered later for other users." },
      { id: "xss-reflected", name: "Reflected XSS", category: "XSS", severity: "high", owasp: "A03", description: "Payload echoed back immediately in a response." },
      { id: "xss-blind", name: "Blind XSS", category: "XSS", severity: "high", owasp: "A03", description: "Execution fires out-of-band or in a page you cannot reach." },
      { id: "xss-self", name: "Self XSS", category: "XSS", severity: "low", owasp: "A03", description: "Self-only injection, often via social engineering." },
      { id: "xss-stored-dom", name: "Stored DOM XSS", category: "XSS", severity: "high", owasp: "A03", description: "Persisted input reaches an unsafe sink in the browser." },
      { id: "xss-reflected-dom", name: "Reflected DOM XSS", category: "XSS", severity: "high", owasp: "A03", description: "URL/query source reaches an unsafe DOM sink." },
      { id: "xss-get", name: "GET-based XSS", category: "XSS", severity: "high", owasp: "A03", description: "Payload carried in a GET parameter." },
      { id: "xss-post", name: "POST-based XSS", category: "XSS", severity: "medium", owasp: "A03", description: "Payload carried in a request body." },
      { id: "xss-html", name: "HTML Injection", category: "XSS", severity: "medium", owasp: "A03", description: "Attacker-controlled markup rendered into the page." },
      { id: "xss-svg", name: "SVG XSS", category: "XSS", severity: "medium", owasp: "A03", description: "Scriptable vector embedded in an uploaded/rendered SVG." },
      { id: "xss-image", name: "Image Upload XSS", category: "XSS", severity: "medium", owasp: "A03", description: "Misinterpreted image content leading to script execution." },
      { id: "xss-svg-upload", name: "SVG File XSS", category: "XSS", severity: "high", owasp: "A03", description: "Hosted SVG that executes script in the origin." },
      { id: "xss-png", name: "PNG Extension XSS", category: "XSS", severity: "low", owasp: "A03", description: "Non-image file served with an image extension and content type." },
      { id: "xss-cookie", name: "Cookie-based XSS", category: "XSS", severity: "medium", owasp: "A03", description: "Cookie value injected into an executable context." },
      { id: "xss-jsonp", name: "JSONP XSS", category: "XSS", severity: "medium", owasp: "A03", description: "Callback reflection into executable context via JSONP." },
      { id: "xss-postmessage", name: "PostMessage Abuse", category: "XSS", severity: "medium", owasp: "A03", description: "Unvalidated origin/message reaching a handler sink." },
      { id: "xss-serviceworker", name: "Service Worker XSS", category: "XSS", severity: "high", owasp: "A07", description: "Attacker-controlled script served/registered as a worker." },
      { id: "xss-xssi", name: "Cross-Site Script Inclusion (XSSI)", category: "XSS", severity: "medium", owasp: "A04", description: "Sensitive JS/JSONP leaked to another origin." },
      { id: "xss-rfd", name: "Reflected File Download (RFD)", category: "XSS", severity: "medium", owasp: "A03", description: "Reflected content served with a download/executable hint." },
    ],
  },
  {
    id: "injection",
    label: "Injection",
    hint: "Untrusted input changing the structure of a command or query.",
    skills: [
      { id: "sqli", name: "SQL Injection", category: "Injection", severity: "critical", owasp: "A03", description: "Input alters SQL query structure." },
      { id: "sqli-stored", name: "Stored SQLi", category: "Injection", severity: "critical", owasp: "A03", description: "Injected SQL persisted and executed later." },
      { id: "sqli-blind", name: "Blind SQLi", category: "Injection", severity: "high", owasp: "A03", description: "No direct output; inferred via responses/time." },
      { id: "sqli-time", name: "Time-Based SQLi", category: "Injection", severity: "high", owasp: "A03", description: "Boolean/data inference via response delay." },
      { id: "sqli-union", name: "Union-Based SQLi", category: "Injection", severity: "critical", owasp: "A03", description: "Data exfiltration via UNION SELECT." },
      { id: "sqli-error", name: "Error-Based SQLi", category: "Injection", severity: "high", owasp: "A03", description: "Database errors disclose query structure/data." },
      { id: "sqli-oob", name: "Out-of-Band SQLi", category: "Injection", severity: "critical", owasp: "A03", description: "Data exfiltrated via DNS/HTTP callback." },
      { id: "nosqli", name: "NoSQL Injection", category: "Injection", severity: "high", owasp: "A03", description: "Operator/prototype injection into NoSQL queries." },
      { id: "graphqli", name: "GraphQL Injection", category: "Injection", severity: "high", owasp: "A03", description: "Payloads injected through GraphQL arguments/variables." },
      { id: "ldapi", name: "LDAP Injection", category: "Injection", severity: "high", owasp: "A03", description: "Input modifies an LDAP filter expression." },
      { id: "xxe", name: "XML External Entity (XXE)", category: "Injection", severity: "critical", owasp: "A05", description: "External entities read files or trigger server requests." },
      { id: "ssti", name: "Server-Side Template Injection (SSTI)", category: "Injection", severity: "critical", owasp: "A03", description: "Template engine evaluates attacker expressions." },
      { id: "xslti", name: "XSLT Injection", category: "Injection", severity: "medium", owasp: "A03", description: "Transformation payload leads to code/data access." },
      { id: "command", name: "Command Injection", category: "Injection", severity: "critical", owasp: "A03", description: "Input executed as an OS command." },
      { id: "crlf", name: "CRLF Injection", category: "Injection", severity: "medium", owasp: "A03", description: "Carriage-return/newline injects headers/logs." },
      { id: "smtp", name: "SMTP Injection", category: "Injection", severity: "medium", owasp: "A03", description: "Header/body injection into mail commands." },
      { id: "ldap-confusion", name: "LDAP Auth Bypass", category: "Injection", severity: "critical", owasp: "A07", description: "Filter manipulation bypasses authentication." },
      { id: "rpo", name: "Relative Path Overwrite (RPO)", category: "Injection", severity: "low", owasp: "A04", description: "Relative path styling leaks or executes content." },
    ],
  },
  {
    id: "file-handling",
    label: "File & Path Handling",
    hint: "Abuse of file paths, uploads, and includes.",
    skills: [
      { id: "lfi", name: "Local File Inclusion (LFI)", category: "File", severity: "high", owasp: "A03", description: "Local files read via path traversal/inclusion." },
      { id: "rfi", name: "Remote File Inclusion (RFI)", category: "File", severity: "critical", owasp: "A03", description: "Remote file included/evaluated." },
      { id: "path-traversal", name: "Path Traversal", category: "File", severity: "high", owasp: "A01", description: "`../` sequences reach files outside intended root." },
      { id: "file-read", name: "Arbitrary File Read", category: "File", severity: "critical", owasp: "A01", description: "Read arbitrary server files." },
      { id: "file-write", name: "Arbitrary File Write", category: "File", severity: "critical", owasp: "A01", description: "Write arbitrary files, often leading to RCE." },
      { id: "upload-shell", name: "Shell Upload", category: "File", severity: "critical", owasp: "A04", description: "Executable upload rendered as code." },
      { id: "upload-bypass", name: "File Upload Bypass", category: "File", severity: "high", owasp: "A04", description: "Extension/MIME/blacklist validation bypass." },
      { id: "upload-double", name: "Double Extension Bypass", category: "File", severity: "medium", owasp: "A04", description: "`file.php.jpg` style bypass." },
      { id: "upload-mime", name: "MIME-Type Bypass", category: "File", severity: "medium", owasp: "A04", description: "Trusting client-declared content type." },
      { id: "upload-globbing", name: "Globbing Bypass", category: "File", severity: "medium", owasp: "A04", description: "Glob patterns bypass upload validation." },
      { id: "upload-blacklist", name: "Blacklist Bypass", category: "File", severity: "medium", owasp: "A04", description: "Blacklisted-extension evasion." },
      { id: "file-inclusion", name: "File Inclusion", category: "File", severity: "high", owasp: "A03", description: "Generic local/remote include behavior." },
    ],
  },
  {
    id: "ssrf-deser-rce",
    label: "SSRF, Deserialization & RCE",
    hint: "Server requests to unintended targets or unsafe object/state handling.",
    skills: [
      { id: "ssrf", name: "SSRF", category: "SSRF", severity: "high", owasp: "A10", description: "Server fetches attacker-selected resources." },
      { id: "ssrf-token", name: "SSRF Token Leak", category: "SSRF", severity: "critical", owasp: "A10", description: "SSRF reaches internal endpoints that leak tokens." },
      { id: "serverless-ssrf", name: "Serverless SSRF", category: "SSRF", severity: "high", owasp: "A10", description: "SSRF in serverless function context." },
      { id: "ecs-metadata-ssrf", name: "ECS Metadata SSRF", category: "SSRF", severity: "critical", owasp: "A10", description: "SSRF targets container task metadata." },
      { id: "vpc-ssrf", name: "VPC Endpoint SSRF", category: "SSRF", severity: "high", owasp: "A10", description: "SSRF through cloud VPC endpoints." },
      { id: "api-gateway-ssrf", name: "API Gateway SSRF", category: "SSRF", severity: "high", owasp: "A10", description: "SSRF via API Gateway proxying." },
      { id: "deser", name: "Insecure Deserialization", category: "Deserialization", severity: "critical", owasp: "A08", description: "Untrusted object graphs lead to RCE." },
      { id: "rce", name: "Arbitrary Code Execution", category: "RCE", severity: "critical", owasp: "A03", description: "Remote code execution achieved." },
      { id: "use-after-free", name: "Use-After-Free", category: "RCE", severity: "high", owasp: "A02", description: "Memory safety flaw; usually native/service." },
      { id: "toctou", name: "TOCTOU", category: "Logic", severity: "medium", owasp: "A01", description: "Check-and-use race across time." },
      { id: "race", name: "Race Condition", category: "Logic", severity: "high", owasp: "A01", description: "Concurrent requests change application state." },
      { id: "timing", name: "Timing Attack", category: "Crypto", severity: "low", owasp: "A02", description: "Observable timing leaks secrets." },
      { id: "padding-oracle", name: "Padding Oracle", category: "Crypto", severity: "high", owasp: "A02", description: "Cipher-padding responses decrypt data." },
      { id: "insecure-random", name: "Insecure Randomness", category: "Crypto", severity: "medium", owasp: "A02", description: "Predictable random used for security tokens." },
      { id: "weak-encryption", name: "Weak Encryption", category: "Crypto", severity: "high", owasp: "A02", description: "Broken or outdated algorithms/keys." },
      { id: "insufficient-entropy", name: "Insufficient Entropy", category: "Crypto", severity: "medium", owasp: "A02", description: "Low-entropy secrets/certificates." },
    ],
  },
  {
    id: "auth-session",
    label: "Authentication & Session",
    hint: "Authentication, session, and MFA weaknesses.",
    skills: [
      { id: "2fa-bypass", name: "2FA Bypass", category: "Auth", severity: "high", owasp: "A07", description: "Multi-factor control bypassed." },
      { id: "mfa-sync", name: "MFA Sync Bypass", category: "Auth", severity: "high", owasp: "A07", description: "MFA synchronization flaw bypasses step-up." },
      { id: "auth-bypass", name: "Authentication Bypass", category: "Auth", severity: "critical", owasp: "A07", description: "Authentication control entirely bypassed." },
      { id: "session-hijack", name: "Session Hijacking", category: "Auth", severity: "high", owasp: "A07", description: "Stolen session identifiers reused." },
      { id: "session-fixation", name: "Session Fixation", category: "Auth", severity: "high", owasp: "A07", description: "Victim session identifier pre-set by attacker." },
      { id: "session-expiry", name: "Improper Session Expiration", category: "Auth", severity: "medium", owasp: "A07", description: "Sessions that outlive intended lifespan." },
      { id: "account-takeover", name: "Account Takeover", category: "Auth", severity: "critical", owasp: "A07", description: "Full account compromise achieved." },
      { id: "password-reset", name: "Password Reset Poisoning", category: "Auth", severity: "high", owasp: "A07", description: "Reset link/flow poisoned or predictable." },
      { id: "weak-password", name: "Weak Password Policy", category: "Auth", severity: "low", owasp: "A07", description: "Permissive password policy in place." },
      { id: "brute-force", name: "Brute Force Vulnerability", category: "Auth", severity: "medium", owasp: "A07", description: "Missing throttling on auth attempts." },
      { id: "jwt-forgery", name: "JWT Forgery", category: "Auth", severity: "critical", owasp: "A02", description: "Tampered/forged JSON Web Token accepted." },
      { id: "jwt-misconfig", name: "JWT Misconfiguration", category: "Auth", severity: "high", owasp: "A02", description: "Weak algorithm/verification settings." },
      { id: "oauth-misconfig", name: "OAuth Misconfiguration", category: "Auth", severity: "high", owasp: "A07", description: "Redirect flow/state/token issues." },
      { id: "oauth-pkce", name: "OAuth PKCE Bypass", category: "Auth", severity: "high", owasp: "A07", description: "PKCE enforcement bypassed." },
      { id: "oauth-scope", name: "OAuth Scope Escalation", category: "Auth", severity: "high", owasp: "A07", description: "Granted broader scope than intended." },
      { id: "oauth-replay", name: "OAuth Token Replay", category: "Auth", severity: "medium", owasp: "A07", description: "Reused authorization code/token flows." },
      { id: "saml-bypass", name: "SAML Bypass", category: "Auth", severity: "critical", owasp: "A07", description: "SAML assertion validation bypassed." },
      { id: "token-leak", name: "Token Leakage", category: "Auth", severity: "high", owasp: "A07", description: "Tokens exposed via logs, referrers, or storage." },
      { id: "cognito-token", name: "Cognito Token Leak", category: "Auth", severity: "high", owasp: "A07", description: "Cloud identity tokens exposed." },
      { id: "rate-limit", name: "Rate Limit Bypass", category: "Auth", severity: "medium", owasp: "A04", description: "Throttling circumvented." },
      { id: "api-rate", name: "API Rate Limit Evasion", category: "Auth", severity: "medium", owasp: "A04", description: "API quota/rate controls bypassed." },
      { id: "brute-api", name: "API Key Brute Force", category: "Auth", severity: "medium", owasp: "A07", description: "Weak or brute-forceable API keys." },
    ],
  },
  {
    id: "access-control",
    label: "Access Control & Business Logic",
    hint: "Privilege, authorization, and logic flaws.",
    skills: [
      { id: "idor", name: "Insecure Direct Object Reference (IDOR)", category: "Access Control", severity: "high", owasp: "A01", description: "Direct object access without authorization." },
      { id: "privesc", name: "Privilege Escalation", category: "Access Control", severity: "critical", owasp: "A01", description: "Gain privileges beyond intended role." },
      { id: "access-control", name: "Access Control Bypass", category: "Access Control", severity: "high", owasp: "A01", description: "Authorization constraints bypassed." },
      { id: "business-logic", name: "Business Logic Flaw", category: "Logic", severity: "high", owasp: "A04", description: "Workflow/state logic abused." },
      { id: "logic-flaw", name: "Logic Flaw", category: "Logic", severity: "medium", owasp: "A04", description: "Application logic misused beyond intent." },
      { id: "payment", name: "Payment Manipulation", category: "Logic", severity: "high", owasp: "A04", description: "Price/amount/currency altered." },
      { id: "parameter", name: "Parameter Tampering", category: "Logic", severity: "high", owasp: "A04", description: "Request parameters manipulated to alter logic." },
      { id: "shadow-admin", name: "Shadow Admin Access", category: "Access Control", severity: "critical", owasp: "A01", description: "Unofficial admin paths/accounts exist." },
      { id: "admin-panel", name: "Exposed Admin Panel", category: "Access Control", severity: "high", owasp: "A01", description: "Admin interface reachable unauthenticated." },
      { id: "api-key-leak", name: "API Key Leakage", category: "Exposure", severity: "high", owasp: "A01", description: "API keys exposed in client/static assets." },
      { id: "secret-hardcoded", name: "Hardcoded Secrets", category: "Exposure", severity: "high", owasp: "A02", description: "Secrets committed to source or bundles." },
      { id: "exposed-credentials", name: "Exposed Credentials", category: "Exposure", severity: "critical", owasp: "A07", description: "Credentials leaked in files, responses, or buckets." },
      { id: "cloud-metadata", name: "Cloud Metadata Leak", category: "Exposure", severity: "critical", owasp: "A10", description: "Metadata service reachable/via SSRF." },
      { id: "s3-bucket", name: "S3 Bucket Enumeration", category: "Cloud", severity: "high", owasp: "A01", description: "Public/lists buckets or objects." },
      { id: "s3-presign", name: "S3 Pre-Signed URL Abuse", category: "Cloud", severity: "high", owasp: "A01", description: "Pre-signed URLs leaked or reused." },
      { id: "cognito-ssrf", name: "Cognito SSRF", category: "Cloud", severity: "high", owasp: "A10", description: "Cognito-related SSRF vector." },
      { id: "iam-over", name: "IAM Overpermission", category: "Cloud", severity: "high", owasp: "A01", description: "Over-broad IAM policy on a principal." },
      { id: "iam-role", name: "IAM Role Chaining", category: "Cloud", severity: "high", owasp: "A01", description: "Abusable role chain escalates access." },
      { id: "k8s-privesc", name: "K8s Privilege Escalation", category: "Cloud", severity: "critical", owasp: "A01", description: "Cluster privilege escalation." },
      { id: "docker-escape", name: "Docker Escape", category: "Cloud", severity: "critical", owasp: "A10", description: "Containment escape from a container." },
      { id: "lambda-rce", name: "Lambda RCE", category: "Cloud", severity: "critical", owasp: "A03", description: "Code execution in a serverless function." },
      { id: "fn-lambda-layer", name: "Lambda Layer RCE", category: "Cloud", severity: "high", owasp: "A03", description: "Malicious lambda layer executes code." },
      { id: "appsync-overreach", name: "AppSync Overreach", category: "Cloud", severity: "high", owasp: "A01", description: "GraphQL API grants excess access." },
      { id: "cloudtrail-bypass", name: "CloudTrail Bypass", category: "Cloud", severity: "medium", owasp: "A02", description: "Logging controls bypassed in cloud." },
      { id: "kinesis-poison", name: "Kinesis Stream Poisoning", category: "Cloud", severity: "medium", owasp: "A03", description: "Poisoned stream data processed downstream." },
      { id: "sns-hijack", name: "SNS Topic Hijack", category: "Cloud", severity: "medium", owasp: "A07", description: "Topic subscription/access misuse." },
      { id: "sqs-misconfig", name: "SQS Misconfiguration", category: "Cloud", severity: "medium", owasp: "A01", description: "Queue access/policy errors." },
      { id: "eks-takeover", name: "EKS Cluster Takeover", category: "Cloud", severity: "critical", owasp: "A01", description: "Kubernetes cluster compromise." },
      { id: "fargate-rce", name: "Fargate RCE", category: "Cloud", severity: "critical", owasp: "A03", description: "Code execution in Fargate task." },
      { id: "ecs-hijack", name: "ECS Task Hijack", category: "Cloud", severity: "critical", owasp: "A03", description: "Container task controlled by attacker." },
      { id: "rds-snapshot", name: "RDS Snapshot Leak", category: "Cloud", severity: "high", owasp: "A01", description: "Database snapshot exposure." },
      { id: "redshift-leak", name: "Redshift Credential Leak", category: "Cloud", severity: "high", owasp: "A02", description: "Warehouse credentials exposed." },
      { id: "kms-exposure", name: "KMS Key Exposure", category: "Cloud", severity: "high", owasp: "A02", description: "Encryption key access/exposure." },
      { id: "cloudformation-drift", name: "CloudFormation Drift", category: "Cloud", severity: "medium", owasp: "A01", description: "Deployed stack diverges from template." },
    ],
  },
  {
    id: "transport-http",
    label: "Transport & HTTP Semantics",
    hint: "Headers, cache, smuggling, and protocol issues.",
    skills: [
      { id: "smuggling", name: "HTTP Request Smuggling", category: "HTTP", severity: "critical", owasp: "A03", description: "Request desync between proxies/backends." },
      { id: "http2-smuggling", name: "HTTP/2 Smuggling", category: "HTTP", severity: "high", owasp: "A03", description: "HTTP/2 desync vector." },
      { id: "http-desync", name: "HTTP Desync Attack", category: "HTTP", severity: "critical", owasp: "A03", description: "Request/response desynchronization." },
      { id: "host-header", name: "Host Header Injection", category: "HTTP", severity: "medium", owasp: "A03", description: "Host header trusted for routing/linking." },
      { id: "cache-poisoning", name: "Cache Poisoning", category: "HTTP", severity: "high", owasp: "A04", description: "Cache populated with poisoned content." },
      { id: "web-cache-deception", name: "Web Cache Deception", category: "HTTP", severity: "high", owasp: "A04", description: "Sensitive content cached under misleading URL." },
      { id: "cdn-cache", name: "CDN Cache Poisoning", category: "HTTP", severity: "high", owasp: "A04", description: "CDN node cache poisoned." },
    ],
  },
  {
    id: "misconfig-headers",
    label: "Misconfiguration & Headers",
    hint: "Weak headers, exposure, and deployment mistakes.",
    skills: [
      { id: "cors", name: "CORS Misconfiguration", category: "Misconfiguration", severity: "medium", owasp: "A01", description: "Overly permissive cross-origin policy." },
      { id: "cors-origin-spoof", name: "CORS Origin Spoof", category: "Misconfiguration", severity: "medium", owasp: "A01", description: "Origin parsing bypasses CORS." },
      { id: "cors-bypass", name: "CORS Bypass", category: "Misconfiguration", severity: "high", owasp: "A01", description: "CORS protections circumvented." },
      { id: "csp-bypass", name: "CSP Bypass", category: "Misconfiguration", severity: "medium", owasp: "A05", description: "Content Security Policy evaded." },
      { id: "csp-misparse", name: "CSP Misparsing", category: "Misconfiguration", severity: "medium", owasp: "A05", description: "CSP parsed insecurely by a browser." },
      { id: "headers-misconfig", name: "Misconfigured Headers", category: "Misconfiguration", severity: "low", owasp: "A05", description: "Missing/weak security headers." },
      { id: "hsts-missing", name: "HSTS Bypass", category: "Misconfiguration", severity: "medium", owasp: "A05", description: "Strict transport security weakness." },
      { id: "tls-misconfig", name: "TLS Misconfiguration", category: "Misconfiguration", severity: "medium", owasp: "A02", description: "Weak ciphers/protocols/certificates." },
      { id: "expired-cert", name: "Expired Certificate", category: "Misconfiguration", severity: "low", owasp: "A05", description: "Certificate expired or not yet valid." },
      { id: "directory-listing", name: "Directory Listing", category: "Misconfiguration", severity: "medium", owasp: "A05", description: "Server directory listing enabled." },
      { id: "debug-mode", name: "Debug Mode Enabled", category: "Misconfiguration", severity: "high", owasp: "A05", description: "Debug/verbose mode publicly reachable." },
      { id: "source-disclosure", name: "Source Code Disclosure", category: "Misconfiguration", severity: "high", owasp: "A05", description: "Source files publicly served." },
      { id: "backup-disclosure", name: "Backup File Disclosure", category: "Misconfiguration", severity: "medium", owasp: "A05", description: "Backup/archive files exposed." },
      { id: "db-exposure", name: "Database Exposure", category: "Misconfiguration", severity: "critical", owasp: "A05", description: "Database reachable from the internet." },
      { id: "clickjacking", name: "Clickjacking", category: "Misconfiguration", severity: "low", owasp: "A04", description: "Framing permits click hijacking." },
      { id: "open-redirect", name: "Open Redirect", category: "Misconfiguration", severity: "medium", owasp: "A01", description: "Redirect to user-controlled destination." },
      { id: "insecure-redirect", name: "Insecure Redirect", category: "Misconfiguration", severity: "low", owasp: "A01", description: "Validation bypass on redirect target." },
      { id: "unvalidated-redirect", name: "Unvalidated Redirect", category: "Misconfiguration", severity: "medium", owasp: "A01", description: "Unvalidated redirect parameter." },
      { id: "url-redirect", name: "URL Redirection", category: "Misconfiguration", severity: "low", owasp: "A01", description: "Client-controlled redirect target." },
      { id: "insufficient-logging", name: "Insufficient Logging", category: "Misconfiguration", severity: "low", owasp: "A09", description: "Important events not logged." },
      { id: "websocket-misconfig", name: "WebSocket Vulnerability", category: "Misconfiguration", severity: "high", owasp: "A03", description: "Missing origin/auth on WebSocket." },
      { id: "websocket-hijack", name: "WebSocket Hijacking", category: "Misconfiguration", severity: "high", owasp: "A07", description: "Cross-site WebSocket hijacking." },
      { id: "prototype-pollution", name: "Prototype Pollution", category: "Misconfiguration", severity: "high", owasp: "A03", description: "Object prototype polluted by input." },
      { id: "dependency-confusion", name: "Dependency Confusion", category: "Supply Chain", severity: "high", owasp: "A06", description: "Malicious package takes precedence." },
      { id: "supply-chain", name: "Supply Chain Risk", category: "Supply Chain", severity: "medium", owasp: "A06", description: "Third-party component risk." },
      { id: "log-injection", name: "CloudWatch Log Injection", category: "Misconfiguration", severity: "medium", owasp: "A09", description: "Log content injection in cloud logging." },
      { id: "email-spoofing", name: "Email Spoofing", category: "Misconfiguration", severity: "medium", owasp: "A07", description: "Missing SPF/DKIM/DMARC posture." },
      { id: "waf-bypass", name: "WAF Bypass", category: "Misconfiguration", severity: "high", owasp: "A03", description: "Web app firewall rules evaded." },
      { id: "waf-evasion", name: "WAF Rule Evasion", category: "Misconfiguration", severity: "medium", owasp: "A03", description: "Rule evasion beyond signature matching." },
      { id: "reverse-tabnabbing", name: "Reverse Tabnabbing", category: "Misconfiguration", severity: "low", owasp: "A01", description: "Targetless links allow opener takeover." },
      { id: "server-misconfig", name: "Server Misconfiguration", category: "Misconfiguration", severity: "medium", owasp: "A05", description: "Unsafe server/deployment defaults." },
      { id: "serverless-misconfig", name: "Serverless Misconfiguration", category: "Misconfiguration", severity: "medium", owasp: "A05", description: "Unsafe serverless configuration." },
      { id: "grpc-misconfig", name: "gRPC Misconfiguration", category: "Misconfiguration", severity: "medium", owasp: "A05", description: "gRPC exposure/reflection enabled." },
      { id: "input-validation", name: "Improper Input Validation", category: "Misconfiguration", severity: "medium", owasp: "A03", description: "Inputs not validated structurally." },
      { id: "unrestricted-file", name: "Unrestricted File Access", category: "Misconfiguration", severity: "high", owasp: "A01", description: "Files served without access control." },
      { id: "webhook-spoof", name: "Webhook Spoofing", category: "Misconfiguration", severity: "high", owasp: "A04", description: "Unsigned/unauth webhook events accepted." },
    ],
  },
  {
    id: "protocol-web",
    label: "Web & Protocol Abuse",
    hint: "Browser, protocol, and modern web abuse.",
    skills: [
      { id: "css-injection", name: "CSS Injection", category: "Web", severity: "medium", owasp: "A03", description: "Attacker-controlled CSS exfiltrates/selects." },
      { id: "dns-rebinding", name: "DNS Rebinding", category: "Web", severity: "high", owasp: "A10", description: "DNS answer changes to reach internal hosts." },
      { id: "wasm", name: "WASM Misexecution", category: "Web", severity: "low", owasp: "A03", description: "WebAssembly misused/unsandboxed." },
      { id: "webrtc", name: "WebTransport Abuse", category: "Web", severity: "low", owasp: "A03", description: "Alternate transport abused." },
      { id: "reverse-tab", name: "Reverse Tabnabbing", category: "Web", severity: "low", owasp: "A01", description: "New-tab navigation rescues opener." },
      { id: "jsonp", name: "JSONP / XSSI leak", category: "Web", severity: "medium", owasp: "A04", description: "Cross-site script inclusion of sensitive data." },
      { id: "dangling-markup", name: "Dangling Markup Injection", category: "Web", severity: "medium", owasp: "A03", description: "Unclosed markup leaks via response sinking." },
    ],
  },
];

export interface ReconPhase {
  id: string;
  label: string;
  hint: string;
}

export const RECON_PHASES: ReconPhase[] = [
  { id: "subdomains", label: "Subdomain enumeration", hint: "Discover subdomains via passive (cert transparency, web archives, DNS datasets) and active brute-force." },
  { id: "live-hosts", label: "Live host probing", hint: "Filter resolution + HTTP reachability, port/technology fingerprinting." },
  { id: "endpoints", label: "Endpoint & archive crawl", hint: "Crawl & parse JS, sitemaps, wayback CDX archives, robots, and API routes. Catalogue GET/POST/PUT/PATCH/DELETE requests." },
  { id: "hidden", label: "Hidden data search", hint: "Locate metadata, hidden params, backup files, staged secrets, and source disclosure." },
  { id: "tech", label: "Technology detection", hint: "Detect framework, server, CMS, and version fingerprinting for CVE mapping." },
  { id: "cve", label: "Vulnerability intelligence", hint: "Correlate observed versions with CVE/Known-Exploited-Vulnerability and EPSS data." },
  { id: "github", label: "GitHub credential leak", hint: "Search public GitHub code for leaked secrets/credentials referencing the target." },
  { id: "emails", label: "Employee email harvest", hint: "Collect staff/employee emails exposed across archive, robots, and public content." },
  { id: "virustotal", label: "VirusTotal intelligence", hint: "Passive domain reputation, subdomains, resolutions, and detection stats (env key)." },
  { id: "passive", label: "Passive scanning", hint: "Analyze headers, cookies, TLS, metadata, and client-side JS without active payloads." },
  { id: "cred-leak", label: "Credential & secret leak", hint: "Scan accessible bundles, buckets, history, and responses for leaked secrets." },
  { id: "static", label: "Static analysis", hint: "Review client-side JS/chunks for sensitive exposure and risky patterns." },
  { id: "active", label: "Active scanning", hint: "Authorized request-level checks against verified targets (WebFetch/ACL-gated)." },
];

export const COMPLETE_PHASES: string[] = [
  "subdomains", "live-hosts", "endpoints", "hidden", "tech", "github", "emails", "virustotal", "passive", "cred-leak", "static", "cve",
];

export const AUTH_PROFILES = ["None — non-authenticated", "Bearer token", "Cookie session", "Basic auth", "API key header"];

export function findSkill(id: string): VulnSkill | undefined {
  for (const group of VULN_SKILLS) {
    const match = group.skills.find((skill) => skill.id === id);
    if (match) return match;
  }
  return undefined;
}

export function allSkills(): VulnSkill[] {
  return VULN_SKILLS.flatMap((group) => group.skills);
}
