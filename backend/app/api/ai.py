from __future__ import annotations

from fastapi import APIRouter, Query, Request

from app.api.common import query_items, visible_items, visible_record
from app.api.deps import CurrentUser, Repositories, ensure_workspace_access
from app.models.domain import ConversationMessage
from app.schemas.requests import AIChatRequest, FindingAnalysisRequest
from app.services.audit import audit
from app.utils.errors import conflict
from app.utils.sanitize import sanitize_text


router = APIRouter(prefix="/api/ai", tags=["ai-analyst"])


def _analysis_for_context(request: object, repositories: object, payload: AIChatRequest, user: object) -> object:
    adapter = request.app.state.ai_adapter
    if payload.finding_id:
        finding = visible_record(repositories["findings"], payload.finding_id, user, "Finding")
        if finding.workspace_id != payload.workspace_id:
            raise conflict("Finding does not belong to the requested workspace")
        return adapter.analyze_finding(finding, payload.question)
    scan = visible_record(repositories["scans"], payload.scan_id, user, "Scan")
    if scan.workspace_id != payload.workspace_id:
        raise conflict("Scan does not belong to the requested workspace")
    return adapter.summarize_scan(scan, payload.question)


@router.post("/chat")
def chat(
    payload: AIChatRequest,
    request: Request,
    repositories: Repositories,
    user: CurrentUser,
) -> dict[str, object]:
    ensure_workspace_access(user, payload.workspace_id)
    analysis = _analysis_for_context(request, repositories, payload, user)
    safe_question = sanitize_text(payload.question, limit=4000)
    safe_answer = analysis.model_dump_json(by_alias=True)
    if payload.conversation_id:
        conversation = visible_record(
            repositories["ai_conversations"], payload.conversation_id, user, "AI conversation"
        )
        if conversation.workspace_id != payload.workspace_id or conversation.user_id != user.id:
            raise conflict("Conversation ownership does not match this request")
        if conversation.finding_id != payload.finding_id or conversation.scan_id != payload.scan_id:
            raise conflict("Conversation evidence context cannot be changed")
        messages = [message.model_dump(mode="json", by_alias=True) for message in conversation.messages]
        messages.extend(
            [
                ConversationMessage(role="user", content=safe_question).model_dump(mode="json", by_alias=True),
                ConversationMessage(role="assistant", content=safe_answer).model_dump(mode="json", by_alias=True),
            ]
        )
        conversation = repositories["ai_conversations"].update(conversation.id, {"messages": messages[-100:]})
    else:
        conversation = repositories["ai_conversations"].create(
            {
                "workspaceId": payload.workspace_id,
                "userId": user.id,
                "title": safe_question[:80],
                "findingId": payload.finding_id,
                "scanId": payload.scan_id,
                "provider": request.app.state.settings.ai_provider,
                "model": request.app.state.settings.ai_model,
                "messages": [
                    ConversationMessage(role="user", content=safe_question).model_dump(mode="json", by_alias=True),
                    ConversationMessage(role="assistant", content=safe_answer).model_dump(mode="json", by_alias=True),
                ],
            }
        )
    audit(
        repositories,
        "ai.analyze",
        "ai_conversation",
        actor=user,
        resource_id=conversation.id,
        workspace_id=payload.workspace_id,
        details={"findingId": payload.finding_id, "scanId": payload.scan_id, "provider": request.app.state.settings.ai_provider},
    )
    return {"conversationId": conversation.id, "analysis": analysis}


@router.post("/analyze-finding")
def analyze_finding(
    payload: FindingAnalysisRequest,
    request: Request,
    repositories: Repositories,
    user: CurrentUser,
) -> object:
    finding = visible_record(repositories["findings"], payload.finding_id, user, "Finding")
    analysis = request.app.state.ai_adapter.analyze_finding(finding)
    # AI content is stored for reference, but verificationState is deliberately untouched.
    repositories["findings"].update(finding.id, {"aiAnalysis": analysis.model_dump(mode="json", by_alias=True)})
    audit(
        repositories,
        "ai.analyze_finding",
        "finding",
        actor=user,
        resource_id=finding.id,
        workspace_id=finding.workspace_id,
        details={"verificationStateChanged": False},
    )
    return analysis


@router.post("/generate-remediation")
def generate_remediation(
    payload: FindingAnalysisRequest,
    request: Request,
    repositories: Repositories,
    user: CurrentUser,
) -> dict[str, object]:
    analysis = analyze_finding(payload, request, repositories, user)
    return {"findingId": payload.finding_id, "remediation": analysis.remediation, "safeNextSteps": analysis.safe_next_steps}


@router.get("/conversations")
def list_conversations(
    repositories: Repositories,
    user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, alias="pageSize", ge=1, le=200),
) -> dict[str, object]:
    items = [item for item in visible_items(repositories["ai_conversations"], user) if item.user_id == user.id or user.role == "admin"]
    return query_items(
        repositories["ai_conversations"], items, page=page, page_size=page_size, sort_by="updatedAt", sort_order="desc"
    )


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, repositories: Repositories, user: CurrentUser) -> object:
    conversation = visible_record(repositories["ai_conversations"], conversation_id, user, "AI conversation")
    if conversation.user_id != user.id and user.role != "admin":
        from app.utils.errors import not_found

        raise not_found("AI conversation")
    return conversation
