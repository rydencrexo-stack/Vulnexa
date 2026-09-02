from __future__ import annotations

import csv
import html
import json
import os
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.domain import Finding, Report, Scan, Target
from app.repositories.registry import RepositoryRegistry


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _atomic_text(path: Path, content: str) -> None:
    descriptor, temporary_name = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.stem}.", suffix=".tmp")
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


class ReportService:
    def __init__(self, repositories: RepositoryRegistry, report_directory: Path) -> None:
        self.repositories = repositories
        self.report_directory = report_directory.resolve()
        self.report_directory.mkdir(parents=True, exist_ok=True)

    def generate(self, report: Report) -> Report:
        target = self.repositories["targets"].get_by_id(report.target_id) if report.target_id else None
        scan = self.repositories["scans"].get_by_id(report.scan_id) if report.scan_id else None
        findings = self.repositories["findings"].filter(workspace_id=report.workspace_id)
        if report.target_id:
            findings = [finding for finding in findings if finding.target_id == report.target_id]
        if report.scan_id:
            findings = [finding for finding in findings if finding.scan_id == report.scan_id]
        payload = self._payload(report, target, scan, findings)
        files: dict[str, str] = {}
        for output_format in report.formats:
            filename = f"{report.id}.{output_format}"
            path = self.report_directory / filename
            if output_format == "json":
                _atomic_text(path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
            elif output_format == "csv":
                self._write_csv(path, findings)
            elif output_format == "html":
                _atomic_text(path, self._html(payload))
            elif output_format == "pdf":
                self._write_pdf(path, payload, findings)
            files[output_format] = filename
        return self.repositories["reports"].update(
            report.id,
            {
                "status": "completed",
                "files": files,
                "summary": payload["findingsSummary"],
                "generatedAt": _iso_now(),
            },
        )

    def _payload(
        self,
        report: Report,
        target: Target | None,
        scan: Scan | None,
        findings: list[Finding],
    ) -> dict[str, Any]:
        counts = Counter(str(finding.severity) for finding in findings)
        target_data = None
        scope = None
        if target:
            target_data = {"id": target.id, "name": target.name, "baseUrl": str(target.base_url), "domain": target.domain}
            scope = target.scope.model_dump(mode="json", by_alias=True)
        return {
            "report": {"id": report.id, "name": report.name, "type": report.type},
            "target": target_data,
            "scope": scope,
            "methodology": "PAN safe authorized assessment workflow; external scanners are mocked in this MVP.",
            "scanModules": list(scan.modules) if scan else [],
            "coverage": {
                "findingCount": len(findings),
                "scanId": scan.id if scan else None,
                "scanStatus": scan.status if scan else None,
                "scanProgress": scan.progress if scan else None,
                "statistics": scan.statistics.model_dump(mode="json", by_alias=True) if scan else {},
            },
            "findingsSummary": {"total": len(findings), "bySeverity": dict(counts)},
            "detailedFindings": [
                {
                    "id": finding.id,
                    "title": finding.title,
                    "severity": finding.severity,
                    "confidence": finding.confidence,
                    "verificationState": finding.verification_state,
                    "description": finding.description,
                    "impact": finding.impact,
                    "evidenceReferences": finding.evidence.references,
                    "remediation": finding.remediation,
                }
                for finding in findings
            ],
            "limitations": [
                "Mock scanner mode does not send live traffic.",
                "Results should be reviewed by an authorized security analyst.",
            ],
            "generatedTimestamp": _iso_now(),
        }

    def _write_csv(self, path: Path, findings: list[Finding]) -> None:
        def safe_cell(value: Any) -> Any:
            if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
                return "'" + value
            return value

        descriptor, temporary_name = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.stem}.", suffix=".tmp")
        temporary = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
                writer = csv.writer(handle)
                writer.writerow(["ID", "Title", "Severity", "Confidence", "Verification", "CWE", "Remediation"])
                for finding in findings:
                    writer.writerow(
                        [
                            safe_cell(finding.id),
                            safe_cell(finding.title),
                            finding.severity,
                            finding.confidence,
                            finding.verification_state,
                            safe_cell(finding.cwe or ""),
                            safe_cell(finding.remediation),
                        ]
                    )
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)

    def _html(self, payload: dict[str, Any]) -> str:
        rows = "".join(
            "<tr>"
            + "".join(
                f"<td>{html.escape(str(value))}</td>"
                for value in (
                    item["title"],
                    item["severity"],
                    item["confidence"],
                    item["verificationState"],
                    item["remediation"],
                )
            )
            + "</tr>"
            for item in payload["detailedFindings"]
        )
        return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>{html.escape(payload['report']['name'])}</title><style>
body{{font:14px Arial,sans-serif;color:#14213d;margin:40px}} h1{{color:#006d77}}
table{{border-collapse:collapse;width:100%}}th,td{{border:1px solid #ccd5df;padding:8px;text-align:left}}
th{{background:#edf6f9}}.notice{{padding:12px;background:#fff4d6;border-left:4px solid #f4a261}}</style></head>
<body><h1>{html.escape(payload['report']['name'])}</h1><p>Generated {html.escape(payload['generatedTimestamp'])}</p>
<div class="notice">Authorized security use only. This MVP used mock scanner execution.</div>
<h2>Scope</h2><pre>{html.escape(json.dumps(payload['scope'], indent=2))}</pre>
<h2>Methodology</h2><p>{html.escape(payload['methodology'])}</p>
<h2>Findings</h2><table><thead><tr><th>Title</th><th>Severity</th><th>Confidence</th><th>State</th><th>Remediation</th></tr></thead>
<tbody>{rows}</tbody></table><h2>Limitations</h2><ul>{''.join(f'<li>{html.escape(item)}</li>' for item in payload['limitations'])}</ul></body></html>"""

    def _write_pdf(self, path: Path, payload: dict[str, Any], findings: list[Finding]) -> None:
        styles = getSampleStyleSheet()
        story: list[Any] = [
            Paragraph(html.escape(payload["report"]["name"]), styles["Title"]),
            Spacer(1, 6 * mm),
            Paragraph("Authorized security use only. Scanner execution was mocked.", styles["Heading3"]),
            Paragraph(html.escape(payload["methodology"]), styles["BodyText"]),
            Spacer(1, 4 * mm),
            Paragraph(f"Findings: {len(findings)}", styles["Heading2"]),
        ]
        data = [["Severity", "Title", "Confidence", "State"]]
        data.extend(
            [str(finding.severity), finding.title[:80], f"{finding.confidence}%", str(finding.verification_state)]
            for finding in findings
        )
        table = Table(data, colWidths=[27 * mm, 90 * mm, 25 * mm, 34 * mm], repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#006d77")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(table)
        for finding in findings:
            story.extend(
                [
                    PageBreak(),
                    Paragraph(html.escape(finding.title), styles["Heading1"]),
                    Paragraph(f"Severity: {finding.severity} | Confidence: {finding.confidence}%", styles["BodyText"]),
                    Paragraph(html.escape(finding.description), styles["BodyText"]),
                    Paragraph("Remediation", styles["Heading2"]),
                    Paragraph(html.escape(finding.remediation), styles["BodyText"]),
                ]
            )
        SimpleDocTemplate(str(path), pagesize=A4, rightMargin=15 * mm, leftMargin=15 * mm).build(story)

    def resolve_download(self, report: Report, output_format: str) -> Path | None:
        filename = report.files.get(output_format)
        if not filename or Path(filename).name != filename:
            return None
        candidate = (self.report_directory / filename).resolve()
        if candidate.parent != self.report_directory or not candidate.is_file():
            return None
        return candidate
