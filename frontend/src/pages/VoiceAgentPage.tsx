import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  User,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { Card } from '../components/Card';
import { FormattedMessage } from '../components/FormattedMessage';
import { PageHeader } from '../components/PageHeader';
import { ScoreRing } from '../components/ScoreRing';
import { LeadCategoryBadge, SentimentBadge } from '../components/StatusBadge';
import { VoiceVisualizer } from '../components/VoiceVisualizer';
import { useVoiceAgent } from '../hooks/useVoiceAgent';
import { useVoicePreferences } from '../hooks/useVoicePreferences';
import { apiClient } from '../services/api';

const STARTER_PROMPTS = [
  "Hi, I'm looking for an AI-powered CRM.",
  'Can you explain your CRM features and pricing?',
  'We are a small business with five sales representatives. Which plan would you recommend?',
  'I am interested in scheduling a product demo.',
];

export const VoiceAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const { preferences, updatePreferences } = useVoicePreferences();
  const {
    sessionId,
    messages,
    interimTranscript,
    isListening,
    isSending,
    isSpeaking,
    voiceError,
    leadContext,
    sources,
    speechSupport,
    sendMessage,
    toggleListening,
    speakText,
    stopSpeaking,
    resetSession,
  } = useVoiceAgent(preferences);

  const [inputText, setInputText] = useState<string>('');
  const [summaryStatus, setSummaryStatus] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState<boolean>(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript, isSending]);

  const visualizerState = isListening
    ? 'listening'
    : isSending
    ? 'thinking'
    : isSpeaking
    ? 'speaking'
    : 'idle';

  const handleSubmitText = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;
    setInputText('');
    await sendMessage(trimmed, 'text');
  };

  const handleGenerateSummary = async () => {
    if (messages.length === 0 || generatingSummary) return;
    setGeneratingSummary(true);
    setSummaryStatus(null);
    try {
      await apiClient.generateCallSummary(sessionId);
      setSummaryStatus('Structured call summary persisted to CRM.');
    } catch (err) {
      setSummaryStatus(
        err instanceof Error ? err.message : 'Unable to save call summary.'
      );
    } finally {
      setGeneratingSummary(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Autonomous Voice & Text Agent"
        title="Voice Studio"
        description="Real-time prospect qualification, grounded product retrieval, and automated CRM capture."
        actions={
          <>
            {isSpeaking && (
              <button
                type="button"
                onClick={stopSpeaking}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
              >
                <Square className="h-3 w-3 fill-current" />
                Stop Audio
              </button>
            )}
            <button
              type="button"
              onClick={() => updatePreferences({ autoSpeak: !preferences.autoSpeak })}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-card hover:bg-zinc-50"
            >
              {preferences.autoSpeak ? (
                <Volume2 className="h-3.5 w-3.5 text-indigo-600" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-zinc-400" />
              )}
              {preferences.autoSpeak ? 'Auto-Speak On' : 'Auto-Speak Off'}
            </button>
            <button
              type="button"
              onClick={() => void handleGenerateSummary()}
              disabled={messages.length === 0 || generatingSummary}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-card hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5 text-indigo-600" />
              {generatingSummary ? 'Saving...' : 'Save Summary'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSummaryStatus(null);
                resetSession();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              New Session
            </button>
          </>
        }
      />

      {/* Capability & Session Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white/85 px-4 py-2.5 text-xs shadow-card backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Session</span>
            <code className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-800">
              {sessionId}
            </code>
          </div>
          <span className="hidden h-3.5 w-px bg-zinc-200 sm:inline-block" />
          <div className="flex items-center gap-1.5">
            {speechSupport.sttSupported ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            )}
            <span className="text-zinc-600">
              STT: {speechSupport.sttSupported ? 'Ready' : 'Unsupported'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {speechSupport.ttsSupported ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            )}
            <span className="text-zinc-600">
              TTS: {speechSupport.ttsSupported ? 'Ready' : 'Unsupported'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
          <span>Duplicate submission guard active</span>
        </div>
      </div>

      {voiceError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>{voiceError}</span>
        </div>
      )}

      {summaryStatus && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          <span className="font-medium">{summaryStatus}</span>
          <button
            type="button"
            onClick={() => navigate('/summaries')}
            className="font-semibold underline hover:text-emerald-950"
          >
            View Call Summaries
          </button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left/Center: Conversation Console (8 cols) */}
        <Card
          padding="none"
          variant="elevated"
          className="flex h-[640px] flex-col overflow-hidden lg:col-span-8"
        >
          {/* Studio Visualizer Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 bg-zinc-50/70 px-5 py-3.5">
            <VoiceVisualizer state={visualizerState} />

            <button
              type="button"
              onClick={() => void toggleListening()}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-all ${
                isListening
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  Stop Microphone
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  Start Microphone
                </>
              )}
            </button>
          </div>

          {/* Transcript Feed */}
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 && !interimTranscript ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 ring-1 ring-inset ring-indigo-200/70 shadow-sm">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-zinc-950">
                  Start an Autonomous Sales Conversation
                </h3>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-zinc-500">
                  Speak via microphone or choose a prompt below. SalesPilot AI grounds answers in your Knowledge Base, qualifies the lead, and checks live demo availability.
                </p>

                <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isSending}
                      onClick={() => void sendMessage(prompt, 'text')}
                      className="rounded-xl border border-zinc-200/90 bg-zinc-50/70 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-700 transition-all hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-950 disabled:opacity-50"
                    >
                      “{prompt}”
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.role !== 'user' && (
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                          msg.role === 'error'
                            ? 'bg-rose-50 text-rose-600 ring-rose-200'
                            : 'bg-indigo-50 text-indigo-600 ring-indigo-200/80'
                        }`}
                      >
                        {msg.role === 'error' ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </div>
                    )}

                    <div
                      className={`max-w-[84%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-zinc-950 text-white shadow-sm'
                          : msg.role === 'error'
                          ? 'border border-rose-200 bg-rose-50 text-rose-800'
                          : 'border border-zinc-200/90 bg-white text-zinc-800 shadow-card'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <FormattedMessage content={msg.content} />
                      ) : (
                        <p className="text-[13.5px] leading-relaxed">{msg.content}</p>
                      )}

                      {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-2">
                          <Wrench className="h-3 w-3 text-indigo-500" />
                          {Array.from(new Set(msg.toolsUsed)).map((tool) => (
                            <span
                              key={tool}
                              className="rounded-md bg-indigo-50/80 px-2 py-0.5 font-mono text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200/70"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-4">
                        <span
                          className={`font-mono text-[10px] ${
                            msg.role === 'user' ? 'text-zinc-400' : 'text-zinc-400'
                          }`}
                        >
                          {msg.timestamp}
                        </span>
                        {msg.role === 'assistant' && speechSupport.ttsSupported && (
                          <button
                            type="button"
                            onClick={() => speakText(msg.content)}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50"
                          >
                            <Play className="h-3 w-3" />
                            Speak
                          </button>
                        )}
                      </div>
                    </div>

                    {msg.role === 'user' && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {interimTranscript && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/70 px-4 py-2 text-xs italic text-indigo-900">
                      {interimTranscript}...
                    </div>
                  </div>
                )}

                {isSending && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-medium text-zinc-600">
                      Consulting knowledge base & generating response...
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Composer Dock */}
          <form
            onSubmit={(e) => void handleSubmitText(e)}
            className="flex items-center gap-2.5 border-t border-zinc-200/80 bg-zinc-50/70 p-3.5"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about pricing, features, team fit, or request a demo..."
              disabled={isSending}
              aria-label="Customer message input"
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-950 placeholder-zinc-400 shadow-card focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{isSending ? 'Sending' : 'Send'}</span>
            </button>
          </form>
        </Card>

        {/* Right: Live Deal Intelligence Cockpit (4 cols) */}
        <div className="space-y-4 lg:col-span-4">
          <Card>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Live Deal Intelligence
                </p>
                <h3 className="mt-0.5 font-display text-base font-bold text-zinc-950">
                  Lead Qualification
                </h3>
                <div className="mt-2">
                  <LeadCategoryBadge category={leadContext.lead_category} />
                </div>
              </div>
              <ScoreRing
                score={leadContext.lead_score}
                category={leadContext.lead_category}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-zinc-50 p-2.5 ring-1 ring-inset ring-zinc-200/70">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Prospect
                </span>
                <p className="mt-0.5 truncate font-semibold text-zinc-900">
                  {leadContext.name || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-2.5 ring-1 ring-inset ring-zinc-200/70">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Company
                </span>
                <p className="mt-0.5 truncate font-semibold text-zinc-900">
                  {leadContext.company || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-2.5 ring-1 ring-inset ring-zinc-200/70">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Product
                </span>
                <p className="mt-0.5 truncate font-semibold text-zinc-900">
                  {leadContext.product_interest || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-2.5 ring-1 ring-inset ring-zinc-200/70">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Team / Size
                </span>
                <p className="mt-0.5 truncate font-semibold text-zinc-900">
                  {leadContext.company_size || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-2.5 ring-1 ring-inset ring-zinc-200/70">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Budget
                </span>
                <p className="mt-0.5 truncate font-semibold text-zinc-900">
                  {leadContext.budget || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-2.5 ring-1 ring-inset ring-zinc-200/70">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Timeline
                </span>
                <p className="mt-0.5 truncate font-semibold text-zinc-900">
                  {leadContext.timeline || '—'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-zinc-950">
                Text Sentiment & Objections
              </h3>
              <SentimentBadge sentiment={leadContext.sentiment} />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Analyzed from conversation transcript text.
            </p>

            <div className="mt-3">
              {leadContext.objections.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {leadContext.objections.map((obj, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
                    >
                      {obj}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No objections flagged in session.</p>
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-600" />
                <h3 className="font-display text-sm font-bold text-zinc-950">
                  Grounded Sources
                </h3>
              </div>
              {sources.length > 0 && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-700">
                  {sources.length} chunks
                </span>
              )}
            </div>

            {sources.length > 0 ? (
              <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
                {sources.map((src, i) => (
                  <div
                    key={`${src.chunk_id}_${i}`}
                    className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-zinc-900">
                        {src.document_name}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-indigo-600">
                        {(src.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${Math.min(100, Math.round(src.score * 100))}%` }}
                      />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-600">
                      {src.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                Retrieved FAISS documentation excerpts appear here when product or pricing questions are answered.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
