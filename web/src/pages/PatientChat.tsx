import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { Send, Plus, Loader2, AlertTriangle, CheckCircle2, MessageSquare, ArrowLeft, Smartphone, Mic, MicOff } from 'lucide-react';
import type { ConversationSummary, ChatMessage, SeverityLevel } from '../types';

// ── Web Speech API type augmentation ──
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-peach-700', bg: 'bg-peach-100', label: 'Pending' },
  low: { color: 'text-sage-700', bg: 'bg-sage-100', label: 'Low' },
  medium: { color: 'text-peach-700', bg: 'bg-peach-100', label: 'Medium' },
  high: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'High' },
};

function extractKeywords(complaint: string | undefined | null): string {
  if (!complaint) return 'Symptom Check';
  const stopWords = new Set(['i', 'am', 'a', 'the', 'is', 'my', 'me', 'have', 'having', 'been', 'was', 'with', 'and', 'or', 'for', 'to', 'in', 'of', 'it', 'has', 'had', 'are', 'be', 'do', 'does', 'did', 'not', 'no', 'on', 'at', 'but', 'so', 'from', 'that', 'this', 'an', 'can', 'very', 'too', 'just', 'also', 'some', 'really', 'feeling', 'feel', 'lot', 'since', 'yesterday', 'today', 'get', 'getting']);
  const words = complaint
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
    .slice(0, 3)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.length > 0 ? words.join(', ') : 'Health Query';
}

// ── Voice Input Hook ──
function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = voiceLang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Reset silence timer on any result
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => { stopListening(); }, 5000);

      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      // Pass the best available transcript
      const text = finalTranscript || interimTranscript;
      if (text) onTranscript(text);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        showToast('No speech detected. Try again.');
      } else if (event.error === 'not-allowed') {
        showToast('Microphone access denied.');
      } else {
        showToast(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try { recognition.abort(); } catch {}
    };
  }, [voiceLang]);

  const showToast = (msg: string) => {
    setVoiceToast(msg);
    setTimeout(() => setVoiceToast(null), 3000);
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.lang = voiceLang;
      recognitionRef.current.start();
      setIsListening(true);
      // Auto-stop after 5 seconds of silence
      silenceTimerRef.current = setTimeout(() => {
        stopListening();
        showToast('No speech detected');
      }, 5000);
    } catch (e: any) {
      if (e.message?.includes('already started')) {
        stopListening();
      }
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try { recognitionRef.current.stop(); } catch {}
    setIsListening(false);
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const toggleLang = () => {
    const newLang = voiceLang === 'hi-IN' ? 'en-IN' : 'hi-IN';
    setVoiceLang(newLang);
    if (isListening) { stopListening(); }
  };

  return { isListening, voiceLang, voiceSupported, voiceToast, toggleListening, toggleLang, stopListening };
}

