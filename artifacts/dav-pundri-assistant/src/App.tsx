import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getHealthCheckQueryKey, getSendChatMessageUrl, useHealthCheck, useSendChatMessage } from '@workspace/api-client-react';
import type { ChatMessage } from '@workspace/api-client-react';
import { ArrowUp, Check, CircleAlert, Clock3, Copy, ExternalLink, Info, LifeBuoy, Loader2, MapPin, Menu, MessageCircle, Phone, Plus, RotateCcw, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type ConversationMessage = ChatMessage & { id: string; streaming?: boolean };

const welcomeMessage: ConversationMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Namaste. I’m the DAV Public School, Pundri front desk assistant. I can help you find your way around admissions, timings, fees, facilities, transport, and school contact details.',
};

const quickQuestions = [
  { label: 'Admissions', question: 'How can I enquire about admissions?' },
  { label: 'Fee structure', question: 'Where can I ask about the fee structure?' },
  { label: 'School timings', question: 'What are the school timings?' },
  { label: 'Contact us', question: 'How can I contact the school office?' },
  { label: 'Facilities', question: 'What facilities does the school have?' },
  { label: 'Transport', question: 'Could you tell me about school transport?' },
];

const contactDetails = [
  { icon: Phone, label: 'School office', value: 'Speak with the school office for confirmed details' },
  { icon: Clock3, label: 'Office hours', value: 'For the latest schedule, please confirm with the office' },
  { icon: MapPin, label: 'Campus', value: 'DAV Public School, Pundri, Haryana' },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function AssistantMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`assistant-mark ${small ? 'assistant-mark-small' : ''}`} aria-label="DAV Public School mark">
      <span>DAV</span>
      <i />
    </div>
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={`${token}-${index}`}>{token.slice(1, -1)}</em>;
    }
    return <span key={`${token}-${index}`}>{token}</span>;
  });
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="message-markdown">
      {content.split(/\r?\n/).map((line, index) => {
        const key = `${line}-${index}`;
        if (line.trim().startsWith('- ')) {
          return <div className="markdown-bullet" key={key}>• {renderInlineMarkdown(line.trim().slice(2))}</div>;
        }
        if (!line.trim()) return <div className="markdown-spacer" key={key} />;
        return <div key={key}>{renderInlineMarkdown(line)}</div>;
      })}
    </div>
  );
}

function ChatBubble({ message, onCopy }: { message: ConversationMessage; onCopy: (content: string) => void }) {
  const isAssistant = message.role === 'assistant';
  return (
    <div className={`message-row ${isAssistant ? 'message-row-assistant' : 'message-row-user'}`} data-testid={`message-${message.id}`}>
      {isAssistant && <AssistantMark small />}
      <div className="message-stack">
        <div className={`message-bubble ${isAssistant ? 'message-bubble-assistant' : 'message-bubble-user'}`}>
          <div className="message-content" data-testid={`text-message-${message.id}`}>
            {message.content ? <MarkdownMessage content={message.content} /> : ' '}
            {message.streaming && <span className="typing-caret" />}
          </div>
        </div>
        {isAssistant && message.content && !message.streaming && (
          <button className="copy-message" type="button" onClick={() => onCopy(message.content)} data-testid={`button-copy-message-${message.id}`}>
            <Copy size={12} /> Copy
          </button>
        )}
      </div>
    </div>
  );
}

