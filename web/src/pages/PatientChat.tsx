import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { Send, Plus, Loader2, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import type { ConversationSummary, ChatMessage, SeverityLevel } from '../types';

const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-slate-500', bg: 'bg-slate-100', label: 'Pending' },
  low: { color: 'text-teal-600', bg: 'bg-teal-50', label: 'Low' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Medium' },
  high: { color: 'text-coral-500', bg: 'bg-coral-500/10', label: 'High' },
};

export default function PatientChat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('pending');
  const [status, setStatus] = useState('active');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load conversation list
  useEffect(() => {
    api.get('/triage/conversations').then(r => {
      setConversations(r.data);
      setLoadingConvs(false);
    }).catch(() => setLoadingConvs(false));
  }, []);

  // Load messages when conversation changes
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

  // WebSocket connection
  useEffect(() => {
    if (!conversationId || !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/api/triage/ws/${conversationId}?token=${token}`;
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
          break;
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => { ws.close(); };
  }, [conversationId, token, scrollToBottom]);

  const startNewConversation = async () => {
    try {
      const { data } = await api.post('/triage/conversations', { region: 'Mumbai' });
      setConversations(prev => [{ id: data.id, severity: 'pending', status: 'active', created_at: data.created_at }, ...prev]);
      navigate(`/chat/${data.id}`);
    } catch (err) {
      console.error('Failed to start conversation', err);
    }
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
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

  return (
    <div className="flex h-full">
      {/* Sidebar — conversation list */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
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
                  <p className="text-sm text-navy-900 truncate">
                    {conv.chief_complaint || 'New conversation'}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-slate-50">
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
                Start New Conversation
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-navy-900">AI Triage Assistant</h3>
                <p className="text-xs text-slate-400">Powered by VitalBridge AI</p>
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
              </div>
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

            {/* Input */}
            <div className="px-6 py-4 bg-white border-t border-slate-200">
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  id="chat-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your symptoms..."
                  className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-sm"
                  disabled={status === 'resolved' || status === 'closed'}
                />
                <button
                  id="send-btn"
                  onClick={sendMessage}
                  disabled={!input.trim() || status === 'resolved' || status === 'closed'}
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
