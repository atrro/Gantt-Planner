import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Trash2, RotateCcw, Wand2, Save } from "lucide-react";
import { Activity } from "@/pages/Schedule";
import { buildPdfPages, generatePDF, suggestAutoLayout, DEFAULT_PDF_LABELS, PdfLabels } from "@/lib/pdfGenerator";
import { format, differenceInDays } from "date-fns";
import { enUS } from "date-fns/locale";
import vestasLogo from "@/assets/vestas-logo.png";
import { toast } from "sonner";

interface EditableRow {
  id: string;
  activityDescription: string;
  functionalDescription: string;
  serialNumber: string;
  team: string;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
  duration: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: Activity[];
  activityName: string;
  windfarmName: string;
  useProvidedDuration?: boolean;
  onApplyChanges?: (activities: Activity[], activityName: string, windfarmName: string) => void;
}

const toInput = (d: Date) => format(d, "yyyy-MM-dd");
const fromInput = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const PdfPreviewDialog = ({
  open,
  onOpenChange,
  activities,
  activityName,
  windfarmName,
  useProvidedDuration = false,
  onApplyChanges,
}: Props) => {
  const [title, setTitle] = useState(activityName);
  const [park, setPark] = useState(windfarmName);
  const [titleText, setTitleText] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [labels, setLabels] = useState<PdfLabels>(DEFAULT_PDF_LABELS);
  const [weeksPerPage, setWeeksPerPage] = useState(8);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [excludedPages, setExcludedPages] = useState<number[]>([]);
  const [zoom, setZoom] = useState(2.5);



  useEffect(() => {
    if (!open) return;
    setTitle(activityName);
    setPark(windfarmName);
    setTitleText(`Cronograma ${activityName} - ${windfarmName}`);
    setTitleTouched(false);
    setLabels(DEFAULT_PDF_LABELS);
    setRows(
      activities.map((a) => ({
        id: a.id,
        activityDescription: a.activityDescription,
        functionalDescription: a.functionalDescription,
        serialNumber: a.serialNumber,
        team: a.team || "",
        startDate: toInput(a.startDate),
        endDate: toInput(a.endDate),
        duration: a.duration,
      }))
    );
    setExcludedPages([]);
  }, [open, activities, activityName, windfarmName]);

  // Keep the composed title in sync until the user edits it manually
  useEffect(() => {
    if (!titleTouched) setTitleText(`Cronograma ${title} - ${park}`);
  }, [title, park, titleTouched]);

  useEffect(() => {
    setExcludedPages([]);
  }, [weeksPerPage, rowsPerPage]);


  const builtActivities: Activity[] = useMemo(
    () =>
      rows.map((r, i) => ({
        id: r.id || String(i),
        serialNumber: r.serialNumber,
        functionalDescription: r.functionalDescription,
        activityDescription: r.activityDescription,
        startDate: fromInput(r.startDate),
        endDate: fromInput(r.endDate),
        includeWeekends: false,
        duration: Number(r.duration) || 1,
        predecessor: "",
        team: r.team,
      })),
    [rows]
  );

  const allPages = useMemo(
    () => buildPdfPages(builtActivities, { weeksPerPage, rowsPerPage }),
    [builtActivities, weeksPerPage, rowsPerPage]
  );

  const pages = useMemo(
    () => allPages.map((p, i) => ({ page: p, index: i })).filter(({ index }) => !excludedPages.includes(index)),
    [allPages, excludedPages]
  );

  const update = (index: number, field: keyof EditableRow, value: string) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, [field]: field === "duration" ? Number(value) : value } : r
      )
    );
  };

  const applyChanges = (silent = false) => {
    onApplyChanges?.(builtActivities, title, park);
    if (!silent) toast.success("Alterações aplicadas ao cronograma do app");
  };

  const handleExport = () => {
    applyChanges(true);
    generatePDF(builtActivities, title, park, useProvidedDuration, {
      weeksPerPage,
      rowsPerPage,
      excludedPages,
      titleOverride: titleText,
      labels,
    });
  };


  const handleAutoLayout = () => {
    const suggestion = suggestAutoLayout(builtActivities);
    setWeeksPerPage(suggestion.weeksPerPage);
    setRowsPerPage(suggestion.rowsPerPage);
    setExcludedPages([]);
  };



  // ---- preview geometry (mm, matching the PDF) ----
  const PAGE_W = 420;
  const PAGE_H = 297;
  const SCALE = zoom;
  const margin = 15;
  const contentWidth = PAGE_W - 2 * margin;
  const headerHeight = 25;
  const availableHeight = PAGE_H - 2 * margin - headerHeight - 16;
  const rowHeight = availableHeight / rowsPerPage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Pré-visualização do Cronograma</DialogTitle>
          <DialogDescription>
            Ajuste o cabeçalho, os dados e o layout antes de exportar o PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-x-3 gap-y-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Atividade</Label>
            <Input className="h-8 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Parque</Label>
            <Input className="h-8 text-sm" value={park} onChange={(e) => setPark(e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Título do cronograma</Label>
            <Input
              className="h-8 text-sm"
              value={titleText}
              placeholder="(sem título)"
              onChange={(e) => {
                setTitleTouched(true);
                setTitleText(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs whitespace-nowrap">Semanas / página</Label>
            <Select value={String(weeksPerPage)} onValueChange={(v) => setWeeksPerPage(Number(v))}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs whitespace-nowrap">Locais / página</Label>
            <Select value={String(rowsPerPage)} onValueChange={(v) => setRowsPerPage(Number(v))}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background max-h-64">
                {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="preview" className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TabsList className="w-fit h-8">
              <TabsTrigger value="preview" className="text-xs">Pré-visualização</TabsTrigger>
              <TabsTrigger value="data" className="text-xs">Editar dados</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleAutoLayout}>
                <Wand2 className="w-3.5 h-3.5" />
                Layout automático
              </Button>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Zoom</Label>
                <Select value={String(zoom)} onValueChange={(v) => setZoom(Number(v))}>
                  <SelectTrigger className="h-8 w-[80px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {[1.5, 2, 2.5, 3, 3.5, 4].map((z) => (
                      <SelectItem key={z} value={String(z)}>
                        {Math.round(z * 33)}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {excludedPages.length > 0 && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setExcludedPages([])}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar {excludedPages.length}
                </Button>
              )}
            </div>
          </div>



          <TabsContent value="preview" className="flex-1 overflow-auto bg-muted/40 rounded-md p-4">
            <div className="space-y-8">
              {pages.map(({ page, index: realIdx }, pIdx) => {
                const hasTeam = page.activities.some((a) => a.team && a.team.trim() !== "");
                const cols = {
                  seq: 15,
                  functional: 70,
                  serial: 30,
                  team: hasTeam ? 20 : 0,
                  start: 28,
                  end: 28,
                  duration: 22,
                };
                const usedWidth =
                  cols.seq + cols.functional + cols.serial + cols.team + cols.start + cols.end + cols.duration;
                const ganttWidth = contentWidth - usedWidth - 4;
                const totalDays = page.weeks.length * 7;
                // render at native pixel size (no CSS transform) for crisp text
                const s = (v: number) => v * SCALE;

                return (
                  <div key={realIdx} className="mx-auto" style={{ width: s(PAGE_W) }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-muted-foreground">Página {pIdx + 1} de {pages.length}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive gap-1"
                        onClick={() => setExcludedPages((prev) => [...prev, realIdx])}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Apagar página
                      </Button>
                    </div>

                    <div
                      className="bg-white shadow-md relative overflow-hidden"
                      style={{
                        width: s(PAGE_W),
                        height: s(PAGE_H),
                        WebkitFontSmoothing: "antialiased",
                      }}
                    >
                      {/* header */}
                      <img
                        src={vestasLogo}
                        alt="Vestas"
                        style={{ position: "absolute", left: s(margin), top: s(margin), width: s(40), height: s(18), objectFit: "contain" }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: s(margin + 4),
                          left: 0,
                          width: s(PAGE_W),
                          textAlign: "center",
                          color: "rgb(33,87,138)",
                          fontWeight: 700,
                          fontSize: s(6.5),
                        }}
                      >
                        {titleText}
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          top: s(margin + 6),
                          right: s(margin),
                          color: "rgb(100,100,100)",
                          fontSize: s(3.6),
                        }}
                      >
                        {`Page ${pIdx + 1}`}
                      </div>

                      {/* table header */}
                      <div
                        style={{
                          position: "absolute",
                          left: s(margin),
                          top: s(margin + headerHeight),
                          width: s(contentWidth),
                          height: s(16),
                          background: "rgb(33,87,138)",
                          color: "white",
                          fontSize: s(2.9),
                          fontWeight: 700,
                        }}
                      >
                        {[
                          [labels.id, cols.seq],
                          [labels.functional, cols.functional],
                          [labels.serial, cols.serial],
                          ...(hasTeam ? ([[labels.team, cols.team]] as [string, number][]) : []),
                          [labels.start, cols.start],
                          [labels.end, cols.end],
                          [labels.duration, cols.duration],
                        ].map(([label, w], i, arr) => {
                          const left = (arr.slice(0, i) as [string, number][]).reduce((sum, c) => sum + c[1], 0);
                          return (
                            <div
                              key={i}
                              style={{
                                position: "absolute",
                                left: s(left + 2),
                                top: s(6),
                                width: s((w as number) - 3),
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                              }}
                            >
                              {label as string}
                            </div>
                          );
                        })}

                        {/* calendar */}
                        {page.weekDates.map((d, i) => {
                          const weekWidth = ganttWidth / page.weeks.length;
                          return (
                            <div
                              key={i}
                              style={{
                                position: "absolute",
                                left: s(usedWidth + i * weekWidth),
                                top: s(6),
                                width: s(weekWidth),
                                height: s(10),
                                borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.6)" : "none",
                                textAlign: "center",
                                fontWeight: 400,
                                fontSize: s(2.4),
                                lineHeight: 1.15,
                              }}
                            >
                              <div>{labels.week}</div>
                              <div>{String(page.weeks[i]).padStart(2, "0")}</div>
                            </div>
                          );
                        })}
                        {/* month labels */}
                        {(() => {
                          const weekWidth = ganttWidth / page.weeks.length;
                          const segs: { label: string; start: number; end: number }[] = [];
                          page.weekDates.forEach((d, i) => {
                            const label = format(d, "MMM/yyyy");
                            const last = segs[segs.length - 1];
                            if (last && last.label === label) last.end = i + 1;
                            else segs.push({ label, start: i, end: i + 1 });
                          });
                          return segs.map((seg, i) => (
                            <div
                              key={i}
                              style={{
                                position: "absolute",
                                left: s(usedWidth + seg.start * weekWidth),
                                top: s(1.2),
                                width: s((seg.end - seg.start) * weekWidth),
                                textAlign: "center",
                                fontSize: s(2.8),
                              }}
                            >
                              {seg.label}
                            </div>
                          ));
                        })()}
                        <div
                          style={{
                            position: "absolute",
                            left: s(usedWidth),
                            top: s(6),
                            width: s(ganttWidth),
                            borderTop: "1px solid white",
                          }}
                        />
                      </div>

                      {/* rows */}
                      {page.activities.map((a, rIdx) => {
                        const top = margin + headerHeight + 16 + rIdx * rowHeight;
                        const daysFromStart = differenceInDays(a.startDate, page.windowStart);
                        const activityDays = differenceInDays(a.endDate, a.startDate) + 1;
                        const clipStart = Math.max(0, daysFromStart);
                        const clipEnd = Math.min(totalDays, daysFromStart + activityDays);
                        const durationToDisplay = useProvidedDuration
                          ? a.duration
                          : differenceInDays(a.endDate, a.startDate) + 1;
                        const cells: [string, number][] = [
                          [a.activityDescription, cols.seq],
                          [a.functionalDescription, cols.functional],
                          [a.serialNumber, cols.serial],
                          ...(hasTeam ? ([[a.team || "-", cols.team]] as [string, number][]) : []),
                          [`${format(a.startDate, "EEE", { locale: enUS })} ${format(a.startDate, "dd/MM/yyyy")}`, cols.start],
                          [`${format(a.endDate, "EEE", { locale: enUS })} ${format(a.endDate, "dd/MM/yyyy")}`, cols.end],
                          [`${durationToDisplay}d`, cols.duration],
                        ];
                        const barInset = Math.min(1.2, rowHeight * 0.15);
                        return (
                          <div
                            key={rIdx}
                            style={{
                              position: "absolute",
                              left: s(margin),
                              top: s(top),
                              width: s(contentWidth),
                              height: s(rowHeight),
                              background: rIdx % 2 === 0 ? "rgb(248,250,252)" : "transparent",
                              border: "1px solid rgb(226,232,240)",
                              color: "rgb(60,60,60)",
                              fontSize: s(2.5),
                            }}
                          >
                            {cells.map(([text, w], i) => {
                              const left = cells.slice(0, i).reduce((sum, c) => sum + c[1], 0);
                              return (
                                <div
                                  key={i}
                                  style={{
                                    position: "absolute",
                                    left: s(left + 2),
                                    top: s(rowHeight / 2 - 1.4),
                                    width: s(w - 3),
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {text}
                                </div>
                              );
                            })}
                            {clipEnd > clipStart && (
                              <div
                                style={{
                                  position: "absolute",
                                  left: s(usedWidth + (clipStart / totalDays) * ganttWidth),
                                  top: s(barInset),
                                  width: s(((clipEnd - clipStart) / totalDays) * ganttWidth),
                                  height: s(Math.max(1.2, rowHeight - barInset * 2)),
                                  background: "rgb(59,130,246)",
                                  borderRadius: s(1),
                                }}
                              />
                            )}

                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>


          <TabsContent value="data" className="flex-1 overflow-auto">
            <div className="mb-4 border rounded-md p-3">
              <div className="text-sm font-semibold mb-2">Nomes dos cabeçalhos (usados no PDF)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(
                  [
                    ["id", "ID"],
                    ["functional", "Functional location"],
                    ["serial", "Serial number"],
                    ["team", "Equipe"],
                    ["start", "Início"],
                    ["end", "Fim"],
                    ["duration", "Duração"],
                    ["week", "Week"],
                  ] as [keyof PdfLabels, string][]
                ).map(([key, hint]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{hint}</Label>
                    <Input
                      value={labels[key]}
                      onChange={(e) => setLabels((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="min-w-[900px]">

              <div className="grid grid-cols-[70px_1fr_130px_90px_140px_140px_90px] gap-2 text-xs font-semibold px-1 py-2 sticky top-0 bg-background">
                <div>ID</div>
                <div>Functional Location</div>
                <div>Serial Number</div>
                <div>Equipe</div>
                <div>Início</div>
                <div>Fim</div>
                <div>Duração</div>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[70px_1fr_130px_90px_140px_140px_90px] gap-2 px-1 py-1">
                  <Input value={r.activityDescription} onChange={(e) => update(i, "activityDescription", e.target.value)} />
                  <Input value={r.functionalDescription} onChange={(e) => update(i, "functionalDescription", e.target.value)} />
                  <Input value={r.serialNumber} onChange={(e) => update(i, "serialNumber", e.target.value)} />
                  <Input value={r.team} onChange={(e) => update(i, "team", e.target.value)} />
                  <Input type="date" value={r.startDate} onChange={(e) => update(i, "startDate", e.target.value)} />
                  <Input type="date" value={r.endDate} onChange={(e) => update(i, "endDate", e.target.value)} />
                  <Input type="number" min={1} value={r.duration} onChange={(e) => update(i, "duration", e.target.value)} />
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {onApplyChanges && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => applyChanges()}>
              <Save className="w-4 h-4" />
              Salvar alterações no app
            </Button>
          )}
          <Button size="sm" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};
