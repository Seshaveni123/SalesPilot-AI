import React, { useEffect, useState } from 'react';
import { BookOpen, DatabaseZap, FileCheck2, RefreshCw, Search } from 'lucide-react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { apiClient } from '../services/api';
import type { KnowledgeDocument, RetrievedSource } from '../types';

export const KnowledgeBasePage: React.FC = () => {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<RetrievedSource[]>([]);
  const [searchPerformed, setSearchPerformed] = useState<boolean>(false);
  const [available, setAvailable] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [searching, setSearching] = useState<boolean>(false);
  const [reindexing, setReindexing] = useState<boolean>(false);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await apiClient.getKnowledgeDocuments();
      setDocuments(docs);
    } catch (err) {
      setDocuments([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load indexed knowledge base documents.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchPerformed(true);
    try {
      const resp = await apiClient.queryKnowledgeBase(query.trim());
      setAvailable(resp.available);
      setResults(resp.sources);
    } catch (err) {
      setResults([]);
      setSearchError(
        err instanceof Error ? err.message : 'Semantic retrieval request failed.'
      );
    } finally {
      setSearching(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setReindexMsg(null);
    try {
      const resp = await apiClient.reindexKnowledgeBase();
      setReindexMsg(`FAISS vector index rebuilt (${resp.indexed_chunks} chunks).`);
      await loadDocuments();
    } catch (err) {
      setReindexMsg(
        err instanceof Error ? err.message : 'Unable to rebuild vector index.'
      );
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="Inspect indexed company product documentation and test semantic FAISS vector retrieval."
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleReindex()}
              disabled={reindexing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <DatabaseZap className="h-3.5 w-3.5 text-brand-600" />
              {reindexing ? 'Indexing...' : 'Rebuild Vector Index'}
            </button>
            <button
              type="button"
              onClick={() => void loadDocuments()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      {reindexMsg && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs font-medium text-brand-900">
          {reindexMsg}
        </div>
      )}

      {/* Semantic Search Tester */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          Semantic Retrieval Test
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Query the FAISS index directly to inspect the exact document chunks supplied to the AI agent.
        </p>
        <form onSubmit={(e) => void handleSearch(e)} className="mt-3 flex gap-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Growth plan pricing, SOC 2 security, CRM integrations..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || searching}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Retrieve Chunks'}
          </button>
        </form>

        {searchError && (
          <p className="mt-3 text-xs text-rose-600">{searchError}</p>
        )}

        {searchPerformed && !searching && !searchError && !available && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            No relevant information matched this query above the similarity threshold. The AI assistant admits when information is unavailable rather than guessing.
          </p>
        )}

        {results.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {results.map((src) => (
              <div
                key={src.chunk_id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span>{src.document_name}</span>
                  <span className="font-mono text-brand-600">
                    Similarity {(src.score * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-line leading-relaxed text-slate-600">
                  {src.excerpt}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Indexed Documents */}
      {error ? (
        <EmptyState
          icon={BookOpen}
          tone="warning"
          title="Knowledge index unavailable"
          description={error}
        />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No indexed documents loaded"
          description="Indexed product guides, pricing matrices, and FAQ documents will appear here once the knowledge service is connected."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-brand-600" />
                  <h3 className="text-sm font-semibold text-slate-900">{doc.title}</h3>
                </div>
                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {doc.category}
                </span>
              </div>
              <p className="font-mono text-xs text-slate-500">{doc.filename}</p>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                <span>{doc.chunk_count} chunks</span>
                <span>{doc.character_count.toLocaleString()} chars</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
