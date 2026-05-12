"use client";

import { useRef, useState } from "react";

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
      aria-hidden="true"
    />
  );
}

const MAX_IMAGE_BYTES = 800 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });
}

async function imageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image dimensions."));
    img.src = dataUrl;
  });
}

export default function Composer({ onPosted }: { onPosted: (post: unknown) => void }) {
  const [body, setBody] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ w: number; h: number; kb: number } | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) {
      setError(`Image too large (${Math.round(f.size / 1024)} KB). Cap is 800 KB.`);
      e.target.value = "";
      return;
    }
    const dataUrl = await fileToDataUrl(f);
    const { w, h } = await imageDimensions(dataUrl);
    setImageData(dataUrl);
    setImageMeta({ w, h, kb: Math.round(f.size / 1024) });
  }

  function removePhoto() {
    setImageData(null);
    setImageMeta(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function togglePhoto() {
    if (showPhoto && imageData) removePhoto();
    setShowPhoto((v) => !v);
    setError(null);
  }

  function reset() {
    setBody("");
    setImageData(null);
    setImageMeta(null);
    setShowPhoto(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !imageData) {
      setError("Write something or attach a photo before sending.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const locale = typeof navigator !== "undefined" ? navigator.language : null;
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: imageData ? "image" : "text",
          body: body.trim() || null,
          image: imageData,
          imageW: imageMeta?.w ?? null,
          imageH: imageMeta?.h ?? null,
          imageKb: imageMeta?.kb ?? null,
          clientLocale: locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transmission refused.");
      onPosted(data.post);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "A cosmic ray flipped a bit. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && (!!body.trim() || !!imageData);

  return (
    <form
      onSubmit={submit}
      className="border border-purple/60 bg-midnight-soft/60 p-6 md:p-8 shadow-[0_0_38px_rgba(157,0,255,0.18)]"
    >
      <div className="flex items-center justify-between border-b border-cyan/30 pb-3">
        <span className="mono text-[11px] uppercase tracking-meta text-yellow glow-yellow">New post</span>
        <span className="mono text-[10px] uppercase tracking-meta text-mute">
          Max 800 chars
        </span>
      </div>

      {/* Primary: text */}
      <div className="mt-5">
        <label className="sr-only" htmlFor="composer-body">Write your post</label>
        <textarea
          id="composer-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={800}
          rows={4}
          placeholder="What are you observing? A thought, a place, a moment."
        />
        <p className={
          "mono mt-2 text-[10.5px] uppercase tracking-meta transition-colors " +
          (body.length > 720 ? (body.length > 780 ? "text-magenta glow-magenta" : "text-yellow glow-yellow") : "text-cyan")
        }>
          {body.length} / 800 chars{body.length > 720 ? ` · ${800 - body.length} remaining` : ""}
        </p>
      </div>

      {/* Secondary: photo toggle */}
      <div className="mt-4">
        <button
          type="button"
          onClick={togglePhoto}
          className="flex items-center gap-2"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          {showPhoto ? (imageData ? "Remove photo" : "Hide photo") : "Add photo"}
        </button>

        {showPhoto && (
          <div className="mt-4 space-y-3">
            {imageData ? (
              <>
                <div className="border border-cyan/60 bg-midnight-deep p-2 shadow-[0_0_18px_rgba(0,240,255,0.25)]">
                  <img src={imageData} alt="preview" className="max-h-[420px] w-full object-contain" />
                  {imageMeta && (
                    <p className="mono mt-2 text-[10.5px] uppercase tracking-meta text-cyan">
                      {imageMeta.w} × {imageMeta.h} · {imageMeta.kb} KB
                    </p>
                  )}
                </div>
                <button type="button" onClick={removePhoto} className="ghost text-[10px]">
                  ← Choose a different photo
                </button>
              </>
            ) : (
              <label className="relative flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed border-purple/60 bg-midnight-deep/60 px-4 py-14 text-center hover:border-cyan/60 transition-colors">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={pickImage}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple/70">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <div>
                  <p className="terminal text-star-soft text-[18px]">Click to browse photos</p>
                  <p className="mono text-[10px] uppercase tracking-meta text-mute mt-1">
                    JPG · PNG · WEBP — max 800 KB
                  </p>
                </div>
              </label>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 border-l-4 border-magenta bg-magenta/10 px-4 py-3 terminal text-[18px] text-star">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button type="submit" className="primary" disabled={!canSubmit}>
          {busy ? <span className="flex items-center gap-2"><Spinner />Transmitting…</span> : "Publish"}
        </button>
      </div>
    </form>
  );
}
