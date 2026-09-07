CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book TEXT NOT NULL,
  title TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources_select" ON public.sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "sources_insert" ON public.sources FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "sources_update" ON public.sources FOR UPDATE TO authenticated USING (auth.uid() = uploaded_by) WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "sources_delete" ON public.sources FOR DELETE TO authenticated USING (auth.uid() = uploaded_by);

CREATE TABLE public.source_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  book TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(3072) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_chunks TO authenticated;
GRANT ALL ON public.source_chunks TO service_role;
ALTER TABLE public.source_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chunks_select" ON public.source_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY "chunks_insert" ON public.source_chunks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sources s WHERE s.id = source_id AND s.uploaded_by = auth.uid()));
CREATE POLICY "chunks_delete" ON public.source_chunks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sources s WHERE s.id = source_id AND s.uploaded_by = auth.uid()));

CREATE INDEX source_chunks_embedding_idx ON public.source_chunks
  USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
CREATE INDEX source_chunks_source_id_idx ON public.source_chunks(source_id);

CREATE TABLE public.threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'שיחה חדשה',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads TO authenticated;
GRANT ALL ON public.threads TO service_role;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "threads_all" ON public.threads FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_all" ON public.messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX messages_thread_idx ON public.messages(thread_id, created_at);

CREATE OR REPLACE FUNCTION public.match_source_chunks(query_embedding vector(3072), match_count INTEGER DEFAULT 6)
RETURNS TABLE (id UUID, book TEXT, reference TEXT, content TEXT, similarity DOUBLE PRECISION)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.book, c.reference, c.content,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.source_chunks c
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;
GRANT EXECUTE ON FUNCTION public.match_source_chunks(vector, INTEGER) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.touch_thread_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_touch_thread AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.touch_thread_updated_at();