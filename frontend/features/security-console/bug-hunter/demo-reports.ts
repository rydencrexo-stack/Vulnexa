import type { AgentFinding } from "@/types/pan";
import type { AgentReport } from "./report-types";

type DemoScenario = {
  slug: string;
  domain: string;
  stack: string[];
  findings: AgentFinding[];
};

const finding = (title: string, severity: string, confidence: number, endpoint: string, rationale: string): AgentFinding => ({
  title,
  severity,
  confidence,
  endpoint,
  source: "demo_deepseek_analysis",
  rationale,
});

const SCENARIOS: DemoScenario[] = [
  { slug: "commerce", domain: "shop.aurora-demo.test", stack: ["Next.js", "Node.js"], findings: [finding("Reflected XSS candidate in product search", "high", 94, "https://shop.aurora-demo.test/search?q=marker", "The response evidence shows the query value entering an HTML attribute without context-aware encoding."), finding("Missing Content-Security-Policy", "medium", 99, "https://shop.aurora-demo.test/", "No CSP header was observed on the sampled application responses."), finding("Open redirect candidate in return URL", "medium", 88, "https://shop.aurora-demo.test/login?return=", "The return parameter accepted an external HTTPS destination in the recorded safe redirect test.")] },
  { slug: "banking-api", domain: "api.meridian-bank.test", stack: ["FastAPI", "PostgreSQL"], findings: [finding("BOLA/IDOR candidate on account statements", "critical", 91, "GET https://api.meridian-bank.test/v1/accounts/{accountId}/statements", "Two controlled demo identities received different authorization outcomes when the object identifier changed."), finding("Verbose API error discloses internal model names", "low", 97, "POST https://api.meridian-bank.test/v1/transfers", "A malformed demo request returned internal schema and package names."), finding("Login endpoint lacks observable rate limiting", "medium", 82, "POST https://api.meridian-bank.test/v1/auth/login", "The bounded test window did not observe throttling headers or a delay response.")] },
  { slug: "health", domain: "portal.nimbus-health.test", stack: ["React", "Django"], findings: [finding("Stored XSS candidate in profile biography", "high", 89, "PATCH https://portal.nimbus-health.test/api/profile", "A harmless marker was stored and later returned in a browser-rendered context."), finding("Session cookie missing SameSite", "medium", 100, "https://portal.nimbus-health.test/login", "The captured Set-Cookie header omitted a SameSite attribute."), finding("Public source map exposes client routes", "medium", 96, "https://portal.nimbus-health.test/static/app.js.map", "The source map was directly retrievable and contained original route and component names.")] },
  { slug: "logistics", domain: "ops.blueharbor-logistics.test", stack: ["Vue", "Go"], findings: [finding("CORS reflects arbitrary Origin with credentials", "high", 95, "GET https://ops.blueharbor-logistics.test/api/shipments", "The safe cross-origin test observed the supplied Origin together with Access-Control-Allow-Credentials."), finding("GraphQL introspection enabled", "low", 99, "POST https://ops.blueharbor-logistics.test/graphql", "The standard introspection query returned the demo schema."), finding("Server version disclosed", "low", 100, "https://ops.blueharbor-logistics.test/", "The Server header disclosed a precise reverse-proxy version.")] },
  { slug: "learning", domain: "learn.pinecrest-academy.test", stack: ["WordPress", "PHP"], findings: [finding("Outdated WordPress plugin candidate", "high", 86, "https://learn.pinecrest-academy.test/wp-content/plugins/demo-gallery/", "Public asset metadata indicates a version associated with known security advisories; manual version confirmation is required."), finding("User enumeration through author endpoint", "medium", 93, "GET https://learn.pinecrest-academy.test/wp-json/wp/v2/users", "The endpoint returned public demo usernames without authentication."), finding("Directory listing enabled for uploads", "medium", 98, "https://learn.pinecrest-academy.test/wp-content/uploads/", "The server returned an index containing uploaded demo filenames.")] },
  { slug: "travel", domain: "booking.summit-travel.test", stack: ["Angular", "Java"], findings: [finding("SQL injection timing candidate in destination filter", "critical", 78, "GET https://booking.summit-travel.test/api/search?destination=", "Repeated bounded timing samples correlated with a non-destructive conditional expression; database confirmation was not attempted."), finding("JWT accepted after logout", "high", 90, "GET https://booking.summit-travel.test/api/me", "A controlled demo token remained accepted after the logout event."), finding("Weak cache controls on account response", "medium", 97, "GET https://booking.summit-travel.test/api/me", "The authenticated response lacked private/no-store cache directives.")] },
  { slug: "media", domain: "studio.redwood-media.test", stack: ["Next.js", "GraphQL"], findings: [finding("Unrestricted file upload candidate", "high", 87, "POST https://studio.redwood-media.test/api/uploads", "The demo upload accepted an unexpected SVG content type and served it inline."), finding("GraphQL field-level authorization candidate", "high", 84, "POST https://studio.redwood-media.test/graphql", "A low-privilege demo role received fields marked for the editor role in supplied schema evidence."), finding("Missing X-Content-Type-Options", "low", 100, "https://studio.redwood-media.test/uploads/demo.svg", "The sampled upload response omitted nosniff.")] },
  { slug: "saas", domain: "app.orbit-crm.test", stack: ["React", "Ruby on Rails"], findings: [finding("Cross-tenant contact access candidate", "critical", 92, "GET https://app.orbit-crm.test/api/contacts/{id}", "Controlled tenant identifiers produced a response containing another demo tenant's record."), finding("CSRF protection absent on email change", "high", 88, "POST https://app.orbit-crm.test/settings/email", "The captured state-changing request contained no CSRF token and the cookie policy allowed cross-site delivery."), finding("Debug endpoint exposed", "medium", 95, "https://app.orbit-crm.test/rails/info/routes", "The framework route inventory was accessible without authentication.")] },
  { slug: "payments", domain: "checkout.cedar-pay.test", stack: ["Svelte", "Node.js"], findings: [finding("Price parameter trusted by checkout API", "critical", 85, "POST https://checkout.cedar-pay.test/api/checkout", "A controlled request showed that the server used the client-supplied demo price instead of recalculating it."), finding("Webhook signature comparison weakness candidate", "high", 73, "POST https://checkout.cedar-pay.test/api/webhooks", "Response timing varied with matching signature prefixes; more controlled validation is required."), finding("Sensitive response lacks no-store", "medium", 98, "GET https://checkout.cedar-pay.test/api/receipt/demo", "Receipt data was returned without a restrictive Cache-Control policy.")] },
  { slug: "support", domain: "helpdesk.starlight-support.test", stack: ["Laravel", "MySQL"], findings: [finding("Ticket attachment path traversal candidate", "critical", 83, "GET https://helpdesk.starlight-support.test/api/attachments?file=", "Normalized traversal variants reached a different demo fixture than the requested attachment."), finding("HTML injection in ticket export", "medium", 90, "POST https://helpdesk.starlight-support.test/api/tickets/export", "A harmless HTML marker was preserved in the generated demo export."), finding("Password reset response reveals account existence", "medium", 99, "POST https://helpdesk.starlight-support.test/password/reset", "Known and unknown demo identities received distinguishable responses.")] },
];

