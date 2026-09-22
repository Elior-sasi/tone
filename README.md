# צור-tone

הופכים רגע לצלצול. אפליקציית Web/PWA שחותכת עד 29.8 שניות מתוך וידאו או אודיו, ממירה ל-M4A (AAC) ופותחת את גיליון השיתוף של iOS עם הקובץ עצמו.

## הפעלה

```bash
npm install          # מעתיק גם את ffmpeg.wasm ל-public/ffmpeg
npm run build
npm start            # http://localhost:3000
```

פיתוח: `npm run dev`. דרישות: Node 20 ומעלה. לשרת צריך FFmpeg: הוא מגיע אוטומטית דרך `ffmpeg-static`, או שמגדירים `FFMPEG_PATH`.

**באייפון נדרש HTTPS** (Service Worker, התקנה למסך הבית ושיתוף קבצים לא עובדים ב-HTTP).

### פריסה
- **Docker** (מומלץ, כולל FFmpeg): `docker build -t tzur-tone . && docker run -p 3000:3000 tzur-tone`. מתאים ל-Render, Railway, Fly.io ו-VPS.
- **Vercel**: עובד, אבל ייבוא מקישור והמרה בשרת כפופים למגבלות הזמן והגודל של Serverless. העיבוד המרכזי קורה בדפדפן, אז זה לא חוסם.

### משתני סביבה (אופציונלי)
| משתנה | ברירת מחדל | תפקיד |
|---|---|---|
| `FFMPEG_PATH` | ffmpeg-static | נתיב ל-FFmpeg בשרת |
| `MAX_UPLOAD_MB` | 500 | מגבלת גודל להעלאה ולייבוא |
| `MEDIA_TTL_MINUTES` | 20 | אחרי כמה זמן קבצים זמניים נמחקים |
| `TZUR_TMP_DIR` | תיקיית tmp של המערכת | איפה נשמרים קבצי עבודה |

## איך זה עובד

- **במכשיר (ברירת מחדל):** ffmpeg.wasm רץ ב-Worker. הקובץ מחובר דרך WORKERFS, כך שנקרא רק הטווח הדרוש והסרטון לא מועתק לזיכרון. חיתוך בצד הקלט (`-ss`/`-t` לפני `-i`), וידאו לא מפוענח כלל (`-vn`), קידוד AAC ל-44.1kHz, איזון עוצמה (loudnorm) ודעיכה אופציונליים, ו-`+faststart`. המנוע (כ-32MB) נטען רק כשפותחים קובץ, עם התקדמות אמיתית, ונשמר ב-Service Worker לשימוש אופליין.
- **בשרת (גיבוי):** אם המכשיר לא מצליח, במצב "אוטומטי" הקובץ נשלח ל-`POST /api/convert`, מעובד ונמחק מיד בסיום.
- **ייבוא מקישור:** `POST /api/import` מחזיר זרם NDJSON עם התקדמות אמיתית. הוא תומך בקישורים ישירים לקבצי מדיה ובעמודים שמפרסמים את הסרטון בגלוי (`og:video`). הקובץ מוגש לנגן עם Range, בלי להוריד את כולו לדפדפן. אין עקיפה של DRM, התחברות או הגנות: TikTok, YouTube, Instagram, Facebook, X, Vimeo ושירותי סטרימינג מקבלים הודעה ידידותית, והמשתמש מתבקש לשמור את הסרטון למכשיר. יש הגנת SSRF: כתובות פנימיות נחסמות גם אחרי redirect וגם ב-DNS.
- **שיתוף:** `navigator.canShare({ files })` ואחר כך `navigator.share` ישירות מתוך הלחיצה. אם אין תמיכה מוצגת הודעה, ואפשר לשמור לקבצים ולקבל הוראות.

## API
| נתיב | תיאור |
|---|---|
| `POST /api/import` `{url}` | ייבוא, זרם NDJSON: stage / done / error |
| `GET /api/media/:id` | הזרמת הקובץ המיובא (Range) |
| `GET /api/media/:id/peaks` | מעטפת waveform (float32) |
| `DELETE /api/media/:id` | מחיקה מיידית |
| `POST /api/convert?start&duration&format&bitrate&normalize&fade[&id]` | המרה בשרת: לפי id, או גוף הבקשה הוא הקובץ |
| `GET /api/health` | בדיקת זמינות FFmpeg |

## מבנה
- `components/App.tsx`: מכונת המצבים והניווט (כולל swipe-back)
- `components/Timeline.tsx`: טיימליין Trim עם pointer events, זום אוטומטי, סקירה כללית ונגישות
- `components/screens/*`: המסכים
- `public/ffmpeg-worker.js`, `lib/engine.ts`: מנוע ההמרה בדפדפן
- `lib/server/*`: FFmpeg בשרת, אחסון זמני, הגנת SSRF
- `public/sw.js`, `app/manifest.ts`, `scripts/make-icons.mjs`: PWA, אייקונים ומסכי פתיחה (`npm run icons`)
