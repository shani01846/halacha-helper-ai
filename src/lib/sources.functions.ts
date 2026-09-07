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
    const { error } = await context.supabase.from("sources").delete().eq("id", data.sourceId);
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
        text: z.string().min(50).max(400000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ sourceId: string; chunks: number }> => {
    const { chunkText, embedTexts } = await import("./rag.server");

    const chunks = chunkText(data.text);
    if (chunks.length === 0) throw new Error("לא נמצא טקסט קריא במסמך.");

    const { data: source, error: sourceError } = await context.supabase
      .from("sources")
      .insert({
        book: data.book,
        title: data.title,
        uploaded_by: context.userId,
        chunk_count: chunks.length,
      })
      .select("id")
      .single();
    if (sourceError) throw new Error(sourceError.message);

    try {
      const embeddings = await embedTexts(chunks);
      const rows = chunks.map((content, index) => ({
        source_id: source.id,
        book: data.book,
        reference: data.reference?.trim()
          ? `${data.reference.trim()} · קטע ${index + 1}`
          : `${data.title} · קטע ${index + 1}`,
        chunk_index: index,
        content,
        embedding: JSON.stringify(embeddings[index]),
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await context.supabase
          .from("source_chunks")
          .insert(rows.slice(i, i + 50) as unknown as never);
        if (error) throw new Error(error.message);
      }
    } catch (error) {
      await context.supabase.from("sources").delete().eq("id", source.id);
      throw error;
    }

    return { sourceId: source.id, chunks: chunks.length };
  });
