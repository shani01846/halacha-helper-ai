import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SourceDoc = {
  id: string;
  book: string;
  title: string;
  chunk_count: number;
  created_at: string;
};

export const listSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SourceDoc[]> => {
    const { data, error } = await context.supabase
      .from("sources")
      .select("id, book, title, chunk_count, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sourceId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const SYSTEM_OWNER = "00000000-0000-0000-0000-000000000000";
    const { data: src, error: readError } = await context.supabase
      .from("sources")
      .select("id, uploaded_by")
      .eq("id", data.sourceId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!src) throw new Error("המקור לא נמצא");
    if (src.uploaded_by !== context.userId && src.uploaded_by !== SYSTEM_OWNER) {
      throw new Error("אין הרשאה למחוק מקור זה");
    }
    // System-seeded sources have no user owner, so delete them with elevated access after the check above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sources").delete().eq("id", data.sourceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Chunk + embed a source document into the vector store. */
export const ingestSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        book: z.string().min(1).max(200),
        title: z.string().min(1).max(300),
        reference: z.string().max(200).optional(),
        text: z.string().min(1).max(120000),
        sourceId: z.string().uuid().optional(),
        startIndex: z.number().int().min(0).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ sourceId: string; chunks: number }> => {
    const { chunkText, embedTexts } = await import("./rag.server");

    const chunks = chunkText(data.text);
    if (chunks.length === 0) throw new Error("לא נמצא טקסט קריא במסמך.");
    const start = data.startIndex ?? 0;

    let source: { id: string };
    if (data.sourceId) {
      source = { id: data.sourceId };
    } else {
      const { data: created, error: sourceError } = await context.supabase
        .from("sources")
        .insert({ book: data.book, title: data.title, uploaded_by: context.userId, chunk_count: 0 })
        .select("id")
        .single();
      if (sourceError) throw new Error(sourceError.message);
      source = created;
    }

    try {
      const embeddings = await embedTexts(chunks);
      const rows = chunks.map((content, index) => ({
        source_id: source.id,
        book: data.book,
        reference: data.reference?.trim()
          ? `${data.reference.trim()} · קטע ${start + index + 1}`
          : `${data.title} · קטע ${start + index + 1}`,
        chunk_index: start + index,
        content,
        embedding: JSON.stringify(embeddings[index]),
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await context.supabase
          .from("source_chunks")
          .insert(rows.slice(i, i + 50) as unknown as never);
        if (error) throw new Error(error.message);
      }
      await context.supabase
        .from("sources")
        .update({ chunk_count: start + chunks.length })
        .eq("id", source.id);
    } catch (error) {
      if (!data.sourceId) await context.supabase.from("sources").delete().eq("id", source.id);
      throw error;
    }

    return { sourceId: source.id, chunks: chunks.length };
  });
