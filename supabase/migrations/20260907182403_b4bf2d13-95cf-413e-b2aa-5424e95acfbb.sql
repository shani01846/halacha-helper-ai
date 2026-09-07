CREATE OR REPLACE FUNCTION public.match_source_chunks(query_embedding vector(3072), match_count INTEGER DEFAULT 6)
RETURNS TABLE (id UUID, book TEXT, reference TEXT, content TEXT, similarity DOUBLE PRECISION)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.id, c.book, c.reference, c.content,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.source_chunks c
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;
REVOKE ALL ON FUNCTION public.match_source_chunks(vector, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_source_chunks(vector, INTEGER) TO authenticated, service_role;