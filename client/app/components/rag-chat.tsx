'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, FileText, Loader2, PanelRight, Send, Sparkles, Upload, User } from 'lucide-react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  docs?: RetrievedDoc[];
};

type RetrievedDoc = {
  pageContent?: string;
  metadata?: {
    filename?: string;
    path?: string;
    pages?: unknown[];
  };
};

type UploadState = 'idle' | 'uploading' | 'uploaded' | 'error';

const API_URL = 'http://localhost:8000';

export default function RagChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Upload a PDF, then ask me anything from it.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const lastDocs = useMemo(() => {
    return [...messages].reverse().find(message => message.docs?.length)?.docs ?? [];
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, isSending]);

  async function handleUpload(file: File) {
    setError(null);
    setUploadState('uploading');

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch(`${API_URL}/upload/pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setUploadedFile(file.name);
      setUploadState('uploaded');
      setMessages(current => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `${file.name} is indexed and ready. Ask a question from it.`,
        },
      ]);
    } catch {
      setUploadState('error');
      setError('Could not upload the PDF. Check that the server is running.');
    }
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const question = input.trim();
    if (!question || isSending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
    };

    setMessages(current => [...current, userMessage]);
    setInput('');
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/chat?message=${encodeURIComponent(question)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? 'Chat failed');
      }

      setMessages(current => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message ?? 'No answer returned.',
          docs: data.docs ?? [],
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
      setMessages(current => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'I could not reach the RAG server. Check the server, worker, Valkey, and Qdrant processes.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <main className="h-[calc(100vh-4rem)] overflow-hidden bg-[#f6f3ee] text-zinc-950">
      <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[340px_1fr]">
        <aside className="border-b border-zinc-200 bg-[#fbfaf7] px-5 py-5 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-hidden lg:border-b-0 lg:border-r">
          <div className="flex h-full min-h-0 flex-col gap-5">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                <Sparkles className="h-4 w-4 text-emerald-700" />
                PDF RAG
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal text-zinc-950">
                Ask your documents.
              </h1>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void handleUpload(file);
                  event.currentTarget.value = '';
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadState === 'uploading'}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {uploadState === 'uploading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploadState === 'uploading' ? 'Indexing' : 'Upload PDF'}
              </button>

              <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 text-emerald-700" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {uploadedFile ?? 'No document selected'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {uploadState === 'uploaded'
                        ? 'Ready to search'
                        : uploadState === 'error'
                          ? 'Upload failed'
                          : 'PDF files only'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <section className="min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <PanelRight className="h-4 w-4 text-zinc-500" />
                Sources
              </div>
              <div className="space-y-3">
                {lastDocs.length === 0 ? (
                  <p className="text-sm leading-6 text-zinc-500">Retrieved passages will appear here.</p>
                ) : (
                  lastDocs.slice(0, 2).map((doc, index) => (
                    <article key={`${doc.metadata?.filename ?? 'doc'}-${index}`} className="rounded-md bg-zinc-50 p-3">
                      <p className="truncate text-xs font-semibold uppercase text-emerald-800">
                        {doc.metadata?.filename ?? 'PDF source'}
                      </p>
                      <p className="mt-2 line-clamp-5 text-sm leading-6 text-zinc-600">
                        {doc.pageContent}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </aside>

        <section className="flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden bg-[#f8f7f4]">
          <div className="shrink-0 border-b border-zinc-200 bg-white/80 px-5 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-500">RAG chat</p>
                <h2 className="text-lg font-semibold text-zinc-950">Document assistant</h2>
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                Groq connected
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              {messages.map(message => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isSending && (
                <div className="flex items-center gap-3 text-sm text-zinc-500">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                  </div>
                  Thinking
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-4">
            <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl gap-3">
              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the uploaded PDF..."
                rows={1}
                className="max-h-36 min-h-12 flex-1 resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-950 outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:shadow-[0_0_0_3px_rgba(5,150,105,0.12)]"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-sm transition-[background-color,transform] duration-150 ease-out active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-zinc-300"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={`max-w-[min(720px,85%)] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
          isUser
            ? 'bg-emerald-700 text-white'
            : 'border border-zinc-200 bg-white text-zinc-800'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-600 shadow-sm">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
