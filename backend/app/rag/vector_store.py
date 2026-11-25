import json
import os
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Protocol

import faiss
import numpy as np

from app.rag.document_loader import (
    DocumentChunk,
    KnowledgeDocumentMeta,
    load_knowledge_documents,
)


class EmbedderProtocol(Protocol):
    """Interface for text embedding providers."""

    def encode(self, texts: List[str]) -> np.ndarray:
        ...


class SentenceTransformerEmbedder:
    """Lazy-loading SentenceTransformers embedder."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model: Any = None

    def _get_model(self):
        if self._model is None:
            # Prefer local HuggingFace cache first to avoid slow offline Hub checks.
            prev_offline = os.environ.get("HF_HUB_OFFLINE")
            try:
                os.environ["HF_HUB_OFFLINE"] = "1"
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(
                    self.model_name, local_files_only=True
                )
            except Exception:
                if prev_offline is None:
                    os.environ.pop("HF_HUB_OFFLINE", None)
                else:
                    os.environ["HF_HUB_OFFLINE"] = prev_offline
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(self.model_name)
        return self._model

    def encode(self, texts: List[str]) -> np.ndarray:
        model = self._get_model()
        vectors = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return np.asarray(vectors, dtype=np.float32)


class FAISSVectorStore:
    """Manages FAISS index persistence, chunk metadata, and cosine similarity search."""

    def __init__(
        self,
        index_dir: Path,
        kb_dir: Path,
        embedder: EmbedderProtocol,
        chunk_size: int = 500,
        chunk_overlap: int = 80,
    ):
        self.index_dir = Path(index_dir)
        self.kb_dir = Path(kb_dir)
        self.embedder = embedder
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        self._index: Any = None
        self._chunks: List[DocumentChunk] = []
        self._documents: List[KnowledgeDocumentMeta] = []

    @property
    def index_file(self) -> Path:
        return self.index_dir / "index.faiss"

    @property
    def chunks_file(self) -> Path:
        return self.index_dir / "chunks.json"

    @property
    def documents_file(self) -> Path:
        return self.index_dir / "documents.json"

    def is_persisted(self) -> bool:
        return (
            self.index_file.exists()
            and self.chunks_file.exists()
            and self.documents_file.exists()
        )

    def build_index(self) -> int:
        """Load documents from kb_dir, compute embeddings, and persist FAISS index."""
        docs_meta, chunks = load_knowledge_documents(
            self.kb_dir,
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )
        self._documents = docs_meta
        self._chunks = chunks

        if not chunks:
            self._index = None
            return 0

        vectors = self.embedder.encode([c.content for c in chunks])
        vectors = np.asarray(vectors, dtype=np.float32)
        if vectors.ndim == 1:
            vectors = vectors.reshape(1, -1)

        faiss.normalize_L2(vectors)
        dim = vectors.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(vectors)
        self._index = index

        self.index_dir.mkdir(parents=True, exist_ok=True)
        faiss.write_index(index, str(self.index_file))
        self.chunks_file.write_text(
            json.dumps([asdict(c) for c in chunks], indent=2), encoding="utf-8"
        )
        self.documents_file.write_text(
            json.dumps([asdict(d) for d in docs_meta], indent=2), encoding="utf-8"
        )
        return len(chunks)

    def load_index(self) -> bool:
        """Load an existing FAISS index and metadata from disk."""
        if not self.is_persisted():
            return False
        self._index = faiss.read_index(str(self.index_file))
        raw_chunks = json.loads(self.chunks_file.read_text(encoding="utf-8"))
        raw_docs = json.loads(self.documents_file.read_text(encoding="utf-8"))
        self._chunks = [DocumentChunk(**item) for item in raw_chunks]
        self._documents = [KnowledgeDocumentMeta(**item) for item in raw_docs]
        return True

    def ensure_loaded(self) -> None:
        if self._index is not None and self._chunks:
            return
        if not self.load_index():
            self.build_index()

    def list_documents(self) -> List[Dict[str, Any]]:
        if self.is_persisted():
            if not self._documents:
                self.load_index()
            return [asdict(d) for d in self._documents]
        docs_meta, _ = load_knowledge_documents(
            self.kb_dir,
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )
        return [asdict(d) for d in docs_meta]

    def search(
        self, query: str, top_k: int = 4, min_score: float = 0.22
    ) -> Dict[str, Any]:
        """Search indexed chunks by cosine similarity."""
        cleaned = query.strip()
        if not cleaned:
            return {"available": False, "sources": []}

        self.ensure_loaded()
        if self._index is None or not self._chunks:
            return {"available": False, "sources": []}

        q_vec = self.embedder.encode([cleaned])
        q_vec = np.asarray(q_vec, dtype=np.float32)
        if q_vec.ndim == 1:
            q_vec = q_vec.reshape(1, -1)
        faiss.normalize_L2(q_vec)

        k = min(top_k, len(self._chunks))
        scores, indices = self._index.search(q_vec, k)

        sources: List[Dict[str, Any]] = []
        for raw_score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self._chunks):
                continue
            clipped_score = max(0.0, min(1.0, float(raw_score)))
            if clipped_score < min_score:
                continue
            chunk = self._chunks[idx]
            sources.append(
                {
                    "document_name": chunk.document_name,
                    "chunk_id": chunk.chunk_id,
                    "score": round(clipped_score, 4),
                    "excerpt": chunk.content,
                }
            )

        return {"available": len(sources) > 0, "sources": sources}