export const DEMO_AGENT_REPORTS: AgentReport[] = SCENARIOS.map((scenario, index) => {
  const root = scenario.domain.split(".").slice(-2).join(".");
  const assets = [scenario.domain, `api.${root}`, `admin.${root}`].map((hostname, assetIndex) => ({
    hostname,
    url: `https://${hostname}`,
    status: assetIndex === 2 ? 403 : 200,
    title: assetIndex === 0 ? "Primary application" : assetIndex === 1 ? "API service" : "Administration portal",
    technologies: scenario.stack,
  }));
  const endpoints = scenario.findings.map((item) => {
    const match = (item.endpoint ?? "").match(/^(GET|POST|PATCH|PUT|DELETE)\s+(.+)$/);
    return { url: match?.[2] ?? item.endpoint ?? `https://${scenario.domain}/`, method: match?.[1] ?? "GET", kind: "web", source: "demo_evidence" };
  });
  const createdAt = `2026-08-${String(30 - index).padStart(2, "0")}T${String(9 + (index % 7)).padStart(2, "0")}:15:00.000Z`;
  const critical = scenario.findings.filter((item) => item.severity === "critical").length;
  const high = scenario.findings.filter((item) => item.severity === "high").length;
  return {
    id: `demo_ai_report_${String(index + 1).padStart(2, "0")}`,
    name: `[DEMO] ${scenario.domain} · DeepSeek assessment`,
    target: scenario.domain,
    auth: index % 3 === 0 ? "Authenticated demo account" : "None - non-authenticated",
    model: index % 2 === 0 ? "deepseek-v4-flash" : "deepseek-v4-pro",
    phases: ["subdomains", "live-hosts", "endpoints", "passive", "static", "ai-analysis"],
    skills: scenario.findings.map((item) => item.title.split(" ").slice(0, 3).join("-").toLowerCase()),
    startedAt: createdAt,
    completedAt: createdAt,
    createdAt,
    summary: `Demo-only assessment of ${scenario.domain}. DeepSeek reviewed synthetic evidence and identified ${scenario.findings.length} candidate findings (${critical} critical, ${high} high). No real website was tested.`,
    findings: scenario.findings,
    assets,
    endpoints,
    evidenceSummary: { subdomains: assets.length, archiveUrls: 14 + index * 3, paths: endpoints.length + 8, jsBundles: 3 + (index % 5), emails: index % 4, github: null, virustotal: null },
    methodology: ["Synthetic demo recon inventory", "Simulated HTTP and endpoint evidence", "DeepSeek demo triage", "No network requests or real-world testing"],
    coverage: 78 + (index % 5) * 4,
    status: "ready",
    aiSummary: `The demo evidence indicates ${scenario.findings.length} review priorities on a fictional target. Validate every candidate before treating it as a vulnerability.`,
    aiAnalysis: {
      executiveSummary: `This is a fictional example report. The simulated assessment produced ${scenario.findings.length} candidate findings, led by ${scenario.findings[0].title.toLowerCase()}.`,
      attackSurface: `${assets.length} fictional hosts and ${endpoints.length} evidence-backed demo endpoints were included. The observed stack was ${scenario.stack.join(" and ")}.`,
      riskAssessment: critical ? "The simulated critical candidate would require immediate manual validation and containment if reproduced on an authorized real target." : "The simulated exposure is elevated but requires deterministic manual validation before escalation.",
      testingNarrative: "Synthetic recon data was normalized, bounded non-destructive checks were simulated, and DeepSeek ranked only the supplied example evidence.",
      subdomainHighlights: assets.map((asset, assetIndex) => ({ hostname: asset.hostname, reason: asset.title, priority: assetIndex === 0 ? "high" : "review" })),
      prioritised: scenario.findings.map((item) => ({ title: item.title, rationale: item.rationale ?? "Synthetic evidence requires validation.", safeRetest: "Repeat with a harmless marker and controlled demo identities in an explicitly authorized environment." })),
      recommendations: ["Validate the highest-severity candidate with deterministic evidence.", "Apply server-side authorization and input-handling controls appropriate to the affected endpoint.", "Retest after remediation and retain sanitized evidence."],
      limitations: ["Fictional .test domain; no real host was contacted.", "All evidence and findings are synthetic examples.", "The report must not be used as a disclosure or claim against a real organization."],
      confidence: 88 - (index % 4) * 3,
    },
  };
});
