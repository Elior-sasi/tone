"use client";
import { IconAddHome, IconLock, IconShare } from "./Icons";
import { Button, Sheet, Switch } from "./ui";
import type { Settings } from "@/lib/settings";

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="py-2">
      <legend className="font-semibold mb-2">{label}</legend>
      <div className="grid gap-1 p-1 rounded-[1rem] bg-surface-2 border border-hairline" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
            className={`pressable min-h-11 rounded-[0.8rem] text-[0.9rem] font-semibold px-1 ${value === o.v ? "bg-surface-solid shadow-soft text-ink" : "text-ink-2"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsSheet({ open, onClose, settings, update, onInstall, onHelp, installed }: {
  open: boolean; onClose: () => void; settings: Settings; update: (p: Partial<Settings>) => void;
  onInstall: () => void; onHelp: () => void; installed: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="הגדרות">
      <div className="flex flex-col divide-y divide-hairline">
        <Segmented
          label="איכות הצלצול (AAC)"
          value={settings.bitrate}
          onChange={(v) => update({ bitrate: v })}
          options={[{ v: 128, label: "128kbps" }, { v: 160, label: "160kbps" }, { v: 192, label: "192kbps" }]}
        />
        <Switch checked={settings.normalize} onChange={(v) => update({ normalize: v })} label="איזון עוצמה" description="מביא את הצלצול לעוצמה אחידה וברורה" />
        <Switch checked={settings.fade} onChange={(v) => update({ fade: v })} label="דעיכה עדינה בסוף" description="מונע קפיצה חדה כשהצלצול חוזר" />
        <Segmented
          label="איפה לעבד"
          value={settings.processing}
          onChange={(v) => update({ processing: v })}
          options={[{ v: "auto", label: "אוטומטי" }, { v: "device", label: "במכשיר" }, { v: "server", label: "בשרת" }]}
        />
        <p className="text-[0.82rem] text-ink-3 py-2 leading-relaxed">
          ״אוטומטי״ מעבד במכשיר (הכי פרטי), ועובר לשרת רק אם המכשיר לא מצליח. קבצים שמיובאים מקישור תמיד מעובדים בשרת.
        </p>
        <div className="py-3 flex flex-col gap-2">
          {!installed && (
            <Button variant="glass" full onClick={onInstall}><IconAddHome size={20} /> הוסף את צור-tone למסך הבית</Button>
          )}
          <Button variant="ghost" full onClick={onHelp}>איך מגדירים צלצול באייפון?</Button>
        </div>
        <p className="flex gap-2 text-[0.85rem] text-ink-2 pt-3 leading-relaxed">
          <IconLock size={16} className="flex-none mt-0.5" />
          הקבצים שלך משמשים רק ליצירת הצלצול. כשאפשר, הכול קורה בתוך הדפדפן. קבצים שנשלחים לשרת נמחקים מיד בסיום העיבוד, ולכל המאוחר אחרי 20 דקות.
        </p>
      </div>
    </Sheet>
  );
}

export function IphoneHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="הגדרת צלצול באייפון">
      <section>
        <h3 className="font-bold">באייפון עם iOS 26 ומעלה:</h3>
        <ol className="mt-2 flex flex-col gap-1.5 list-decimal ps-6 leading-relaxed text-ink-2">
          <li>לחץ על ״שתף והשתמש כצלצול״.</li>
          <li>בגיליון השיתוף חפש ״השתמש כצלצול״.</li>
          <li>אם הוא לא מופיע מיד, לחץ על ״עוד״.</li>
        </ol>
      </section>
      <section className="mt-5 rounded-[1.25rem] bg-sky-soft p-4">
        <h3 className="font-bold">לא מופיע ״השתמש כצלצול״?</h3>
        <ol className="mt-2 flex flex-col gap-1.5 list-decimal ps-6 leading-relaxed">
          <li>שמור את הקובץ ב״קבצים״.</li>
          <li>פתח את אפליקציית ״קבצים״.</li>
          <li>לחץ לחיצה ארוכה על הצלצול.</li>
          <li>בחר ״שתף״.</li>
          <li>בחר ״השתמש כצלצול״.</li>
        </ol>
      </section>
      <p className="mt-4 text-[0.85rem] text-ink-3 leading-relaxed">
        אתר אינטרנט לא יכול לשנות את הצלצול בעצמו. צור-tone יוצר קובץ M4A תקין ופותח את גיליון השיתוף, והבחירה ב״השתמש כצלצול״ נעשית על ידך, כש־iOS מציג אותה.
      </p>
      <Button variant="accent" size="lg" full className="mt-4" onClick={onClose}>הבנתי</Button>
    </Sheet>
  );
}

export function InstallSheet({ open, onClose, isIOS, installed, canPrompt, onPrompt }: {
  open: boolean; onClose: () => void; isIOS: boolean; installed: boolean; canPrompt: boolean; onPrompt: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="הוסף את צור-tone למסך הבית">
      {installed ? (
        <p className="py-2 text-ink-2">צור-tone כבר מותקנת במכשיר הזה <span aria-hidden="true">🎉</span></p>
      ) : canPrompt ? (
        <>
          <p className="text-ink-2 leading-relaxed">האפליקציה תיפתח במסך מלא, בלי סרגלי דפדפן, ותעבוד גם בלי חיבור.</p>
          <Button variant="accent" size="lg" full className="mt-4" onClick={onPrompt}><IconAddHome size={20} /> התקן</Button>
        </>
      ) : isIOS ? (
        <>
          <ol className="flex flex-col gap-3 leading-relaxed">
            <li className="flex gap-3 items-start">
              <span className="grid place-items-center h-8 w-8 flex-none rounded-full bg-sky text-on-accent font-bold">1</span>
              <span>לחץ על כפתור השיתוף <IconShare size={18} className="inline -mt-1 text-sky-ink" aria-label="שיתוף" /> בסרגל של Safari.</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="grid place-items-center h-8 w-8 flex-none rounded-full bg-sky text-on-accent font-bold">2</span>
              <span>גלול ובחר ״הוסף למסך הבית״ <IconAddHome size={18} className="inline -mt-1 text-sky-ink" aria-hidden="true" />.</span>
            </li>
            <li className="flex gap-3 items-start">
              <span className="grid place-items-center h-8 w-8 flex-none rounded-full bg-sky text-on-accent font-bold">3</span>
              <span>ודא ש״פתח כאפליקציית אינטרנט״ מסומן ולחץ ״הוסף״.</span>
            </li>
          </ol>
          <Button variant="accent" size="lg" full className="mt-5" onClick={onClose}>הבנתי</Button>
        </>
      ) : (
        <>
          <p className="text-ink-2 leading-relaxed">בתפריט הדפדפן בחר ״התקן אפליקציה״ או ״הוסף למסך הבית״.</p>
          <Button variant="accent" size="lg" full className="mt-4" onClick={onClose}>הבנתי</Button>
        </>
      )}
    </Sheet>
  );
}
