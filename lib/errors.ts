// Every error the user can see is mapped to clear Hebrew here.
// Technical details go to the console only.

export type ErrorCode =
  | "failed"
  | "no_audio"
  | "bad_input"
  | "memory"
  | "engine_load"
  | "too_large"
  | "unsupported_type"
  | "cant_play"
  | "import_failed"
  | "unsupported_provider"
  | "invalid_url"
  | "network"
  | "share_blocked"
  | "server_unavailable"
  | "cancelled";

export const MESSAGES: Record<ErrorCode, { title: string; body: string }> = {
  failed: { title: "משהו השתבש", body: "לא הצלחנו ליצור את הצלצול. נסה שוב או בחר קובץ אחר." },
  no_audio: { title: "אין כאן אודיו", body: "לא מצאנו אודיו בסרטון הזה." },
  bad_input: { title: "הקובץ לא נקרא", body: "לא הצלחנו לקרוא את הקובץ. ייתכן שהוא פגום או בפורמט לא נתמך. נסה קובץ אחר." },
  memory: { title: "הקובץ כבד מדי למכשיר", body: "למכשיר אין מספיק זיכרון לעבד את הקובץ הזה. נסה שוב, או סרטון קצר יותר." },
  engine_load: { title: "מנוע ההמרה לא נטען", body: "לא הצלחנו לטעון את מנוע ההמרה. בדוק את החיבור ונסה שוב." },
  too_large: { title: "הקובץ גדול מדי", body: "הקובץ גדול מדי. נסה סרטון קטן יותר." },
  unsupported_type: { title: "סוג קובץ לא נתמך", body: "אפשר לבחור וידאו (MP4, MOV, M4V, WebM) או אודיו (MP3, M4A, AAC, WAV)." },
  cant_play: { title: "לא ניתן להציג את הקובץ", body: "הדפדפן לא מצליח לנגן את הקובץ הזה. נסה קובץ MP4 או MOV." },
  import_failed: {
    title: "הייבוא לא הצליח",
    body: "לא הצלחנו לייבא את הסרטון מהקישור הזה. אפשר לשמור את הסרטון למכשיר ואז לבחור אותו מכאן.",
  },
  unsupported_provider: {
    title: "הקישור אינו נתמך כרגע",
    body: "הקישור אינו נתמך כרגע. אפשר לשמור את הסרטון למכשיר ואז לבחור אותו מכאן.",
  },
  invalid_url: { title: "הקישור לא תקין", body: "זה לא נראה כמו קישור תקין. בדוק אותו ונסה שוב." },
  network: { title: "החיבור נותק", body: "החיבור נותק במהלך העיבוד. בדוק את החיבור ונסה שוב." },
  share_blocked: {
    title: "השיתוף לא נפתח",
    body: "Safari לא מאפשר לשתף את הקובץ ישירות. שמור אותו לקבצים והמשך משם.",
  },
  server_unavailable: { title: "השרת לא זמין", body: "שרת ההמרה לא זמין כרגע. נסה שוב בעוד רגע." },
  cancelled: { title: "בוטל", body: "הפעולה בוטלה." },
};

export class AppError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
  get title() { return MESSAGES[this.code].title; }
  get body() { return MESSAGES[this.code].body; }

  static fromEngine(code: string): AppError {
    if (code in MESSAGES) return new AppError(code as ErrorCode);
    return new AppError("failed");
  }

  static from(e: unknown): AppError {
    if (e instanceof AppError) return e;
    if (e instanceof TypeError) return new AppError("network");
    return new AppError("failed");
  }
}
