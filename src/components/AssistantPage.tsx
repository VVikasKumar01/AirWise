import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ExternalLink,
  Leaf,
  Loader2,
  MapPin,
  Mic,
  RefreshCw,
  RotateCcw,
  Square,
} from 'lucide-react';
import {
  IMAGE_ASSETS,
  LIMITS,
  SUGGESTED_QUESTIONS,
} from '../shared/constants.ts';
import type {
  AirQualityData,
  ChatMessage,
  GroundedPlace,
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

function stripInlineSymbols(segment: string): string {
  return segment
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,!?:;)]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function isSafeExternalUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  const blocks: Array<{ type: 'p' | 'ul'; items: string[] }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^([-*_])\1{2,}$/.test(line)) continue;

    const cleanLine = line.replace(/^#{1,6}\s+/, '');
    const bulletMatch = cleanLine.match(/^[-*•+]\s+(.*)$/);
    if (bulletMatch) {
      const content = stripInlineSymbols(bulletMatch[1]);
      if (!content) continue;
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ul') {
        last.items.push(content);
      } else {
        blocks.push({ type: 'ul', items: [content] });
      }
    } else {
      const content = stripInlineSymbols(cleanLine);
      if (content) {
        blocks.push({ type: 'p', items: [content] });
      }
    }
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed text-[#1F2937]">
      {blocks.map((block, bIdx) =>
        block.type === 'ul' ? (
          <ul key={bIdx} className="list-disc pl-5 space-y-1">
            {block.items.map((item, iIdx) => (
              <li key={iIdx}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={bIdx}>{block.items[0]}</p>
        ),
      )}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Could not read recorded audio.'));
        return;
      }
      resolve(result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(new Error('Could not read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

function pickSupportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return undefined;
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
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
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore teardown errors
        }
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopMicTracks = () => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const transcribeRecordedBlob = async (blob: Blob, mimeType: string) => {
    setTranscribing(true);
    setVoiceNotice(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ audioBase64, mimeType }),
      });

      const rawText = await res.text();
      let data: { text?: string; error?: string } = {};
      try {
        data = JSON.parse(rawText) as { text?: string; error?: string };
      } catch {
        data = {};
      }

      if (!res.ok || !data.text) {
        throw new Error(
          data.error || 'Could not transcribe that recording. Please try again.',
        );
      }

      setInput((prev) => {
        const prefix = prev.trim();
        const combined = prefix ? `${prefix} ${data.text}` : data.text || '';
        return combined.slice(0, LIMITS.MAX_CHAT_MESSAGE_CHARS);
      });
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Audio transcription took too long. Please try a shorter clip.'
          : err instanceof Error
            ? err.message
            : 'Could not transcribe audio right now.';
      setVoiceNotice(msg);
    } finally {
      clearTimeout(timeout);
      setTranscribing(false);
    }
  };

  const handleToggleRecording = async () => {
    if (sending || transcribing) return;

    if (recording) {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        stopMicTracks();
        setRecording(false);
      }
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setVoiceNotice('Voice recording is not supported in this browser.');
      return;
    }

    setVoiceNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredMime = pickSupportedAudioMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        setRecording(false);
        const finalMime = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        audioChunksRef.current = [];
        stopMicTracks();

        if (blob.size < 256) {
          setVoiceNotice('Recording was too short. Please tap the mic and speak clearly.');
          return;
        }
        void transcribeRecordedBlob(blob, finalMime);
      };

      recorder.onerror = () => {
        setRecording(false);
        stopMicTracks();
        setVoiceNotice('Microphone recording stopped unexpectedly. Please try again.');
      };

      recorder.start();
      setRecording(true);
      autoStopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 40000);
    } catch (err) {
      stopMicTracks();
      setRecording(false);
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('permissions policy') || msg.includes('feature policy')) {
        setVoiceNotice(
          'Microphone access is blocked in this preview frame. Open in a standalone tab or type your question below.',
        );
      } else if (
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      ) {
        setVoiceNotice(
          'Microphone permission was denied. Allow mic access in your browser settings to use voice input.',
        );
      } else {
        setVoiceNotice('Could not start microphone recording right now.');
      }
    }
  };

  const requestReply = async (
    trimmed: string,
    historyForApi: ChatMessage[],
    baseMessages: ChatMessage[],
  ) => {
    setSending(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
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
      let data: { reply?: string; places?: GroundedPlace[]; error?: string } = {};
      try {
        data = JSON.parse(rawText) as {
          reply?: string;
          places?: GroundedPlace[];
          error?: string;
        };
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

      const validPlaces = Array.isArray(data.places)
        ? data.places.filter((p) => p && isSafeExternalUrl(p.uri))
        : [];

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        timestamp: new Date().toISOString(),
        ...(validPlaces.length > 0 ? { places: validPlaces } : {}),
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
                    <div className="space-y-3">
                      {renderFormattedText(msg.text)}
                      {msg.places && msg.places.length > 0 && (
                        <div className="pt-2.5 border-t border-[#E5E7EB] space-y-1.5">
                          <div className="text-xs font-medium text-[#4B5563]">
                            Nearby places on Google Maps
                          </div>
                          <ul className="space-y-1.5">
                            {msg.places
                              .filter((place) => isSafeExternalUrl(place.uri))
                              .map((place) => (
                                <li key={place.uri}>
                                  <a
                                    href={place.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-start justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAF9] hover:border-[#2E7D62] hover:bg-[#EEF6F2] px-3 py-2 text-xs transition-colors"
                                  >
                                    <span className="flex items-start gap-2 min-w-0">
                                      <MapPin
                                        className="w-3.5 h-3.5 text-[#2E7D62] shrink-0 mt-0.5"
                                        aria-hidden="true"
                                      />
                                      <span className="min-w-0">
                                        <span className="font-medium text-[#1F2937] block truncate">
                                          {place.title}
                                        </span>
                                        {place.snippet && (
                                          <span className="text-[#4B5563] block line-clamp-2 mt-0.5">
                                            {place.snippet}
                                          </span>
                                        )}
                                      </span>
                                    </span>
                                    <ExternalLink
                                      className="w-3.5 h-3.5 text-[#4B5563] group-hover:text-[#2E7D62] shrink-0 mt-0.5"
                                      aria-hidden="true"
                                    />
                                  </a>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </div>
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
        {(recording || transcribing || voiceNotice) && (
          <div
            role={voiceNotice ? 'alert' : 'status'}
            aria-live="polite"
            className={`text-xs px-3 py-1.5 rounded-xl flex items-center justify-between gap-2 ${
              voiceNotice
                ? 'bg-[#FFF3ED] text-[#9A3412] border border-[#F7CDB9]'
                : 'bg-[#EEF6F2] text-[#23634D] border border-[#CFE4DA]'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {recording && (
                <span className="w-2 h-2 rounded-full bg-[#DC2626] shrink-0" />
              )}
              {transcribing && (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              )}
              <span>
                {recording
                  ? 'Listening… tap the stop button when finished.'
                  : transcribing
                    ? 'Transcribing your voice question…'
                    : voiceNotice}
              </span>
            </span>
            {voiceNotice && (
              <button
                type="button"
                onClick={() => setVoiceNotice(null)}
                className="font-medium underline shrink-0"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] focus-within:border-[#2E7D62] bg-[#F8FAF9] focus-within:bg-white px-3 py-1.5 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            maxLength={LIMITS.MAX_CHAT_MESSAGE_CHARS}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask or speak a question about today’s air…"
            aria-label="Ask AirWise a question"
            disabled={sending || recording || transcribing}
            className="flex-1 min-h-[44px] bg-transparent text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:outline-none px-1"
          />
          <button
            type="button"
            onClick={handleToggleRecording}
            disabled={sending || transcribing}
            aria-label={recording ? 'Stop voice recording' : 'Speak your question'}
            title={recording ? 'Stop recording' : 'Speak your question'}
            className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border transition-colors shrink-0 disabled:opacity-40 ${
              recording
                ? 'bg-[#FFF3ED] border-[#F7CDB9] text-[#B91C1C] hover:bg-[#FEE2E2]'
                : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:text-[#2E7D62] hover:border-[#2E7D62]'
            }`}
          >
            {recording ? (
              <Square className="w-4 h-4 fill-current" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
          <button
            type="submit"
            disabled={!input.trim() || sending || recording || transcribing}
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
