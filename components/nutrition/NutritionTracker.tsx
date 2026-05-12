"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type FoodItem = {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type NutritionResult = {
  foods: FoodItem[];
  total: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  notes: string;
};

type LogEntry = {
  id: string;
  food_name: string;
  portion: string | null;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  source: string;
  log_date: string;
  logged_at: string;
};

type Tab = "text" | "image" | "quick";

function Spinner() {
  return (
    <span
      className="inline-block h-5 w-5 rounded-full border-2 border-cyan border-t-transparent animate-spin"
      aria-label="Loading"
    />
  );
}

function MacroBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  if (value == null) return null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="mono text-[9px] uppercase tracking-widest" style={{ color }}>
        {label}
      </span>
      <span className="terminal text-[17px] text-star">{value.toFixed(1)}g</span>
    </div>
  );
}

function FoodResultCard({
  food,
  checked,
  onToggle,
  showCheckbox = true,
}: {
  food: FoodItem;
  checked?: boolean;
  onToggle?: () => void;
  showCheckbox?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border border-purple/40 bg-midnight-deep/60 p-4">
      {showCheckbox && (
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 accent-yellow cursor-pointer"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="terminal text-[20px] text-star font-bold">{food.name}</span>
          {food.portion && (
            <span className="mono text-[10px] text-cyan uppercase tracking-wider">{food.portion}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-4">
          <div className="flex flex-col">
            <span className="mono text-[9px] uppercase tracking-widest text-yellow">kcal</span>
            <span className="terminal text-[22px] text-yellow glow-yellow">{food.calories}</span>
          </div>
          <MacroBar label="Protein" value={food.protein_g} color="var(--magenta)" />
          <MacroBar label="Carbs" value={food.carbs_g} color="var(--cyan)" />
          <MacroBar label="Fat" value={food.fat_g} color="var(--purple)" />
        </div>
      </div>
    </div>
  );
}

function TextTab({ onAdded }: { onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NutritionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gemini refused the signal.");
      setResult(data.nutrition as NutritionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "A cosmic ray interrupted the analysis.");
    } finally {
      setLoading(false);
    }
  }

  async function addToLog() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const payload = result.foods.map((f) => ({
        food_name: f.name,
        portion: f.portion,
        calories: f.calories,
        protein_g: f.protein_g,
        carbs_g: f.carbs_g,
        fat_g: f.fat_g,
        notes: result.notes || null,
        source: "text",
      }));
      const res = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Log write failed.");
      }
      setQuery("");
      setResult(null);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log write failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={analyze} className="space-y-4">
        <div>
          <label className="mono text-[10.5px] uppercase tracking-meta text-cyan">
            Describe what you ate
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. a large bowl of oatmeal with banana and honey, and a black coffee"
            className="mt-1"
            rows={3}
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="primary" disabled={loading || !query.trim()}>
            {loading ? <span className="flex items-center gap-2"><Spinner /> Analysing…</span> : "Analyse with AI"}
          </button>
          {result && (
            <button
              type="button"
              onClick={() => { setResult(null); setError(null); }}
              className="ghost"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="border-l-4 border-magenta bg-magenta/10 px-4 py-3 terminal text-[18px] text-star">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3 rise">
          <p className="mono text-[10.5px] uppercase tracking-meta text-magenta glow-magenta">
            AI found {result.foods.length} item{result.foods.length !== 1 ? "s" : ""}
          </p>
          {result.foods.map((food, i) => (
            <FoodResultCard key={i} food={food} showCheckbox={false} />
          ))}
          {result.notes && (
            <p className="terminal text-[16px] text-mute italic px-1">{result.notes}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cyan/30 pt-4">
            <div className="flex gap-4">
              <div>
                <span className="mono text-[9px] uppercase tracking-widest text-yellow">Total kcal</span>
                <p className="terminal text-[24px] text-yellow glow-yellow">{result.total.calories}</p>
              </div>
              <MacroBar label="Protein" value={result.total.protein_g} color="var(--magenta)" />
              <MacroBar label="Carbs" value={result.total.carbs_g} color="var(--cyan)" />
              <MacroBar label="Fat" value={result.total.fat_g} color="var(--purple)" />
            </div>
            <button className="primary" onClick={addToLog} disabled={saving}>
              {saving ? <span className="flex items-center gap-2"><Spinner /> Saving…</span> : "Add to log"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageTab({ onAdded }: { onAdded: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NutritionResult | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      setError("Image too large — max 4 MB for AI scanning.");
      e.target.value = "";
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function scan() {
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/nutrition/image", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gemini vision failed.");
      const nutrition = data.nutrition as NutritionResult;
      setResult(nutrition);
      setSelected(new Array(nutrition.foods.length).fill(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vision scan failed — try a clearer image.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  async function addSelected() {
    if (!result) return;
    const chosen = result.foods.filter((_, i) => selected[i]);
    if (!chosen.length) {
      setError("Select at least one item to log.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = chosen.map((f) => ({
        food_name: f.name,
        portion: f.portion,
        calories: f.calories,
        protein_g: f.protein_g,
        carbs_g: f.carbs_g,
        fat_g: f.fat_g,
        notes: result.notes || null,
        source: "image",
      }));
      const res = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Log write failed.");
      }
      setPreview(null);
      setFile(null);
      setResult(null);
      setSelected([]);
      if (fileRef.current) fileRef.current.value = "";
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log write failed.");
    } finally {
      setSaving(false);
    }
  }

  const selectedTotal = result
    ? result.foods
        .filter((_, i) => selected[i])
        .reduce((acc, f) => ({ cal: acc.cal + f.calories, p: acc.p + f.protein_g, c: acc.c + f.carbs_g, fat: acc.fat + f.fat_g }), { cal: 0, p: 0, c: 0, fat: 0 })
    : null;

  return (
    <div className="space-y-5">
      <div>
        <label className="mono text-[10.5px] uppercase tracking-meta text-cyan block mb-2">
          Upload a meal photo (JPG / PNG / WEBP — max 4 MB)
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="!w-auto !border-none !p-0"
        />
      </div>

      {preview && (
        <div className="border border-cyan/60 bg-midnight-deep p-2 shadow-[0_0_18px_rgba(0,240,255,0.25)]">
          <img src={preview} alt="Meal preview" className="max-h-[360px] w-full object-contain" />
        </div>
      )}

      {preview && !result && (
        <button className="primary" onClick={scan} disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2"><Spinner /> Scanning with AI…</span>
          ) : (
            "Scan with AI"
          )}
        </button>
      )}

      {error && (
        <div className="border-l-4 border-magenta bg-magenta/10 px-4 py-3 terminal text-[18px] text-star">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3 rise">
          <p className="mono text-[10.5px] uppercase tracking-meta text-magenta glow-magenta">
            AI detected {result.foods.length} item{result.foods.length !== 1 ? "s" : ""} — select what to log
          </p>
          {result.foods.map((food, i) => (
            <FoodResultCard
              key={i}
              food={food}
              checked={selected[i]}
              onToggle={() => toggle(i)}
              showCheckbox
            />
          ))}
          {result.notes && (
            <p className="terminal text-[16px] text-mute italic px-1">{result.notes}</p>
          )}
          {selectedTotal && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cyan/30 pt-4">
              <div className="flex gap-4">
                <div>
                  <span className="mono text-[9px] uppercase tracking-widest text-yellow">Selected kcal</span>
                  <p className="terminal text-[24px] text-yellow glow-yellow">{selectedTotal.cal.toFixed(1)}</p>
                </div>
                <MacroBar label="Protein" value={selectedTotal.p} color="var(--magenta)" />
                <MacroBar label="Carbs" value={selectedTotal.c} color="var(--cyan)" />
                <MacroBar label="Fat" value={selectedTotal.fat} color="var(--purple)" />
              </div>
              <button className="primary" onClick={addSelected} disabled={saving || !selected.some(Boolean)}>
                {saving ? <span className="flex items-center gap-2"><Spinner /> Saving…</span> : "Add selected to log"}
              </button>
            </div>
          )}
        </div>
      )}

      {!preview && (
        <div className="border border-dashed border-purple/60 bg-midnight-deep/60 px-4 py-14 text-center">
          <p className="terminal text-star-soft text-[19px]">
            Take a photo of your meal or choose one from your library.
          </p>
          <p className="mono text-[10px] uppercase tracking-meta text-mute mt-2">
            AI will identify every item it can see
          </p>
        </div>
      )}
    </div>
  );
}

function QuickAddTab({ onAdded }: { onAdded: () => void }) {
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!foodName.trim() || !calories.trim()) return;
    const cal = parseFloat(calories);
    if (isNaN(cal) || cal < 0) {
      setError("Enter a valid calorie count.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{
          food_name: foodName.trim(),
          calories: cal,
          protein_g: protein ? parseFloat(protein) : null,
          carbs_g: carbs ? parseFloat(carbs) : null,
          fat_g: fat ? parseFloat(fat) : null,
          source: "quick",
        }]),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Log write failed.");
      }
      setFoodName("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log write failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={add} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mono text-[10.5px] uppercase tracking-meta text-cyan">Food name</label>
          <input
            type="text"
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            placeholder="e.g. Greek yoghurt"
            required
          />
        </div>
        <div>
          <label className="mono text-[10.5px] uppercase tracking-meta text-yellow">Calories (kcal) *</label>
          <input
            type="number"
            min="0"
            step="1"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="e.g. 150"
            required
          />
        </div>
        <div>
          <label className="mono text-[10.5px] uppercase tracking-meta text-magenta">Protein (g)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="optional"
          />
        </div>
        <div>
          <label className="mono text-[10.5px] uppercase tracking-meta text-cyan">Carbs (g)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="optional"
          />
        </div>
        <div>
          <label className="mono text-[10.5px] uppercase tracking-meta" style={{ color: "var(--purple)" }}>Fat (g)</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            placeholder="optional"
          />
        </div>
      </div>

      {error && (
        <div className="border-l-4 border-magenta bg-magenta/10 px-4 py-3 terminal text-[18px] text-star">
          {error}
        </div>
      )}

      <button type="submit" className="primary" disabled={saving || !foodName.trim() || !calories.trim()}>
        {saving ? <span className="flex items-center gap-2"><Spinner /> Saving…</span> : "Add to log"}
      </button>
    </form>
  );
}

function CalorieProgressBar({ consumed, goal }: { consumed: number; goal: number }) {
  const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  const color = pct <= 60 ? "#22c55e" : pct <= 90 ? "#eab308" : "#ef4444";
  const label = pct <= 60 ? "On track" : pct <= 90 ? "Getting close" : consumed >= goal ? "Goal reached" : "Near limit";

  return (
    <div className="px-6 py-4 border-t border-cyan/20">
      <div className="flex items-center justify-between mb-2">
        <span className="mono text-[9px] uppercase tracking-widest text-star-soft">Daily goal</span>
        <span className="mono text-[9px] uppercase tracking-widest" style={{ color }}>
          {consumed.toFixed(0)} / {goal} kcal · {label}
        </span>
      </div>
      <div className="h-2 w-full bg-midnight-deep/80 rounded-full overflow-hidden border border-purple/20">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}88` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="mono text-[8px] text-mute">0</span>
        <span className="mono text-[8px] text-mute">{goal} kcal</span>
      </div>
    </div>
  );
}

function TodayLog({
  entries,
  onDelete,
  dailyGoal,
}: {
  entries: LogEntry[];
  onDelete: (id: string) => void;
  dailyGoal: number;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const total = entries.reduce(
    (acc, e) => ({
      cal: acc.cal + e.calories,
      p: acc.p + (e.protein_g ?? 0),
      c: acc.c + (e.carbs_g ?? 0),
      fat: acc.fat + (e.fat_g ?? 0),
    }),
    { cal: 0, p: 0, c: 0, fat: 0 }
  );

  async function deleteEntry(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/nutrition/log?id=${id}`, { method: "DELETE" });
      onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="border border-cyan/40 bg-midnight-soft/60 shadow-[0_0_28px_rgba(0,240,255,0.10)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan/30 px-6 py-4">
        <div>
          <h2 className="mono text-[11px] uppercase tracking-meta text-magenta glow-magenta">
            Today&apos;s log
          </h2>
          <p className="terminal text-[16px] text-star-soft mt-0.5">{today}</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="mono text-[9px] uppercase tracking-widest text-yellow">Total kcal</p>
            <p className="terminal text-[26px] text-yellow glow-yellow">{total.cal.toFixed(0)}</p>
          </div>
          {total.p > 0 && (
            <div>
              <p className="mono text-[9px] uppercase tracking-widest text-magenta">Protein</p>
              <p className="terminal text-[22px] text-magenta">{total.p.toFixed(1)}g</p>
            </div>
          )}
          {total.c > 0 && (
            <div>
              <p className="mono text-[9px] uppercase tracking-widest text-cyan">Carbs</p>
              <p className="terminal text-[22px] text-cyan">{total.c.toFixed(1)}g</p>
            </div>
          )}
          {total.fat > 0 && (
            <div>
              <p className="mono text-[9px] uppercase tracking-widest" style={{ color: "var(--purple)" }}>Fat</p>
              <p className="terminal text-[22px]" style={{ color: "var(--purple)" }}>{total.fat.toFixed(1)}g</p>
            </div>
          )}
        </div>
      </div>

      <CalorieProgressBar consumed={total.cal} goal={dailyGoal} />

      {entries.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="terminal text-star-soft text-[19px]">No entries yet today.</p>
          <p className="mono text-[10px] uppercase tracking-meta text-mute mt-2">
            Add food above — the universe needs fuel.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-cyan/20">
          {entries.map((entry) => {
            const time = new Date(entry.logged_at).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const sourceLabel = entry.source === "image" ? "📷" : entry.source === "quick" ? "✏️" : "AI";
            return (
              <li key={entry.id} className="flex items-center gap-3 px-6 py-3">
                <span className="mono text-[9px] text-mute w-10 shrink-0">{time}</span>
                <div className="flex-1 min-w-0">
                  <span className="terminal text-[19px] text-star">{entry.food_name}</span>
                  {entry.portion && (
                    <span className="terminal text-[15px] text-star-soft ml-2">· {entry.portion}</span>
                  )}
                </div>
                <span className="terminal text-[18px] text-yellow shrink-0">
                  {entry.calories.toFixed(0)} kcal
                </span>
                <span className="mono text-[10px] text-mute shrink-0">{sourceLabel}</span>
                <button
                  className="ghost text-[10px] shrink-0 text-mute hover:text-magenta"
                  onClick={() => deleteEntry(entry.id)}
                  disabled={deletingId === entry.id}
                  title="Remove"
                >
                  {deletingId === entry.id ? "…" : "×"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="border-t border-cyan/20 px-6 py-3 mono text-[9px] uppercase tracking-meta text-mute">
        Resets at midnight · full history kept in database
      </p>
    </section>
  );
}

export default function NutritionTracker({ displayName }: { displayName: string }) {
  const [tab, setTab] = useState<Tab>("text");
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("2000");

  const today = new Date().toISOString().split("T")[0];

  const fetchLog = useCallback(async () => {
    setLoadingLog(true);
    try {
      const res = await fetch(`/api/nutrition/log?date=${today}`);
      const data = await res.json();
      setEntries(data.logs ?? []);
    } finally {
      setLoadingLog(false);
    }
  }, [today]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const tabs: { key: Tab; label: string; desc: string }[] = [
    { key: "text", label: "Describe", desc: "AI analyses your words" },
    { key: "image", label: "Photo scan", desc: "AI reads your plate" },
    { key: "quick", label: "Quick add", desc: "Enter values manually" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="mono text-[10.5px] uppercase tracking-meta text-cyan">
          Calorie tracker · {displayName}
        </p>
        <h1 className="serif text-[clamp(28px,5vw,48px)] text-magenta glow-magenta mt-1">
          Today&apos;s fuel
        </h1>
      </div>

      <div className="border border-purple/60 bg-midnight-soft/60 shadow-[0_0_38px_rgba(157,0,255,0.18)]">
        <div className="flex flex-wrap border-b border-cyan/30">
          {tabs.map(({ key, label, desc }) => (
            <button
              key={key}
              type="button"
              className={`flex-1 px-4 py-4 text-left border-none transition-colors ${
                tab === key
                  ? "bg-yellow/10 text-yellow [box-shadow:0_2px_0_var(--yellow),inset_0_-1px_0_var(--yellow)]"
                  : "text-star-soft hover:text-cyan hover:bg-midnight-deep/40"
              }`}
              onClick={() => setTab(key)}
            >
              <span className="mono text-[10px] uppercase tracking-widest block">{label}</span>
              <span className="terminal text-[14px] text-mute">{desc}</span>
            </button>
          ))}
        </div>

        <div className="p-6 md:p-8">
          {tab === "text" && <TextTab onAdded={fetchLog} />}
          {tab === "image" && <ImageTab onAdded={fetchLog} />}
          {tab === "quick" && <QuickAddTab onAdded={fetchLog} />}
        </div>
      </div>

      {/* Daily goal editor */}
      <div className="flex flex-wrap items-center gap-3 border border-purple/30 bg-midnight-soft/40 px-5 py-3">
        <span className="mono text-[10px] uppercase tracking-meta text-star-soft shrink-0">Daily calorie goal</span>
        {editingGoal ? (
          <>
            <input
              type="number"
              min="500"
              max="10000"
              step="50"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              style={{ width: "7rem", minHeight: 0, padding: "4px 8px", fontSize: "16px" }}
            />
            <button
              type="button"
              style={{ padding: "4px 12px", fontSize: "10px" }}
              className="primary"
              onClick={() => {
                const v = parseInt(goalInput, 10);
                if (!isNaN(v) && v >= 500) setDailyGoal(v);
                setEditingGoal(false);
              }}
            >Save</button>
            <button type="button" className="ghost" style={{ fontSize: "10px" }} onClick={() => setEditingGoal(false)}>Cancel</button>
          </>
        ) : (
          <>
            <span className="terminal text-[20px] text-yellow glow-yellow">{dailyGoal} kcal</span>
            <button type="button" className="ghost" style={{ fontSize: "10px" }} onClick={() => { setGoalInput(String(dailyGoal)); setEditingGoal(true); }}>
              Edit
            </button>
          </>
        )}
      </div>

      {loadingLog ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <TodayLog entries={entries} onDelete={handleDelete} dailyGoal={dailyGoal} />
      )}

      <footer className="border-t border-cyan/30 pt-6 text-center">
        <p className="terminal text-star-soft text-[17px]">
          We are, all of us, made of star-stuff.
        </p>
      </footer>
    </div>
  );
}
