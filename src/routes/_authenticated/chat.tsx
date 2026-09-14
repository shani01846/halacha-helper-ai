import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { GlassBackground, BrandMark } from "@/components/GlassBackground";
import { supabase } from "@/integrations/supabase/client";
import {
  askQuestion,
  createThread,
  deleteThread,
  getThreadMessages,
  listThreads,
  type ChatMessage,
  type SourceCitation,
} from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "שיחה — לשון טהורה" },
      {
        name: "description",
        content:
          "שאלו שאלות בהלכות לשון הרע וקבלו תשובה מבוססת מקורות בלבד, עם הצגת קטעי המקור שאוחזרו.",
      },
      { property: "og:title", content: "שיחה — לשון טהורה" },
      {
        property: "og:description",
        content: "עוזר הלכתי בהלכות לשון הרע, עונה רק על סמך המקורות שבמאגר.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function SourceList({ sources }: { sources: SourceCitation[] }) {
  if (sources.length === 0) return null;
  const top = sources.slice(0, 2);
  return (
    <>
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-ink/50">המקורות המתאימים ביותר</p>
      {top.map((source, index) => (
        <div
          key={`top-${index}`}
          className="rounded-2xl border border-brand/20 bg-white/75 px-3 py-2.5 text-xs backdrop-blur-md"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-bold">{source.book}</span>
            <span className="text-ink/60">{source.reference}</span>
            <span className="ml-auto rounded-full bg-lavender/70 px-2 py-0.5 text-[10px] font-semibold text-brand">
              התאמה {Math.round(source.similarity * 100)}%
            </span>
          </div>
          <p className="mt-2 leading-relaxed text-ink/70">{source.content}</p>
        </div>
      ))}
    </div>
    <details className="group rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-xs backdrop-blur-md">
      <summary className="cursor-pointer list-none font-semibold text-brand">
        הצגת {sources.length} קטעי מקור שאוחזרו
      </summary>
      <div className="mt-3 space-y-3">
        {sources.map((source, index) => (
          <div key={index} className="rounded-xl bg-lavender/60 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-sm font-bold">{source.book}</span>
              <span className="text-ink/60">{source.reference}</span>
              <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-ink/50">
                התאמה {Math.round(source.similarity * 100)}%
              </span>
            </div>
            <p className="mt-2 leading-relaxed text-ink/70">{source.content}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function ChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchThreads = useServerFn(listThreads);
  const fetchMessages = useServerFn(getThreadMessages);
  const newThread = useServerFn(createThread);
  const removeThread = useServerFn(deleteThread);
  const ask = useServerFn(askQuestion);

  const threads = useQuery({ queryKey: ["threads"], queryFn: () => fetchThreads() });

  const messages = useQuery({
    queryKey: ["messages", activeThread],
    enabled: !!activeThread,
    queryFn: () => fetchMessages({ data: { threadId: activeThread! } }),
  });

  useEffect(() => {
    const first = threads.data?.[0];
    if (!activeThread && first) setActiveThread(first.id);
  }, [threads.data, activeThread]);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  const createMutation = useMutation({
    mutationFn: () => newThread(),
    onSuccess: (thread) => {
      setActiveThread(thread.id);
      setSidebarOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (threadId: string) => removeThread({ data: { threadId } }),
    onSuccess: (_result, threadId) => {
      if (activeThread === threadId) setActiveThread(null);
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
  });

  const askMutation = useMutation({
    mutationFn: async (text: string) => {
      let threadId = activeThread;
      if (!threadId) {
        const created = await newThread();
        threadId = created.id;
        setActiveThread(threadId);
      }
      const optimistic: ChatMessage = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
        sources: [],
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<ChatMessage[]>(["messages", threadId], (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return ask({ data: { threadId, question: text } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", activeThread] });
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "לא הצלחנו לקבל תשובה");
      void queryClient.invalidateQueries({ queryKey: ["messages", activeThread] });
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 2 || askMutation.isPending) return;
    setQuestion("");
    askMutation.mutate(text);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  };

  const list = messages.data ?? [];

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <GlassBackground />

      <header className="relative z-20 flex items-center gap-3 border-b border-white/60 bg-white/50 px-4 py-3 backdrop-blur-xl sm:px-6">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-ink/70 lg:hidden"
        >
          שיחות
        </button>
        <Link to="/" className="flex items-center gap-2">
          <BrandMark className="size-9 text-base" />
          <span className="font-display text-base font-bold">לשון טהורה</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/sources"
            className="rounded-full border border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-brand transition hover:bg-white"
          >
            מאגר המקורות
          </Link>
          <button
            onClick={signOut}
            className="rounded-full px-3 py-2 text-xs font-medium text-ink/50 transition hover:text-ink"
          >
            יציאה
          </button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <aside
          className={`${
            sidebarOpen ? "flex" : "hidden"
          } absolute inset-y-0 right-0 z-20 w-72 flex-col border-l border-white/60 bg-white/80 p-4 backdrop-blur-2xl lg:static lg:flex lg:bg-white/45`}
        >
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="w-full rounded-2xl bg-brand py-2.5 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-strong disabled:opacity-60"
          >
            שיחה חדשה +
          </button>

          <div className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {(threads.data ?? []).map((thread) => (
              <div
                key={thread.id}
                className={`group flex items-center gap-1 rounded-2xl px-3 py-2.5 text-sm transition ${
                  activeThread === thread.id
                    ? "bg-lavender font-semibold text-brand"
                    : "text-ink/70 hover:bg-white/70"
                }`}
              >
                <button
                  onClick={() => {
                    setActiveThread(thread.id);
                    setSidebarOpen(false);
                  }}
                  className="flex-1 truncate text-right"
                >
                  {thread.title}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(thread.id)}
                  aria-label="מחיקת שיחה"
                  className="shrink-0 text-xs text-ink/30 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                >
                  ✕
                </button>
              </div>
            ))}
            {threads.data?.length === 0 && (
              <p className="px-2 py-4 text-xs text-ink/45">אין שיחות עדיין. פתחו שיחה חדשה.</p>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-3xl space-y-5">
              {list.length === 0 && !askMutation.isPending && (
                <div className="rounded-[2rem] border border-white/70 bg-white/55 p-6 text-center shadow-glass backdrop-blur-2xl">
                  <BrandMark className="mx-auto size-12 text-xl" />
                  <h1 className="mt-4 font-display text-2xl font-bold">במה אפשר לסייע?</h1>
                  <p className="mt-2 text-sm text-ink/55">
                    שאלו שאלה בהלכות לשון הרע. התשובה תינתן רק על סמך מקורות שאוחזרו מהמאגר, עם
                    ציטוט הספר והסעיף.
                  </p>
                </div>
              )}

              {list.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-white/70 bg-white/85 px-4 py-3 text-sm shadow-sm">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex gap-3">
                    <BrandMark className="size-9 shrink-0 text-sm" />
                    <div className="max-w-[88%] space-y-2.5">
                      <div className="prose-sm rounded-2xl rounded-tr-sm border border-white/60 bg-lavender/60 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      <SourceList sources={message.sources} />
                    </div>
                  </div>
                ),
              )}

              {askMutation.isPending && (
                <div className="flex gap-3">
                  <BrandMark className="size-9 shrink-0 text-sm" />
                  <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-ink/50">
                    מחפש במאגר המקורות…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-white/60 bg-white/55 px-4 py-4 backdrop-blur-xl sm:px-8">
            <form onSubmit={submit} className="mx-auto flex max-w-3xl items-center gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="כתוב שאלת הלכה שלך..."
                className="flex-1 rounded-full border border-white/80 bg-white/80 px-5 py-3 text-sm outline-none placeholder:text-ink/40 focus:border-brand/40"
              />
              <button
                type="submit"
                disabled={askMutation.isPending}
                aria-label="שליחה"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-lg text-white shadow-brand transition hover:bg-brand-strong disabled:opacity-60"
              >
                ←
              </button>
            </form>
            <p className="mt-3 text-center text-[11px] font-medium text-ink/45">
              ⚠ המערכת אינה תחליף לפסיקת רב מוסמך
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
