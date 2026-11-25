from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List


@dataclass
class KnowledgeDocumentMeta:
    id: str
    filename: str
    title: str
    category: str
    chunk_count: int
    character_count: int
    updated_at: str


@dataclass
class DocumentChunk:
    chunk_id: str
    document_id: str
    document_name: str
    title: str
    category: str
    content: str


def _infer_title(text: str, fallback: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback.replace("_", " ").replace("-", " ").title()


def _infer_category(filename: str) -> str:
    lower = filename.lower()
    if "pricing" in lower:
        return "Pricing"
    if "security" in lower or "compliance" in lower:
        return "Security"
    if "integration" in lower or "faq" in lower:
        return "Onboarding & FAQ"
    if "product" in lower or "overview" in lower:
        return "Product"
    return "General"


def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 80) -> List[str]:
    """Split text into overlapping chunks without breaking mid-word where avoidable."""
    cleaned = "\n".join(line.rstrip() for line in text.strip().splitlines()).strip()
    if not cleaned:
        return []
    if len(cleaned) <= chunk_size:
        return [cleaned]

    chunks: List[str] = []
    start = 0
    length = len(cleaned)
    step_floor = max(50, chunk_size - chunk_overlap)

    while start < length:
        end = min(start + chunk_size, length)
        if end < length:
            # Prefer splitting on a paragraph or sentence boundary near the end
            split_at = cleaned.rfind("\n\n", start + step_floor // 2, end)
            if split_at == -1:
                split_at = cleaned.rfind("\n", start + step_floor // 2, end)
            if split_at == -1:
                split_at = cleaned.rfind(". ", start + step_floor // 2, end)
            if split_at == -1:
                split_at = cleaned.rfind(" ", start + step_floor // 2, end)
            if split_at != -1 and split_at > start:
                end = split_at + 1

        piece = cleaned[start:end].strip()
        if piece:
            chunks.append(piece)

        if end >= length:
            break
        next_start = end - chunk_overlap
        start = next_start if next_start > start else end

    return chunks


def load_knowledge_documents(
    kb_dir: Path, chunk_size: int = 500, chunk_overlap: int = 80
) -> tuple[List[KnowledgeDocumentMeta], List[DocumentChunk]]:
    """Load Markdown and plain-text knowledge documents and split into chunks."""
    if not kb_dir.exists() or not kb_dir.is_dir():
        return [], []

    docs_meta: List[KnowledgeDocumentMeta] = []
    all_chunks: List[DocumentChunk] = []

    files = sorted(
        [p for p in kb_dir.iterdir() if p.is_file() and p.suffix.lower() in {".md", ".txt"}],
        key=lambda p: p.name.lower(),
    )

    for path in files:
        raw_text = path.read_text(encoding="utf-8", errors="ignore").strip()
        if not raw_text:
            continue

        doc_id = path.stem
        title = _infer_title(raw_text, path.stem)
        category = _infer_category(path.name)
        pieces = chunk_text(raw_text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()

        docs_meta.append(
            KnowledgeDocumentMeta(
                id=doc_id,
                filename=path.name,
                title=title,
                category=category,
                chunk_count=len(pieces),
                character_count=len(raw_text),
                updated_at=mtime,
            )
        )

        for idx, piece in enumerate(pieces):
            all_chunks.append(
                DocumentChunk(
                    chunk_id=f"{doc_id}__chunk_{idx}",
                    document_id=doc_id,
                    document_name=path.name,
                    title=title,
                    category=category,
                    content=piece,
                )
            )

    return docs_meta, all_chunks
