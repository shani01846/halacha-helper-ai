import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassBackground, BrandMark } from "@/components/GlassBackground";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "לשון טהורה — עוזר הלכתי להלכות לשון הרע" },
      {
        name: "description",
        content:
          "שאלו שאלות בהלכות לשון הרע וקבלו תשובה המבוססת על מקורות שאוחזרו מהמאגר בלבד, עם ציטוט מדויק של הספר והסעיף.",
      },
      { property: "og:title", content: "לשון טהורה — עוזר הלכתי להלכות לשון הרע" },
      {
        property: "og:description",
        content: "תשובות מדויקות על פי חפץ חיים, שמירת הלשון ופוסקים נוספים שנטענו למאגר.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const EXAMPLES = [
  "האם מותר לספר על מעשה חברי בפני אנשים אחרים?",
  "מהו אבק לשון הרע?",
  "מתי מותר לספר לצורך תועלת?",
];

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <GlassBackground />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="font-display text-lg leading-none font-bold">לשון טהורה</p>
            <p className="mt-1 text-[11px] text-ink/50">עוזר הלכתי · הלכות לשון הרע</p>
          </div>
        </div>
        <Link
          to="/chat"
          className="rounded-full border border-white/80 bg-white/60 px-4 py-2 text-xs font-semibold text-brand backdrop-blur-md transition hover:bg-white"
        >
          כניסה לצ'אט
        </Link>
      </header>

      <main className="relative z-10 flex flex-col items-center px-4 pb-16 sm:px-8">
        <div className="max-w-2xl pt-6 pb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-brand">עונה רק על סמך המקורות</p>
          <h1 className="mt-3 text-4xl leading-tight font-bold sm:text-5xl">
            תשובות מדויקות
            <br />
            על פי חפץ חיים ופוסקים
          </h1>
          <p className="mt-4 text-base text-ink/60">
            שאל שאלת הלכה, והעוזר יבצע חיפוש סמנטי במאגר הוקטורי ויצטט את המקור המדויק.
          </p>
        </div>

        <div className="w-full max-w-3xl rounded-[2rem] border border-white/70 bg-white/55 p-5 shadow-glass backdrop-blur-2xl sm:p-6">
          <div className="mb-5 flex flex-wrap gap-2">
            <span className="self-center text-xs font-medium text-ink/50">ניסו:</span>
            {EXAMPLES.map((example, index) => (
              <span
                key={example}
                className={
                  index === 0
                    ? "rounded-full bg-lavender px-3 py-1.5 text-xs font-semibold text-brand"
                    : "rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-ink/60"
                }
              >
                {example}
              </span>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm border border-white/70 bg-white/80 px-4 py-3 text-sm shadow-sm">
                האם מותר לספר על מעשה חברי בפני אנשים אחרים, גם אם הוא כבר יודע?
              </div>
            </div>

            <div className="flex gap-3">
              <BrandMark className="size-9 shrink-0 text-sm" />
              <div className="max-w-[85%] space-y-3">
                <div className="rounded-2xl rounded-tr-sm border border-white/60 bg-lavender/70 px-4 py-3 text-sm leading-relaxed">
                  התשובה תינתן רק אם נמצא במאגר מקור מתאים, ובכל תשובה יצוינו שם הספר והפרק שעליהם
                  היא מבוססת. במקרה של ספק — המערכת מפנה לרב מוסמך.
                </div>
                <div className="rounded-2xl border border-white/60 bg-mint/50 px-4 py-2.5 text-xs font-semibold text-ink/70">
                  <span className="ml-2 inline-block size-1.5 rounded-full bg-emerald-400 align-middle" />
                  קטעי המקור מוצגים ליד כל תשובה
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-full border border-white/80 bg-white/70 p-1.5 pl-4 shadow-inner">
            <span className="flex-1 text-sm text-ink/40">כתוב שאלת הלכה שלך...</span>
            <Link
              to="/chat"
              className="grid size-10 place-items-center rounded-full bg-brand text-lg text-white shadow-brand transition hover:bg-brand-strong"
              aria-label="כניסה לצ'אט"
            >
              ←
            </Link>
          </div>

          <p className="mt-4 text-center text-[11px] font-medium text-ink/40">
            ⚠ המערכת אינה תחליף לפסיקת רב מוסמך
          </p>
        </div>

        <div className="mt-8 flex max-w-2xl flex-wrap justify-center gap-4">
          {[
            ["📄", "העלאת מקורות PDF"],
            ["🧬", "Chunking + Embedding אוטומטי"],
            ["🔍", "Semantic Search בכל שאלה"],
          ].map(([icon, label]) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/70 bg-white/40 px-5 py-3 backdrop-blur-md"
            >
              <span className="text-lg">{icon}</span>
              <span className="text-xs font-semibold text-ink/70">{label}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
