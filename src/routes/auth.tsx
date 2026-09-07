import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { GlassBackground, BrandMark } from "@/components/GlassBackground";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "כניסה — לשון טהורה" },
      {
        name: "description",
        content: "התחברות או הרשמה לעוזר ההלכתי בהלכות לשון הרע, לשמירת השיחות שלך.",
      },
      { property: "og:title", content: "כניסה — לשון טהורה" },
      { property: "og:description", content: "התחברות לעוזר ההלכתי בהלכות לשון הרע." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/chat" });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("נרשמת בהצלחה. אם נדרש אימות — בדוק את תיבת הדואר.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) void navigate({ to: "/chat" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההתחברות נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("ההתחברות עם Google נכשלה");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/chat" });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <GlassBackground />
      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/70 bg-white/60 p-7 shadow-glass backdrop-blur-2xl">
        <div className="flex flex-col items-center text-center">
          <BrandMark />
          <h1 className="mt-4 text-2xl font-bold">
            {mode === "signin" ? "כניסה לחשבון" : "יצירת חשבון"}
          </h1>
          <p className="mt-2 text-sm text-ink/55">
            החשבון שומר את השיחות שלך ואת מאגר המקורות שהעלית.
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="דואר אלקטרוני"
            className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-ink/40 focus:border-brand/40"
          />
          <input
            type="password"
            required
            minLength={6}
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="סיסמה"
            className="w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-ink/40 focus:border-brand/40"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-brand py-3 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-strong disabled:opacity-60"
          >
            {mode === "signin" ? "התחברות" : "הרשמה"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[11px] text-ink/40">
          <span className="h-px flex-1 bg-ink/10" />
          או
          <span className="h-px flex-1 bg-ink/10" />
        </div>

        <button
          onClick={google}
          disabled={busy}
          className="w-full rounded-2xl border border-white/80 bg-white/80 py-3 text-sm font-semibold text-ink/80 transition hover:bg-white disabled:opacity-60"
        >
          המשך עם Google
        </button>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center text-xs font-medium text-brand"
        >
          {mode === "signin" ? "אין לך חשבון? הרשמה" : "יש לך חשבון? התחברות"}
        </button>

        <p className="mt-6 text-center text-[11px] text-ink/40">
          המערכת אינה תחליף לפסיקת רב מוסמך
        </p>
      </div>
    </div>
  );
}
