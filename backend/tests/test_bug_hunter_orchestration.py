from __future__ import annotations

from typing import Any

import app.services.agent as agent_module
from app.api.agent_bridge import _build_assessment_prompt, _redact_event_value, _redact_known_text
from app.services.agent import AgentService


def test_assessment_prompt_runs_full_journal_and_skill_workflow() -> None:
    prompt = _build_assessment_prompt(
        host="app.example.com",
        command="assess",
        auth_profile="Bearer token",
        credentials="token=test-only-value",
        headers="X-Test: safe",
        notes="Stay under 2 requests per second",
        scoped_assets=["api.app.example.com"],
        phases=["subdomains", "endpoints", "static"],
        skills=["bb-methodology", "hunt-spa-api", "hunt-access-control"],
        model_id="deepseek-v4-flash",
    )

    assert not prompt.startswith("/assess")
    assert "one continuous journal" in prompt
    assert "JavaScript bundles/chunks" in prompt
    assert "coverage matrix" in prompt
    assert "hunt-spa-api" in prompt
    assert "api.app.example.com" in prompt
    assert "denial of service" in prompt
    assert "---VULNEXA_RESULT_START---" in prompt


def test_tool_event_redaction_preserves_safe_telemetry() -> None:
    redacted = _redact_event_value({
        "status": "completed",
        "input": {"url": "https://example.com/api", "Authorization": "Bearer sensitive"},
        "output": {"count": 4, "token": "sensitive"},
    })

    assert redacted["status"] == "completed"
    assert redacted["input"]["url"] == "https://example.com/api"
    assert redacted["input"]["Authorization"] == "[redacted]"
    assert redacted["output"]["token"] == "[redacted]"
    assert _redact_known_text("request used Bearer sensitive-value", ["Authorization: Bearer sensitive-value"]) == "request used [redacted]"


def test_javascript_intelligence_extracts_scoped_api_routes(monkeypatch: Any) -> None:
    javascript = """
      fetch('/api/users?limit=10');
      axios.post('/v1/session');
      const graph = '/graphql';
      const orders = 'https://api.example.com/v2/orders';
      const vendor = 'https://thirdparty.invalid/api/telemetry';
      const config = { apiKey: 'abcdefghijklmnop123456' };
      //# sourceMappingURL=app.js.map
    """

    class Response:
        status_code = 200
        content = javascript.encode()
        text = javascript

    class Client:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        def __enter__(self) -> "Client":
            return self

        def __exit__(self, *args: Any) -> None:
            return None

        def get(self, url: str) -> Response:
            assert url == "https://app.example.com/_next/app.js"
            return Response()

    monkeypatch.setattr(agent_module, "_safe_host", lambda host: True)
    monkeypatch.setattr(agent_module.httpx, "Client", Client)

    service = AgentService.__new__(AgentService)
    evidence: dict[str, Any] = {"jsBundles": ["https://app.example.com/_next/app.js"]}
    endpoints: list[dict[str, Any]] = []
    service._javascript_intelligence("app.example.com", "example.com", evidence, endpoints)

    urls = {item["url"] for item in endpoints}
    methods = {(item["method"], item["url"]) for item in endpoints}
    assert "https://app.example.com/api/users?limit=10" in urls
    assert ("POST", "https://app.example.com/v1/session") in methods
    assert "https://app.example.com/graphql" in urls
    assert "https://api.example.com/v2/orders" in urls
    assert "thirdparty.invalid" in evidence["externalApiHosts"]
    assert evidence["sourceMaps"] == ["https://app.example.com/_next/app.js.map"]
    assert evidence["jsSecretSignals"] == 1
