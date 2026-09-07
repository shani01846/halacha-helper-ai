const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const EMBEDDING_MODEL = "google/gemini-embedding-2";
const CHAT_MODEL = "google/gemini-3.8-flash";

export const SYSTEM_PROMPT = `אתה עוזר הלכתי המתמחה בהלכות לשון הרע בלבד. עליך להקפיד:

1. לענות אך ורק על סמך המקורות שאוחזרו מהדטה בייס הוקטורי — אסור להסתמך על ידע כללי או להמציא תוכן.
2. בכל תשובה חובה לצטט את המקור המדויק (שם הספר, פרק/סעיף) שעליו מתבססת התשובה.
3. אם לא נמצא מקור רלוונטי במאגר — יש לומר זאת במפורש ולא לענות מהזיכרון הכללי.
4. במקרה של ספק הלכתי או מצב מורכב — להפנות את המשתמש לשאול רב מוסמך, ולא לפסוק הלכה למעשה.
5. לשמור על טון מכבד וזהיר, ולהימנע מקביעות נחרצות במקרים שאינם חד-משמעיים במקורות.

ענה בעברית, בקצרה ובבהירות, ותמיד בסוף התשובה הוסף שורה: "המערכת אינה תחליף לפסיקת רב מוסמך."`;

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

async function gatewayFetch(path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("יותר מדי בקשות כרגע. נסו שוב בעוד רגע.");
    if (res.status === 402) throw new Error("נגמרו קרדיטי הבינה המלאכותית בפרויקט.");
    throw new Error(`שגיאת שירות הבינה המלאכותית (${res.status}): ${text.slice(0, 200)}`);
  }
  return res;
}

/** Embed up to 100 texts per request (provider batch cap). */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += 50) {
    const batch = inputs.slice(i, i + 50);
    const res = await gatewayFetch("/embeddings", { model: EMBEDDING_MODEL, input: batch });
    const json = (await res.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) out.push(item.embedding);
  }
  return out;
}

export type RetrievedChunk = {
  book: string;
  reference: string;
  content: string;
  similarity: number;
};

export async function generateAnswer(
  question: string,
  chunks: RetrievedChunk[],
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const context = chunks
    .map(
      (c, i) =>
        `[מקור ${i + 1}] ${c.book}${c.reference ? ` — ${c.reference}` : ""}\n${c.content}`,
    )
    .join("\n\n");

  const res = await gatewayFetch("/chat/completions", {
    model: CHAT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-8),
      {
        role: "user",
        content: `המקורות שאוחזרו מהמאגר:\n\n${context}\n\n---\nשאלת המשתמש: ${question}\n\nענה אך ורק על סמך המקורות שלמעלה, וציין בגוף התשובה את שם הספר והפרק/סעיף.`,
      },
    ],
  });

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Split long source text into overlapping chunks of ~900 characters. */
export function chunkText(text: string, size = 900, overlap = 150): string[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  const paragraphs = clean.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    const trimmed = current.trim();
    if (trimmed.length > 0) chunks.push(trimmed);
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > size) {
      push();
      for (let i = 0; i < paragraph.length; i += size - overlap) {
        chunks.push(paragraph.slice(i, i + size).trim());
      }
      continue;
    }
    if ((current + "\n\n" + paragraph).length > size) push();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  push();

  return chunks.filter((c) => c.length > 40);
}
