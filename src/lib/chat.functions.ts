import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SourceCitation = {
  book: string;
  reference: string;
  content: string;
  similarity: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: SourceCitation[];
  created_at: string;
};

export type ThreadSummary = {
  id: string;
  title: string;
  updated_at: string;
};

const NO_SOURCE_ANSWER =
  "לא נמצא במאגר מקור רלוונטי לשאלה זו, ולכן איני יכול לענות עליה. אין באפשרותי להשיב מידע כללי שאינו מבוסס על המקורות שנטענו למערכת. מומלץ להוסיף למאגר את הספרים הרלוונטיים, או לפנות לרב מוסמך.\n\nהמערכת אינה תחליף לפסיקת רב מוסמך.";

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadSummary[]> => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string }> => {
    const { data, error } = await context.supabase
      .from("threads")
      .insert({ user_id: context.userId, title: "שיחה חדשה" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<ChatMessage[]> => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, role, content, sources, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      content: row.content,
      sources: (row.sources ?? []) as SourceCitation[],
      created_at: row.created_at,
    }));
  });

export const askQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ threadId: z.string().uuid(), question: z.string().min(2).max(2000) })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ChatMessage> => {
    const { embedTexts, generateAnswer } = await import("./rag.server");

    const { data: historyRows } = await context.supabase
      .from("messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(20);

    const history = (historyRows ?? []).map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));

    const { error: userInsertError } = await context.supabase.from("messages").insert({
      thread_id: data.threadId,
      user_id: context.userId,
      role: "user",
      content: data.question,
    });
    if (userInsertError) throw new Error(userInsertError.message);

    if (history.length === 0) {
      await context.supabase
        .from("threads")
        .update({ title: data.question.slice(0, 60) })
        .eq("id", data.threadId);
    }

    const [embedding] = await embedTexts([data.question]);
    const { data: matches, error: matchError } = await context.supabase.rpc(
      "match_source_chunks",
      { query_embedding: embedding as unknown as string, match_count: 6 },
    );
    if (matchError) throw new Error(matchError.message);

    const relevant = (matches ?? []).filter(
      (m: { similarity: number }) => m.similarity >= 0.35,
    );

    const sources: SourceCitation[] = relevant.map(
      (m: { book: string; reference: string; content: string; similarity: number }) => ({
        book: m.book,
        reference: m.reference,
        content: m.content,
        similarity: m.similarity,
      }),
    );

    const answer =
      sources.length === 0
        ? NO_SOURCE_ANSWER
        : (await generateAnswer(data.question, sources, history)) || NO_SOURCE_ANSWER;

    const { data: inserted, error: insertError } = await context.supabase
      .from("messages")
      .insert({
        thread_id: data.threadId,
        user_id: context.userId,
        role: "assistant",
        content: answer,
        sources: sources as unknown as never,
      })
      .select("id, role, content, sources, created_at")
      .single();
    if (insertError) throw new Error(insertError.message);

    return {
      id: inserted.id,
      role: "assistant",
      content: inserted.content,
      sources,
      created_at: inserted.created_at,
    };
  });