function WelcomePanel({ onQuestion }: { onQuestion: (question: string) => void }) {
  return (
    <div className="welcome-panel" data-testid="panel-welcome">
      <div className="welcome-kicker"><Sparkles size={14} /> Front desk, reimagined</div>
      <h1>How can we help you find your way?</h1>
      <p>Ask a question about DAV Public School, Pundri. I’ll point you to the right information and tell you when the school office should confirm it.</p>
      <div className="quick-question-grid" aria-label="Common questions">
        {quickQuestions.map((item, index) => (
          <button key={item.label} className="quick-question" type="button" onClick={() => onQuestion(item.question)} data-testid={`button-quick-${index}`}>
            <span>{item.label}</span>
            <ArrowUp size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

function HealthPill() {
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false, staleTime: 30_000 } });
  const isAvailable = !health.isError && (health.isSuccess || health.isLoading);
  return (
    <div className={`health-pill ${isAvailable ? 'health-pill-ready' : 'health-pill-error'}`} data-testid="status-office-connection">
      <span className="health-dot" />
      {health.isLoading ? 'Checking office link' : isAvailable ? 'Office link ready' : 'Office link unavailable'}
    </div>
  );
}

function ContactStrip() {
  return (
    <section className="contact-strip" aria-label="School contact guidance">
      <div className="contact-strip-heading">
        <div className="section-eyebrow">Need a sure answer?</div>
        <p>Confirmed details always come from the school office.</p>
      </div>
      <div className="contact-list">
        {contactDetails.map(({ icon: Icon, label, value }) => (
          <div className="contact-item" key={label} data-testid={`contact-${label.toLowerCase().replace(' ', '-')}`}>
            <div className="contact-icon"><Icon size={16} /></div>
            <div><strong>{label}</strong><span>{value}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChatExperience({ widget = false }: { widget?: boolean }) {
  const [messages, setMessages] = useState<ConversationMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [copied, setCopied] = useState(false);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendMutation = useSendChatMessage();
  const mutateAsyncRef = useRef(sendMutation.mutateAsync);
  mutateAsyncRef.current = sendMutation.mutateAsync;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([{ ...welcomeMessage, id: createId() }]);
    setInput('');
    setStreamError('');
    setIsStreaming(false);
  }, []);

  const copyMessage = useCallback((content: string) => {
    void navigator.clipboard?.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, []);

  const streamResponse = useCallback(async (history: ConversationMessage[], assistantId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const payload = { messages: history.slice(-10).map(({ role, content }) => ({ role, content })) };
    const response = await fetch(getSendChatMessageUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream, text/plain' },
      credentials: 'include',
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `The school office link returned ${response.status}.`);
    }
    if (!response.body) {
      const text = await response.text();
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: text, streaming: false } : message));
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    const append = (chunk: string) => {
      fullText += chunk;
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: fullText } : message));
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const payload = line.startsWith('data:') ? line.slice(5).trimStart() : line;
        if (payload === '[DONE]') continue;
        try {
          append(JSON.parse(payload) as string);
        } catch {
          append(payload);
        }
      }
    }
    if (buffer.trim()) {
      const payload = buffer.startsWith('data:') ? buffer.slice(5).trimStart() : buffer;
      if (payload !== '[DONE]') {
        try {
          append(JSON.parse(payload) as string);
        } catch {
          append(payload);
        }
      }
    }
    setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, streaming: false } : message));
  }, []);

  const submitQuestion = useCallback((question: string, sourceMessages = messages) => {
    const trimmed = question.trim();
    if (!trimmed || isStreaming) return;
    const userMessage: ConversationMessage = { id: createId(), role: 'user', content: trimmed };
    const assistantId = createId();
    const assistantMessage: ConversationMessage = { id: assistantId, role: 'assistant', content: '', streaming: true };
    const nextMessages = [...sourceMessages, userMessage, assistantMessage];
    setMessages(nextMessages);
    setInput('');
    setStreamError('');
    setIsStreaming(true);
    void streamResponse(nextMessages, assistantId)
      .catch(async (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // The generated mutation remains a safe non-streaming fallback for deployments that buffer the stream.
        try {
          const fallback = await mutateAsyncRef.current({ data: { messages: nextMessages.slice(-10).filter((message) => !message.streaming).map(({ role, content }) => ({ role, content })) } });
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: fallback || 'I could not find a response. Please confirm this with the school office.', streaming: false } : message));
          setStreamError('');
        } catch {
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: '', streaming: false } : message));
          setStreamError(error instanceof Error ? error.message : 'The assistant is unavailable right now.');
        }
      })
      .finally(() => setIsStreaming(false));
  }, [isStreaming, messages, streamResponse]);

  const retryLast = () => {
    const lastUserIndex = [...messages].map((message) => message.role).lastIndexOf('user');
    const lastUser = lastUserIndex >= 0 ? messages[lastUserIndex] : undefined;
    if (!lastUser) return;
    const baseMessages = messages.slice(0, lastUserIndex);
    setMessages(baseMessages);
    submitQuestion(lastUser.content, baseMessages);
  };

  const visibleMessages = messages.filter((message) => message.id !== 'welcome' || messages.length > 1);
  const showWelcome = messages.length === 1 && messages[0].id === 'welcome';

  return (
    <div className={`assistant-frame ${widget ? 'assistant-frame-widget' : ''}`} data-testid={widget ? 'chat-widget' : 'assistant-chat'}>
      <header className="assistant-header">
        <div className="brand-lockup">
          <AssistantMark />
          <div>
            <div className="brand-name">DAV Public School, Pundri</div>
            <div className="brand-place">Assistant · CBSE school office</div>
          </div>
        </div>
        <div className="header-actions">
          {!widget && <HealthPill />}
          <button className="icon-button mobile-info-button" type="button" onClick={() => setMobileInfoOpen((open) => !open)} aria-label="Toggle contact details" data-testid="button-toggle-contact"><Info size={18} /></button>
          <button className="new-chat-button" type="button" onClick={startNewChat} data-testid="button-new-chat"><Plus size={16} /> <span>New chat</span></button>
        </div>
      </header>

      <div className="chat-layout">
        <main className="chat-main">
          <div className="chat-topline">
            <div><span className="live-mark" /> Replies are thoughtful, not guessed</div>
            <span className="language-note">English · हिन्दी welcome</span>
          </div>
          <div className="messages-scroller" data-testid="region-messages">
            {showWelcome ? <WelcomePanel onQuestion={submitQuestion} /> : (
              <div className="message-list">
                {visibleMessages.map((message) => <ChatBubble key={message.id} message={message} onCopy={copyMessage} />)}
                {isStreaming && messages[messages.length - 1]?.content === '' && (
                  <div className="message-row message-row-assistant" data-testid="status-assistant-thinking">
                    <AssistantMark small />
                    <div className="message-bubble message-bubble-assistant thinking-bubble"><span /><span /><span /></div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {streamError && (
            <div className="stream-error" role="alert" data-testid="status-chat-error">
              <CircleAlert size={16} />
              <span>{streamError}</span>
              <button type="button" onClick={retryLast} data-testid="button-retry-chat"><RotateCcw size={14} /> Try again</button>
            </div>
          )}

          <div className="composer-wrap">
            <form className="composer" onSubmit={(event) => { event.preventDefault(); submitQuestion(input); }}>
              <textarea value={input} onChange={(event) => setInput(event.target.value.slice(0, 500))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitQuestion(input); } }} placeholder="Ask about admissions, fees, timings..." rows={1} disabled={isStreaming} aria-label="Ask the school assistant" data-testid="input-chat-message" />
              <div className="composer-footer">
                <span className="composer-hint"><ShieldCheck size={13} /> School office confirmation matters</span>
                <button className="send-button" type="submit" disabled={!input.trim() || isStreaming} aria-label="Send message" data-testid="button-send-message">
                  {isStreaming ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
                </button>
              </div>
            </form>
            <p className="privacy-note">Do not share sensitive personal information in chat.</p>
          </div>
        </main>
        <aside className={`assistant-aside ${mobileInfoOpen ? 'assistant-aside-mobile-open' : ''}`}>
          <div className="aside-card aside-card-featured">
            <div className="aside-icon"><LifeBuoy size={19} /></div>
            <div className="section-eyebrow">A clear next step</div>
            <h2>Useful first. Certain when it counts.</h2>
            <p>Use chat for direction. For current fees, dates, routes, or admission decisions, the school office is the final word.</p>
          </div>
          <div className="aside-card">
            <div className="aside-card-heading"><span className="section-eyebrow">Ask about</span><Menu size={15} /></div>
            <div className="topic-list">
              {['Admissions & documents', 'Fee structure', 'Timings & holidays', 'Facilities & activities', 'Transport routes'].map((topic) => <button type="button" key={topic} onClick={() => submitQuestion(`Please help me with ${topic.toLowerCase()}.`)} data-testid={`button-topic-${topic.split(' ')[0].toLowerCase()}`}>{topic}<ArrowUp size={13} /></button>)}
            </div>
          </div>
          <div className="aside-contact">
            <div className="section-eyebrow">School office</div>
            <p>For confirmed details, connect directly with DAV Public School, Pundri.</p>
            <div className="office-status"><span className="status-pip" />Best place for final confirmation</div>
          </div>
        </aside>
      </div>
      {!widget && <ContactStrip />}
      {copied && <div className="copy-toast" role="status" data-testid="status-copied"><Check size={14} /> Copied to clipboard</div>}
    </div>
  );
}

function Home() {
  return (
    <div className="app-shell">
      <div className="maroon-rail" />
      <div className="page-content">
        <div className="page-meta"><span>DAV GROUP OF SCHOOLS</span><span className="meta-line" /><span>EST. PUNDRI</span></div>
        <ChatExperience />
        <footer className="page-footer"><span>AI assistant – for confirmed details please contact the school office.</span><span>DAV Public School, Pundri</span></footer>
      </div>
    </div>
  );
}

function Widget() {
  return (
    <div className="widget-stage">
      <div className="widget-context-label"><ExternalLink size={13} /> Website preview · floating assistant</div>
      <div className="widget-page-lines"><span /><span /><span /><b /><i /><i /></div>
      <div className="widget-anchor">
        <ChatExperience widget />
        <button className="widget-close" type="button" aria-label="Close chat preview" data-testid="button-widget-close"><X size={18} /></button>
      </div>
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/widget" component={Widget} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;