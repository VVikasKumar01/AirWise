import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Leaf, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import {
  IMAGE_ASSETS,
  LIMITS,
  SUGGESTED_QUESTIONS,
} from '../shared/constants.ts';
import type {
  AirQualityData,
  ChatMessage,
  ImpactAction,
  UserPreferences,
} from '../shared/types.ts';

interface AssistantPageProps {
  aqiData: AirQualityData | null;
  preferences: UserPreferences;
  impactActions: ImpactAction[];
  messages: ChatMessage[];
  onMessagesChange: (next: ChatMessage[]) => void;
}

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  const blocks: Array<{ type: 'p' | 'ul'; items: string[] }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ul') {
        last.items.push(bulletMatch[1]);
      } else {
        blocks.push({ type: 'ul', items: [bulletMatch[1]] });
      }
    } else {
      blocks.push({ type: 'p', items: [line] });
    }
  }

  const renderInlineBold = (segment: string) => {
    const parts = segment.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-[#1F2937]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed text-[#1F2937]">
      {blocks.map((block, bIdx) =>
        block.type === 'ul' ? (
          <ul key={bIdx} className="list-disc pl-5 space-y-1">
            {block.items.map((item, iIdx) => (
              <li key={iIdx}>{renderInlineBold(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={bIdx}>{renderInlineBold(block.items[0])}</p>
        ),
      )}
    </div>
  );
}

export function AssistantPage({
  aqiData,
  preferences,
  impactActions,
  messages,
  onMessagesChange,
}: AssistantPageProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [messages, sending]);

  const requestReply = async (
    trimmed: string,
    historyForApi: ChatMessage[],
    baseMessages: ChatMessage[],
  ) => {
    setSending(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          history: historyForApi.slice(-LIMITS.MAX_CHAT_HISTORY_ITEMS),
          context: {
            aqiData,
            preferences,
            recentActions: impactActions
              .slice(0, LIMITS.MAX_RECENT_ACTIONS)
              .map((a) => a.description),
          },
        }),
      });

      const rawText = await res.text();
      let data: { reply?: string; error?: string } = {};
      try {
        data = JSON.parse(rawText) as { reply?: string; error?: string };
      } catch {
        data = {};
      }
      if (!res.ok || !data.reply) {
        throw new Error(
          data.error ||
            (res.status === 429
              ? 'Too many AI requests right now. Please wait ~30 seconds and try again.'
              : 'Unable to get a response from AirWise right now.'),
        );
      }

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        timestamp: new Date().toISOString(),
      };
      onMessagesChange([...baseMessages, aiMsg]);
    } catch (err) {
      const errText =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'AirWise AI took too long to respond. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Could not reach AirWise AI right now.';
      const errMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: errText,
        timestamp: new Date().toISOString(),
        error: true,
      };
      onMessagesChange([...baseMessages, errMsg]);
    } finally {
      clearTimeout(timeout);
      setSending(false);
    }
  };

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim().slice(0, LIMITS.MAX_CHAT_MESSAGE_CHARS);
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    onMessagesChange(nextHistory);
    setInput('');
    await requestReply(trimmed, messages, nextHistory);
  };

  const handleRetryError = async (errorMsgIndex: number) => {
    if (sending) return;
    let precedingUserText = '';
    let userMsgIndex = -1;
    for (let i = errorMsgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        precedingUserText = messages[i].text;
        userMsgIndex = i;
        break;
      }
    }
    if (!precedingUserText) return;

    const cleanedMessages = messages.filter((_, idx) => idx !== errorMsgIndex);
    onMessagesChange(cleanedMessages);
    const historyBeforeUser = cleanedMessages.slice(0, userMsgIndex);
    await requestReply(precedingUserText, historyBeforeUser, cleanedMessages);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-11rem)] md:h-[calc(100vh-8.5rem)] min-h-[480px] bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-xs">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-4 bg-white">
        <div className="flex items-center gap-3.5 min-w-0">
          {!avatarFailed ? (
            <img
              src={IMAGE_ASSETS.GUIDE_AVATAR}
              alt="AirWise guide"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-11 h-11 rounded-full object-cover border border-[#CFE4DA] shrink-0 bg-[#EEF6F2]"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#EEF6F2] border border-[#CFE4DA] flex items-center justify-center text-[#2E7D62] shrink-0">
              <Leaf className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#1F2937]">
              Ask AirWise
            </h1>
            <p className="text-xs sm:text-sm text-[#4B5563]">
              Your friendly guide to cleaner air.
            </p>
            <p className="text-xs text-[#4B5563] mt-0.5 truncate">
              {aqiData
                ? `${aqiData.city.name} · ${aqiData.aqi} (${aqiData.categoryLabel})${aqiData.isDemo ? ' · Demo Mode' : ''}`
                : 'General advice mode · Live AQI unavailable'}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => onMessagesChange([])}
            className="min-h-[44px] px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] text-xs font-medium text-[#4B5563] hover:text-[#1F2937] hover:bg-[#F8FAF9] inline-flex items-center gap-1.5 transition-colors shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New chat</span>
          </button>
        )}
      </div>

      {/* Suggested questions */}
      <div className="px-4 sm:px-5 py-3 border-b border-[#E5E7EB] bg-[#F8FAF9]">
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending}
              onClick={() => sendMessage(q)}
              className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#2E7D62] hover:bg-[#EEF6F2] text-xs sm:text-sm text-[#1F2937] transition-colors text-left disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Message stream */}
      <div
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4 bg-[#F8FAF9]"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="max-w-md space-y-3">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm text-[#1F2937] leading-relaxed">
              Hi there! I’m AirWise. Ask me anything about today’s air quality
              {aqiData ? ` in ${aqiData.city.name}` : ''}, keeping indoor air
              fresh, or choosing a lower-exposure commute.
            </div>
            <p className="text-xs text-[#4B5563] px-1">
              Note: AirWise offers everyday lifestyle guidance, not medical
              diagnoses. If you experience severe breathing trouble, seek urgent
              medical care.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) =>
            msg.role === 'user' ? (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] sm:max-w-[75%] bg-[#2E7D62] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex justify-start">
                <div
                  role={msg.error ? 'alert' : undefined}
                  className={`max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3.5 border ${
                    msg.error
                      ? 'bg-[#FFF3ED] border-[#F7CDB9] text-[#9A3412]'
                      : 'bg-white border-[#E5E7EB]'
                  }`}
                >
                  {msg.error ? (
                    <div className="space-y-2.5">
                      <p className="text-sm">{msg.text}</p>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => handleRetryError(idx)}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white border border-[#F7CDB9] text-xs font-semibold text-[#9A3412] hover:bg-[#FEF2EC] inline-flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Try again</span>
                      </button>
                    </div>
                  ) : (
                    renderFormattedText(msg.text)
                  )}
                </div>
              </div>
            ),
          )
        )}

        {sending && (
          <div className="flex justify-start" role="status" aria-live="polite">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl rounded-tl-sm px-4 py-3 inline-flex items-center gap-2 text-sm text-[#4B5563]">
              <Loader2 className="w-4 h-4 text-[#2E7D62] animate-spin" aria-hidden="true" />
              <span>AirWise is thinking…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="p-3 sm:p-4 border-t border-[#E5E7EB] bg-white space-y-1.5"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] focus-within:border-[#2E7D62] bg-[#F8FAF9] focus-within:bg-white px-3 py-1.5 transition-colors">
          <input
            type="text"
            value={input}
            maxLength={LIMITS.MAX_CHAT_MESSAGE_CHARS}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about today’s air…"
            aria-label="Ask AirWise a question"
            disabled={sending}
            className="flex-1 min-h-[44px] bg-transparent text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:outline-none px-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2E7D62] text-white flex items-center justify-center hover:bg-[#24654F] disabled:opacity-40 transition-colors shrink-0"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
        {input.length > LIMITS.MAX_CHAT_MESSAGE_CHARS - 200 && (
          <div className="text-right text-xs text-[#4B5563] tabular-nums pr-1">
            {input.length} / {LIMITS.MAX_CHAT_MESSAGE_CHARS} characters
          </div>
        )}
      </form>
    </div>
  );
}
