"use client";

import { useEffect, useRef, useState } from "react";
import { WandSparklesIcon, ImageIcon, SearchIcon, XIcon, Loader2Icon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ACCENT_COLORS = [
  { name: "Gold", value: "#b9975b" },
  { name: "Smaragd", value: "#16a34a" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Rose", value: "#e11d48" },
  { name: "Bernstein", value: "#d97706" },
  { name: "Himmelblau", value: "#0284c7" },
];

const FONT_OPTIONS = [
  { key: "brand", label: "Marke (Switzer)", css: "" },
  { key: "serif", label: "Serif (Georgia)", css: "Georgia, 'Times New Roman', serif" },
  { key: "rounded", label: "Rund (Verdana)", css: "Verdana, Tahoma, sans-serif" },
  { key: "mono", label: "Mono (Courier)", css: "'Courier New', monospace" },
] as const;

const MIN_FONT_SIZE = 40;
const MAX_FONT_SIZE = 110;

const CANVAS_W = 1600;
const CANVAS_H = 900;

function resolveFontFamily(fontKey: string): string {
  const option = FONT_OPTIONS.find((f) => f.key === fontKey);
  if (option && option.css) return option.css;
  return getComputedStyle(document.documentElement).getPropertyValue("--font-switzer").trim() || "sans-serif";
}

type StockPhoto = {
  id: number;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  tags: string;
};

function wrapWords(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  for (const word of words) {
    const test = [...current, word].join(" ");
    if (current.length > 0 && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/**
 * Composes a course/module/lesson thumbnail on a canvas (background image +
 * bold title + accent bar, LearningSuite-style) and writes the result into
 * the surrounding form's existing file input via DataTransfer, so no server
 * action changes are needed - the generated PNG is submitted exactly like a
 * manually-picked file would be.
 */
export function ThumbnailGenerator({
  seedTitle,
  fileInputRef,
  onGenerate,
}: {
  seedTitle: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onGenerate: (previewUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(seedTitle);
  const [accent, setAccent] = useState(ACCENT_COLORS[0].value);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [highlighted, setHighlighted] = useState<Record<string, boolean>>({});
  const [fontKey, setFontKey] = useState<string>(FONT_OPTIONS[0].key);
  const [fontSize, setFontSize] = useState(72);
  const [logoText, setLogoText] = useState("KB");
  const [stockOpen, setStockOpen] = useState(false);
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<StockPhoto[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const words = Array.from(new Set(title.split(/\s+/).filter(Boolean)));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTitle(seedTitle);
      setHighlighted({});
    }
  }

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    if (bgImage) {
      const scale = Math.max(CANVAS_W / bgImage.width, CANVAS_H / bgImage.height);
      const w = bgImage.width * scale;
      const h = bgImage.height * scale;
      ctx.drawImage(bgImage, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      gradient.addColorStop(0, "rgba(8,11,17,0.25)");
      gradient.addColorStop(0.55, "rgba(8,11,17,0.55)");
      gradient.addColorStop(1, "rgba(8,11,17,0.88)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
      gradient.addColorStop(0, "#11151f");
      gradient.addColorStop(1, "#232a3a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    const fontFamily = resolveFontFamily(fontKey);

    ctx.textBaseline = "alphabetic";
    if (logoText.trim()) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 52px ${fontFamily}`;
      ctx.fillText(logoText, 56, 100);
      const monoWidth = ctx.measureText(logoText).width;
      ctx.fillStyle = accent;
      ctx.fillRect(56 + monoWidth + 10, 68, 34, 8);
    }

    const maxWidth = CANVAS_W - 112;
    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    const manualLines = title.length > 0 ? title.split("\n").filter((l) => l.trim().length > 0) : [];
    const renderLines: string[][] = [];
    for (const line of manualLines) {
      renderLines.push(...wrapWords(ctx, line.split(/\s+/).filter(Boolean), maxWidth));
    }

    const lineHeight = fontSize * 1.12;
    const blockHeight = renderLines.length * lineHeight;
    const bottomBarHeight = CANVAS_H * 0.035;
    let y = CANVAS_H - bottomBarHeight - 48 - blockHeight + fontSize * 0.85;

    const spaceWidth = ctx.measureText(" ").width;
    for (const line of renderLines) {
      let x = 56;
      for (const word of line) {
        ctx.fillStyle = highlighted[word] ? accent : "#ffffff";
        ctx.fillText(word, x, y);
        x += ctx.measureText(word).width + spaceWidth;
      }
      y += lineHeight;
    }

    ctx.fillStyle = accent;
    ctx.fillRect(0, CANVAS_H - bottomBarHeight, CANVAS_W, bottomBarHeight);
  }

  useEffect(() => {
    if (!open) return;
    document.fonts.ready.then(draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, accent, bgImage, highlighted, fontKey, fontSize, logoText]);

  function loadImageFile(file: File) {
    setBgLoading(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setBgImage(img);
      setBgLoading(false);
    };
    img.onerror = () => setBgLoading(false);
    img.src = url;
  }

  async function searchStock(query: string) {
    setStockLoading(true);
    setStockError(null);
    try {
      const response = await fetch(`/api/stock-photos?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Suche fehlgeschlagen.");
      setStockResults(data.photos ?? []);
    } catch (error) {
      setStockError(error instanceof Error ? error.message : "Suche fehlgeschlagen.");
    } finally {
      setStockLoading(false);
    }
  }

  async function selectStockPhoto(photo: StockPhoto) {
    setBgLoading(true);
    setStockOpen(false);
    try {
      const response = await fetch(`/api/stock-photos/image?url=${encodeURIComponent(photo.largeImageURL)}`);
      if (!response.ok) throw new Error("Bild konnte nicht geladen werden.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        setBgImage(img);
        setBgLoading(false);
      };
      img.onerror = () => setBgLoading(false);
      img.src = url;
    } catch {
      setBgLoading(false);
    }
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    await document.fonts.ready;
    draw();
    canvas.toBlob((blob) => {
      setSaving(false);
      if (!blob) return;
      const file = new File([blob], "thumbnail.png", { type: "image/png" });
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
      }
      onGenerate(URL.createObjectURL(blob));
      setOpen(false);
    }, "image/png");
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/50"
        onClick={() => handleOpenChange(true)}
      >
        <WandSparklesIcon className="size-4" />
        Thumbnail-Generator
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thumbnail erstellen</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <canvas ref={canvasRef} className="w-full rounded-lg border bg-muted" style={{ aspectRatio: "16 / 9" }} />

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">Akzentfarbe</label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.name}
                    aria-label={c.name}
                    onClick={() => setAccent(c.value)}
                    className={`size-7 rounded-full ring-offset-2 ring-offset-background transition-shadow ${
                      accent === c.value ? "ring-2 ring-foreground" : ""
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">Schriftart</label>
                <select
                  value={fontKey}
                  onChange={(e) => setFontKey(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                  Schriftgröße - {fontSize}px
                </label>
                <input
                  type="range"
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="h-8 w-full accent-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                Logo-Kürzel (oben links, leer lassen zum Ausblenden)
              </label>
              <Input
                value={logoText}
                onChange={(e) => setLogoText(e.target.value.slice(0, 4))}
                placeholder="KB"
                className="max-w-32"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">Hintergrundbild</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={bgFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadImageFile(file);
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => bgFileRef.current?.click()}>
                  <ImageIcon className="size-4" />
                  Datei auswählen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStockOpen(true);
                    if (stockResults.length === 0) searchStock(seedTitle || "business");
                  }}
                >
                  <SearchIcon className="size-4" />
                  Stock-Fotos
                </Button>
                {bgImage && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setBgImage(null)}>
                    <XIcon className="size-4" />
                    Entfernen
                  </Button>
                )}
                {bgLoading && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                Thumbnail-Titel (Enter = neue Zeile)
              </label>
              <Textarea
                rows={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titel für das Vorschaubild"
              />
            </div>

            {words.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase">
                  Hervorgehobene Wörter markieren
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {words.map((word) => (
                    <button
                      key={word}
                      type="button"
                      onClick={() => setHighlighted((prev) => ({ ...prev, [word]: !prev[word] }))}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        highlighted[word]
                          ? "border-transparent text-white"
                          : "border-input bg-transparent text-foreground hover:bg-muted"
                      }`}
                      style={highlighted[word] ? { backgroundColor: accent } : undefined}
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving || title.trim().length === 0}>
                <CheckIcon className="size-4" />
                {saving ? "Wird erstellt..." : "Verwenden"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stock-Foto auswählen</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                searchStock(stockQuery);
              }}
            >
              <Input
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                placeholder='Suchbegriff, z.B. "Büro"'
              />
              <Button type="submit" size="sm" disabled={stockLoading}>
                <SearchIcon className="size-4" />
                Suchen
              </Button>
            </form>
            {stockError && <p className="text-sm text-destructive">{stockError}</p>}
            <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {stockLoading ? (
                <div className="col-span-full flex justify-center py-8">
                  <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : stockResults.length === 0 ? (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  Keine Ergebnisse. Anderen Suchbegriff versuchen.
                </p>
              ) : (
                stockResults.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => selectStockPhoto(photo)}
                    className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted hover:border-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.webformatURL} alt={photo.tags} className="max-h-full max-w-full object-contain" />
                  </button>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">Kostenlose Bilder via Pixabay.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
