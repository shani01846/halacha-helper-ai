# הלכות לשון הרע

בנה עבורי אתר עם עוזר בינה מלאכותית (AI Agent) שעונה על שאלות בהלכות לשון הרע.

דרישות טכניות:

ממשק צ'אט נקי ופשוט, בעברית (RTL), עיצוב מינימליסטי ונעים לעין

חיבור ל-Supabase עם pgvector ליצירת דטה בייס וקטורי (RAG) שיכיל את מקורות הלכות לשון הרע (חפץ חיים, שמירת הלשון, ופוסקים נוספים לפי מה שאטען למערכת)

מנגנון להעלאת מסמכי מקור (PDF/טקסט) שיבצע chunking + embedding אוטומטי לתוך הדטה בייס

כל שאלה של המשתמש תבצע חיפוש סמנטי (semantic search) במאגר לפני מתן תשובה

System Prompt לעוזר (החמרה מלאה):
"אתה עוזר הלכתי המתמחה בהלכות לשון הרע בלבד. עליך להקפיד:

לענות אך ורק על סמך המקורות שאוחזרו מהדטה בייס הוקטורי — אסור להסתמך על ידע כללי או להמציא תוכן.

בכל תשובה חובה לצטט את המקור המדויק (שם הספר, פרק/סעיף) שעליו מתבססת התשובה.

אם לא נמצא מקור רלוונטי במאגר — יש לומר זאת במפורש ולא לענות מהזיכרון הכללי.

במקרה של ספק הלכתי או מצב מורכב — להפנות את המשתמש לשאול רב מוסמך, ולא לפסוק הלכה למעשה.

לשמור על טון מכבד וזהיר, ולהימנע מקביעות נחרצות במקרים שאינם חד-משמעיים במקורות."

נוסף:

הוסף הצג ליד כל תשובה את קטעי המקור שאוחזרו (collapsible source citations)

הוסף Disclaimer קבוע בתחתית הצ'אט: "המערכת אינה תחליף לפסיקת רב מוסמך"

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://halacha-helper-ai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7d1f383d-d80c-41bf-a47d-69133f5c0382).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
