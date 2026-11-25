from functools import lru_cache
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.agents.gemini_client import GeminiClientWrapper
from app.agents.orchestrator import SalesAgentOrchestrator
from app.config import Settings, get_settings
from app.database.session import check_db_connection, get_db
from app.rag.vector_store import FAISSVectorStore, SentenceTransformerEmbedder
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationMessageResponse,
    ConversationSessionResponse,
    RetrievedSourceSchema,
)
from app.schemas.common import HealthResponse
from app.schemas.crm import (
    AnalyticsOverviewResponse,
    AppointmentCreate,
    AppointmentResponse,
    AppointmentSlotsResponse,
    CallSummaryResponse,
    LeadCreate,
    LeadDetailsResponse,
    LeadResponse,
    LeadUpdate,
)
from app.services import appointment_service, crm_service, summary_service
from app.services.appointment_service import (
    AppointmentConflictError,
    AppointmentValidationError,
)
from app.services.conversation_manager import ConversationManager
from app.tools.registry import AgentToolDispatcher

router = APIRouter(prefix="/api", tags=["SalesPilot API"])


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)


class KnowledgeSearchResponse(BaseModel):
    query: str
    available: bool
    sources: List[RetrievedSourceSchema]


@lru_cache
def _get_shared_vector_store(
    index_path: str, kb_dir: str, model_name: str, chunk_size: int, chunk_overlap: int
) -> FAISSVectorStore:
    embedder = SentenceTransformerEmbedder(model_name=model_name)
    return FAISSVectorStore(
        index_dir=Path(index_path),
        kb_dir=Path(kb_dir),
        embedder=embedder,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )


def get_vector_store(settings: Settings = Depends(get_settings)) -> FAISSVectorStore:
    return _get_shared_vector_store(
        index_path=settings.faiss_index_path,
        kb_dir=settings.knowledge_base_dir,
        model_name=settings.embedding_model,
        chunk_size=settings.rag_chunk_size,
        chunk_overlap=settings.rag_chunk_overlap,
    )


def get_orchestrator(
    settings: Settings = Depends(get_settings),
    vector_store: FAISSVectorStore = Depends(get_vector_store),
) -> SalesAgentOrchestrator:
    conversation_manager = ConversationManager()
    dispatcher = AgentToolDispatcher(
        conversation_manager=conversation_manager,
        vector_store=vector_store,
        rag_top_k=settings.rag_top_k,
        timezone_name=settings.app_timezone,
    )
    gemini_client = GeminiClientWrapper(settings=settings)
    return SalesAgentOrchestrator(
        gemini_client=gemini_client,
        conversation_manager=conversation_manager,
        tool_dispatcher=dispatcher,
        timezone_name=settings.app_timezone,
    )


@router.get("/health", response_model=HealthResponse)
def health_check(
    settings: Settings = Depends(get_settings),
    vector_store: FAISSVectorStore = Depends(get_vector_store),
) -> HealthResponse:
    db_ok = check_db_connection()
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        gemini_configured=settings.is_gemini_configured,
        database_connected=db_ok,
        rag_indexed=vector_store.is_persisted(),
        environment=settings.app_env,
    )


@router.post("/agent/chat", response_model=ChatResponse)
def agent_chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    orchestrator: SalesAgentOrchestrator = Depends(get_orchestrator),
) -> ChatResponse:
    return orchestrator.handle_turn(
        db=db,
        session_id=payload.session_id,
        user_message=payload.message.strip(),
        channel=payload.channel,
    )


@router.get("/leads", response_model=List[LeadResponse])
def get_leads(db: Session = Depends(get_db)) -> List[LeadResponse]:
    return crm_service.list_leads(db)


@router.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)) -> LeadResponse:
    return crm_service.create_lead(db, payload)


@router.get("/leads/{lead_id}", response_model=LeadResponse)
def get_lead_by_id(lead_id: int, db: Session = Depends(get_db)) -> LeadResponse:
    lead = crm_service.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead {lead_id} not found.",
        )
    return lead


@router.get("/leads/{lead_id}/details", response_model=LeadDetailsResponse)
def get_lead_details_by_id(
    lead_id: int, db: Session = Depends(get_db)
) -> LeadDetailsResponse:
    details = crm_service.get_lead_details(db, lead_id)
    if not details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead {lead_id} not found.",
        )
    return details


@router.patch("/leads/{lead_id}", response_model=LeadResponse)
def patch_lead(
    lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db)
) -> LeadResponse:
    lead = crm_service.update_lead(db, lead_id, payload)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead {lead_id} not found.",
        )
    return lead


@router.get("/conversations", response_model=List[ConversationSessionResponse])
def get_conversations(db: Session = Depends(get_db)) -> List[ConversationSessionResponse]:
    return crm_service.list_conversations(db)


@router.get(
    "/conversations/{session_id}/messages",
    response_model=List[ConversationMessageResponse],
)
def get_conversation_messages(
    session_id: str, db: Session = Depends(get_db)
) -> List[ConversationMessageResponse]:
    return crm_service.get_conversation_messages(db, session_id)


@router.get("/appointments", response_model=List[AppointmentResponse])
def get_appointments(db: Session = Depends(get_db)) -> List[AppointmentResponse]:
    return crm_service.list_appointments(db)


@router.get("/appointments/slots", response_model=AppointmentSlotsResponse)
def get_available_slots(
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db),
) -> AppointmentSlotsResponse:
    try:
        slots = appointment_service.get_available_slots(db, date)
        return AppointmentSlotsResponse(date=date, available_slots=slots)
    except AppointmentValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_appointment(
    payload: AppointmentCreate, db: Session = Depends(get_db)
) -> AppointmentResponse:
    try:
        return appointment_service.book_appointment(
            db=db,
            lead_id=payload.lead_id,
            scheduled_date=payload.scheduled_date,
            scheduled_time=payload.scheduled_time,
            topic=payload.topic,
        )
    except AppointmentConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except AppointmentValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/summaries", response_model=List[CallSummaryResponse])
def get_summaries(db: Session = Depends(get_db)) -> List[CallSummaryResponse]:
    return crm_service.list_summaries(db)


@router.post(
    "/summaries/generate/{session_id}",
    response_model=CallSummaryResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_summary(
    session_id: str, db: Session = Depends(get_db)
) -> CallSummaryResponse:
    try:
        return summary_service.generate_and_save_summary(db=db, session_id=session_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get("/analytics/overview", response_model=AnalyticsOverviewResponse)
def get_analytics_overview(db: Session = Depends(get_db)) -> AnalyticsOverviewResponse:
    return crm_service.get_analytics_overview(db)


@router.get("/knowledge/documents")
def get_knowledge_documents(
    vector_store: FAISSVectorStore = Depends(get_vector_store),
) -> List[dict]:
    return vector_store.list_documents()


@router.post("/knowledge/reindex")
def reindex_knowledge_base(
    vector_store: FAISSVectorStore = Depends(get_vector_store),
) -> dict:
    chunk_count = vector_store.build_index()
    return {"status": "ok", "indexed_chunks": chunk_count}


@router.post("/knowledge/search", response_model=KnowledgeSearchResponse)
def search_knowledge_base(
    payload: KnowledgeSearchRequest,
    settings: Settings = Depends(get_settings),
    vector_store: FAISSVectorStore = Depends(get_vector_store),
) -> KnowledgeSearchResponse:
    result = vector_store.search(payload.query, top_k=settings.rag_top_k)
    return KnowledgeSearchResponse(
        query=payload.query,
        available=result["available"],
        sources=[RetrievedSourceSchema(**s) for s in result["sources"]],
    )
