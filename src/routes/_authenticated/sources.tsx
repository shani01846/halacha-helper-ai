import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { GlassBackground, BrandMark } from "@/components/GlassBackground";
import { deleteSource, ingestSource, listSources } from "@/lib/sources.functions";

export const Route = createFileRoute("/_authenticated/sources")({
  head: () => ({
    meta: [
      { title: "מאגר המקורות — לשון טהורה" },
      {
        name: "description",
        content:
          "העלאת ספרי הלכה ומסמכי מקור (PDF או טקסט) למאגר, עם חיתוך לקטעים ויצירת וקטורים לחיפוש סמנטי.",
      },
      { property: "og:title", content: "מאגר המקורות — לשון טהורה" },
      {
        property: "og:description",
        content: "ניהול הספרים והמסמכים שעליהם מבוססות התשובות בהלכות לשון הרע.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SourcesPage,
});

async function extractText(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " "),
      );
    }
    return pages.join("\n\n");
  }
  return file.text();
}

function SourcesPage() {
  const queryClient = useQueryClient();
  const fetchSources = useServerFn(listSources);
  const ingest = useServerFn(ingestSource);
  const remove = useServerFn(deleteSource);

  const [book, setBook] = useState("");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState("");

  const sources = useQuery({ queryKey: ["sources"], queryFn: () => fetchSources() });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      // Send long documents in parts so each request stays small and fast.
      const parts: string[] = [];
      const PART = 60000;
      let i = 0;
      while (i < text.length) {
        let end = Math.min(i + PART, text.length);
        if (end < text.length) {
          const nl = text.lastIndexOf("\n", end);
          if (nl > i + PART / 2) end = nl;
        }
        parts.push(text.slice(i, end));
        i = end;
      }
      let sourceId: string | undefined;
      let total = 0;
      for (let p = 0; p < parts.length; p++) {
        if (parts[p].trim().length === 0) continue;
        setProgress(`חלק ${p + 1} מתוך ${parts.length}`);
        const r = await ingest({
          data: {
            book: book.trim(),
            title: title.trim(),
            reference: reference.trim() || undefined,
            text: parts[p],
            sourceId,
            startIndex: total,
          },
        });
        sourceId = r.sourceId;
        total += r.chunks;
      }
      setProgress("");
      return { sourceId: sourceId!, chunks: total };
    },
    onSuccess: (result) => {
      toast.success(`המסמך נטען בהצלחה — ${result.chunks} קטעים נוספו למאגר`);
      setBook("");
      setTitle("");
      setReference("");
      setText("");
      setFileName("");
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (error) => {
      setProgress("");
      toast.error(error instanceof Error ? error.message : "הטעינה נכשלה");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => remove({ data: { sourceId } }),
    onSuccess: () => {
      toast.success("המקור נמחק");
      void queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "המחיקה נכשלה"),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const extracted = await extractText(file);
      if (extracted.trim().length < 50) throw new Error("לא נמצא טקסט קריא בקובץ");
      setText(extracted);
      setFileName(file.name);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success("הטקסט נקרא מהקובץ");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "קריאת הקובץ נכשלה");
    } finally {
      setReading(false);
    }
  };

  const canSubmit =
    book.trim().length > 0 && title.trim().length > 0 && text.trim().length >= 50 && !reading;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GlassBackground />

      <header className="relative z-10 flex items-center gap-3 border-b border-white/60 bg-white/50 px-4 py-3 backdrop-blur-xl sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark className="size-9 text-base" />
          <span className="font-display text-base font-bold">לשון טהורה</span>
        </Link>
        <Link
          to="/chat"
          className="mr-auto rounded-full border border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-brand transition hover:bg-white"
        >
          חזרה לשיחה
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl font-bold">מאגר המקורות</h1>
        <p className="mt-2 text-sm text-ink/55">
          כל מסמך שנטען נחתך לקטעים ומקבל וקטור, כדי שכל שאלה תמצא את המקור המדויק. התשובות מבוססות
          אך ורק על מה שנמצא כאן.
        </p>

        <section className="mt-6 rounded-[2rem] border border-white/70 bg-white/60 p-5 shadow-glass backdrop-blur-2xl sm:p-6">
          <h2 className="font-display text-lg font-bold">הוספת מסמך</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={book}
              onChange={(e) => setBook(e.target.value)}
              placeholder="שם הספר (למשל: חפץ חיים)"
              className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-ink/40 focus:border-brand/40"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="כותרת המסמך (למשל: כלל א)"
              className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-ink/40 focus:border-brand/40"
            />
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="סימון מקור לציטוט (אופציונלי)"
              className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-ink/40 focus:border-brand/40 sm:col-span-2"
            />
          </div>

          <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-brand/40 bg-lavender/40 px-4 py-6 text-center transition hover:bg-lavender/70">
            <span className="text-sm font-semibold text-brand">
              {reading ? "קורא את הקובץ…" : "בחירת קובץ PDF או טקסט"}
            </span>
            <span className="text-[11px] text-ink/45">
              {fileName || "אפשר גם להדביק את הטקסט בשדה שמתחת"}
            </span>
            <input
              type="file"
              accept=".pdf,.txt,.md,text/plain,application/pdf"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="טקסט המקור..."
            className="mt-3 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-ink/40 focus:border-brand/40"
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => uploadMutation.mutate()}
              disabled={!canSubmit || uploadMutation.isPending}
              className="rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-strong disabled:opacity-50"
            >
              {uploadMutation.isPending ? `מעבד… ${progress}` : "טעינה למאגר"}
            </button>
            <span className="text-[11px] text-ink/45">
              {text.trim().length > 0 ? `${text.trim().length.toLocaleString()} תווים` : ""}
            </span>
          </div>
        </section>

        <section className="mt-6 space-y-2">
          <h2 className="font-display text-lg font-bold">מסמכים במאגר</h2>
          {sources.data?.length === 0 && (
            <p className="rounded-2xl border border-white/70 bg-white/55 px-4 py-5 text-sm text-ink/50">
              המאגר ריק. עד שלא יטענו מקורות, העוזר לא יוכל לענות על שאלות.
            </p>
          )}
          {(sources.data ?? []).map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 backdrop-blur-md"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-bold">{source.book}</p>
                <p className="truncate text-xs text-ink/55">
                  {source.title} · {source.chunk_count} קטעים
                </p>
              </div>
              <button
                onClick={() => deleteMutation.mutate(source.id)}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-ink/40 transition hover:bg-rose-50 hover:text-rose-500"
              >
                מחיקה
              </button>
            </div>
          ))}
        </section>

        <p className="mt-8 text-center text-[11px] font-medium text-ink/45">
          ⚠ המערכת אינה תחליף לפסיקת רב מוסמך
        </p>
      </main>
    </div>
  );
}