export default function PatientChat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('pending');
  const [status, setStatus] = useState('active');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [reportSending, setReportSending] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDoctor = user?.role === 'doctor';

  // Voice input integration
  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(text);
  }, []);

  const voice = useVoiceInput(handleVoiceTranscript);

  const sendReport = async () => {
    if (!conversationId || reportSending) return;
    setReportSending(true);
    setReportMsg(null);
    try {
      const { data } = await api.post(`/triage/conversations/${conversationId}/send-report`);
      setReportMsg({ type: 'success', text: data.message || 'Report sent!' });
      setTimeout(() => setReportMsg(null), 5000);
    } catch (err: any) {
      setReportMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to send report' });
      setTimeout(() => setReportMsg(null), 5000);
    } finally {
      setReportSending(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    api.get('/triage/conversations').then(r => {
      setConversations(r.data);
      setLoadingConvs(false);
    }).catch(() => setLoadingConvs(false));
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setSeverity('pending');
      return;
    }
    api.get(`/triage/conversations/${conversationId}`).then(r => {
      setMessages(r.data.messages || []);
      setSeverity(r.data.severity);
      setStatus(r.data.status);
      setTimeout(scrollToBottom, 100);
    });
  }, [conversationId, scrollToBottom]);

  useEffect(() => {
    if (!conversationId || !token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}://${host}/api/triage/ws/${conversationId}?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'message_saved':
          setMessages(prev => [...prev, data.message]);
          setTimeout(scrollToBottom, 50);
          break;
        case 'ai_typing':
          setIsTyping(true);
          setStreamingText('');
          setTimeout(scrollToBottom, 50);
          break;
        case 'ai_chunk':
          setIsTyping(false);
          setStreamingText(prev => prev + data.content);
          setTimeout(scrollToBottom, 50);
          break;
        case 'ai_complete':
          setStreamingText('');
          setMessages(prev => [...prev, data.message]);
          if (data.severity) setSeverity(data.severity);
          if (data.status) setStatus(data.status);
          setTimeout(scrollToBottom, 50);
          if (data.message) {
            setConversations(prev => prev.map(c =>
              c.id === conversationId && !c.chief_complaint
                ? { ...c, chief_complaint: messages[0]?.content?.slice(0, 200) || c.chief_complaint }
                : c
            ));
          }
          break;
      }
    };

    ws.onerror = (e) => { console.error('WebSocket Error:', e); };
    ws.onclose = (e) => { console.log('WebSocket Closed:', e.code, e.reason); };
    return () => { ws.close(); };
  }, [conversationId, token, scrollToBottom]);

  const startNewConversation = async () => {
    try {
      const { data } = await api.post('/triage/conversations', { region: 'Mumbai' });
      setConversations(prev => [{ id: data.id, severity: 'pending', status: 'active', created_at: data.created_at, chief_complaint: undefined }, ...prev]);
      navigate(`/chat/${data.id}`);
    } catch (err) {
      console.error('Failed to start conversation', err);
    }
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    // Stop listening if recording
    if (voice.isListening) voice.stopListening();
    wsRef.current.send(JSON.stringify({ content: text }));
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getConversationTitle = (conv: ConversationSummary): string => {
    if (isDoctor) return conv.chief_complaint || 'Patient Case';
    return extractKeywords(conv.chief_complaint);
  };

  const isChatDisabled = status === 'resolved' || status === 'closed';

  return (
    <div className="flex h-full">
      {/* Sidebar — conversation list */}
      <div className={`w-full md:w-80 border-r border-slate-200 bg-white flex flex-col shrink-0 ${conversationId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-navy-900">Conversations</h2>
            <button
              id="new-chat-btn"
              onClick={startNewConversation}
              className="p-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-white transition-colors shadow-sm"
              title="New conversation"
            >
              <Plus size={18} />
            </button>
          </div>
          <p className="text-xs text-slate-400">AI-powered symptom triage</p>
        </div>

        <div className="flex-1 overflow-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-300" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-6">
              <MessageSquare size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No conversations yet</p>
              <p className="text-xs text-slate-300 mt-1">Start one to describe your symptoms</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const sev = severityConfig[conv.severity] || severityConfig.pending;
              const title = getConversationTitle(conv);
              return (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors
                    ${conversationId === conv.id ? 'bg-teal-50/50 border-l-2 border-l-teal-500' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${sev.bg} ${sev.color}`}>
                      {sev.label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(conv.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-navy-900 truncate font-medium">
                    {title}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col bg-slate-50 ${!conversationId ? 'hidden md:flex' : 'flex'}`}>
        {!conversationId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-teal-500/20">
                <MessageSquare size={36} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-navy-900 mb-2">AI Health Triage</h2>
              <p className="text-slate-500 max-w-sm mx-auto mb-6">
                Describe your symptoms and our AI will assess their severity and provide guidance.
              </p>
              <button
                onClick={startNewConversation}
                className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-teal-500/25"
              >
                Start Conversation
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/chat')}
                  className="p-1 -ml-1 text-slate-500 hover:text-slate-700 md:hidden"
                  title="Back to conversations"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h3 className="font-semibold text-navy-900">AI Triage Assistant</h3>
                  <p className="text-xs text-slate-400">Powered by VitalBridge AI</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {severity !== 'pending' && (
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${severityConfig[severity]?.bg} ${severityConfig[severity]?.color}`}>
                    Severity: {severityConfig[severity]?.label}
                  </span>
                )}
                {status === 'escalated' && (
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-coral-500/10 text-coral-500 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Escalated to Doctor
                  </span>
                )}
                {status === 'resolved' && (
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-teal-50 text-teal-600 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Resolved
                  </span>
                )}
                {/* Send Report button */}
                {messages.length > 1 && (
                  <button
                    id="send-report-btn"
                    onClick={sendReport}
                    disabled={reportSending}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    title="Send triage report to your registered WhatsApp"
                  >
                    {reportSending ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={12} />}
                    Send Report
                  </button>
                )}
              </div>
              {reportMsg && (
                <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${
                  reportMsg.type === 'success' ? 'bg-teal-50 text-teal-600' : 'bg-red-50 text-red-500'
                }`}>
                  {reportMsg.text}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex chat-message-enter ${msg.role === 'patient' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                      ${msg.role === 'patient'
                        ? 'bg-teal-500 text-white rounded-br-md'
                        : 'bg-white text-navy-900 rounded-bl-md shadow-sm border border-slate-100'
                      }`}
                  >
                    {msg.role !== 'patient' && (
                      <p className="text-[10px] font-medium text-teal-500 mb-1">VitalBridge AI</p>
                    )}
                    {msg.content}
                    <p className={`text-[10px] mt-2 ${msg.role === 'patient' ? 'text-teal-200' : 'text-slate-300'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Streaming text */}
              {streamingText && (
                <div className="flex justify-start chat-message-enter">
                  <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-bl-md bg-white text-navy-900 shadow-sm border border-slate-100 text-sm leading-relaxed whitespace-pre-wrap">
                    <p className="text-[10px] font-medium text-teal-500 mb-1">VitalBridge AI</p>
                    {streamingText}
                    <span className="inline-block w-1.5 h-4 bg-teal-500 animate-pulse ml-0.5 rounded-full" />
                  </div>
                </div>
              )}

              {/* Typing indicator */}
              {isTyping && !streamingText && (
                <div className="flex justify-start chat-message-enter">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white shadow-sm border border-slate-100 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-teal-400 typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-teal-400 typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-teal-400 typing-dot" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Voice toast notification */}
            {voice.voiceToast && (
              <div className="px-6">
                <div className="voice-toast flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-xl mb-2">
                  <MicOff size={14} />
                  {voice.voiceToast}
                </div>
              </div>
            )}

            {/* Input area with voice */}
            <div className="px-6 py-4 bg-white border-t border-slate-200">
              {/* Language toggle + voice status row */}
              {voice.voiceSupported && !isChatDisabled && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => { if (voice.voiceLang !== 'en-IN') voice.toggleLang(); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        voice.voiceLang === 'en-IN'
                          ? 'bg-[#0D9488] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🇬🇧 English
                    </button>
                    <button
                      onClick={() => { if (voice.voiceLang !== 'hi-IN') voice.toggleLang(); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        voice.voiceLang === 'hi-IN'
                          ? 'bg-[#0D9488] text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🇮🇳 हिंदी
                    </button>
                  </div>
                  {voice.isListening && (
                    <span className="text-[11px] text-coral-500 font-semibold flex items-center gap-1.5 ml-auto animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-coral-500 inline-block" />
                      Listening...
                    </span>
                  )}
                </div>
              )}

              {/* Not supported message */}
              {!voice.voiceSupported && (
                <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-1">
                  <MicOff size={12} />
                  Voice input not supported in this browser. Try Chrome or Edge.
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  id="chat-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={voice.isListening ? 'Listening... speak now' : 'Describe your symptoms...'}
                  className={`flex-1 px-4 py-3 bg-slate-50 rounded-xl border focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-sm ${
                    voice.isListening
                      ? 'border-coral-400 bg-coral-50/30 focus:border-coral-400'
                      : 'border-slate-200 focus:border-teal-500'
                  }`}
                  disabled={isChatDisabled}
                />

                {/* Mic button */}
                {voice.voiceSupported && (
                  <button
                    id="voice-mic-btn"
                    onClick={voice.toggleListening}
                    disabled={isChatDisabled}
                    className={`voice-mic-btn p-3 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm ${
                      voice.isListening
                        ? 'bg-coral-500 hover:bg-coral-400 text-white shadow-coral-500/25'
                        : 'bg-teal-500 hover:bg-teal-400 text-white shadow-teal-500/25'
                    }`}
                    title={voice.isListening ? 'Stop recording' : 'Start voice input'}
                  >
                    {voice.isListening && <span className="voice-pulse-ring" />}
                    {voice.isListening ? (
                      <span className="flex items-center justify-center w-[18px] h-[18px]">
                        <span className="voice-waveform-bar" />
                        <span className="voice-waveform-bar" />
                        <span className="voice-waveform-bar" />
                      </span>
                    ) : (
                      <Mic size={18} />
                    )}
                  </button>
                )}

                {/* Send button */}
                <button
                  id="send-btn"
                  onClick={sendMessage}
                  disabled={!input.trim() || isChatDisabled}
                  className="p-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
