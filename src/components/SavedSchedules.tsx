import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Download, FolderOpen, Info, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export interface SavedSchedule {
  id: string;
  name: string;
  module: string;
  park_name: string | null;
  payload: any;
  created_at: string;
  updated_at: string;
}

interface SavedSchedulesProps {
  module: "maintenance" | "vestas";
  parkName?: string;
  /** Returns the current state to be saved */
  getState: () => any;
  /** Applies a loaded state to the page */
  applyState: (payload: any) => void;
}

const storageKeyFor = (module: string) => `savedSchedules:${module}`;

const readAll = (module: string): SavedSchedule[] => {
  try {
    const raw = localStorage.getItem(storageKeyFor(module));
    return raw ? (JSON.parse(raw) as SavedSchedule[]) : [];
  } catch {
    return [];
  }
};

const writeAll = (module: string, items: SavedSchedule[]) => {
  try {
    localStorage.setItem(storageKeyFor(module), JSON.stringify(items));
    return true;
  } catch {
    toast.error("Não foi possível salvar: armazenamento do navegador cheio ou bloqueado");
    return false;
  }
};

const newId = () => crypto.randomUUID();

export const SavedSchedules = ({ module, parkName, getState, applyState }: SavedSchedulesProps) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SavedSchedule[]>([]);
  const [name, setName] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setItems(readAll(module).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  }, [open, module]);

  const persist = (next: SavedSchedule[]) => {
    if (!writeAll(module, next)) return false;
    setItems([...next].sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    return true;
  };

  const handleSave = (asNew: boolean) => {
    if (!name.trim()) {
      toast.error("Informe um nome para o cronograma");
      return;
    }
    const now = new Date().toISOString();
    const payload = getState();
    const all = readAll(module);

    if (!asNew && currentId && all.some((i) => i.id === currentId)) {
      const next = all.map((i) =>
        i.id === currentId
          ? { ...i, name: name.trim(), park_name: parkName || null, payload, updated_at: now }
          : i,
      );
      if (persist(next)) toast.success("Cronograma atualizado");
    } else {
      const item: SavedSchedule = {
        id: newId(),
        name: name.trim(),
        module,
        park_name: parkName || null,
        payload,
        created_at: now,
        updated_at: now,
      };
      if (persist([item, ...all])) {
        setCurrentId(item.id);
        toast.success("Cronograma salvo neste navegador");
      }
    }
  };

  const handleLoad = (item: SavedSchedule) => {
    applyState(item.payload);
    setCurrentId(item.id);
    setName(item.name);
    setOpen(false);
    toast.success(`Cronograma "${item.name}" carregado`);
  };

  const handleDuplicate = (item: SavedSchedule) => {
    const now = new Date().toISOString();
    const copy = { ...item, id: newId(), name: `${item.name} (cópia)`, created_at: now, updated_at: now };
    if (persist([copy, ...readAll(module)])) toast.success("Cronograma duplicado");
  };

  const handleDelete = (item: SavedSchedule) => {
    if (persist(readAll(module).filter((i) => i.id !== item.id))) {
      if (currentId === item.id) setCurrentId(null);
      toast.success("Cronograma excluído");
    }
  };

  const handleExport = (item: SavedSchedule) => {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.name.replace(/[^\w\-]+/g, "_")}.cronograma.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const imported: SavedSchedule[] = [];
    for (const file of files) {
      try {
        const data = JSON.parse(await file.text());
        if (!data || typeof data.name !== "string" || data.payload === undefined) throw new Error();
        if (data.module !== module) {
          toast.error(`"${file.name}" pertence a outro módulo e não foi importado`);
          continue;
        }
        const now = new Date().toISOString();
        imported.push({
          id: newId(),
          name: data.name,
          module,
          park_name: data.park_name ?? null,
          payload: data.payload,
          created_at: now,
          updated_at: now,
        });
      } catch {
        toast.error(`"${file.name}" não é um cronograma válido`);
      }
    }
    if (imported.length && persist([...imported, ...readAll(module)])) {
      toast.success(`${imported.length} cronograma(s) importado(s)`);
    }
  };

  const handleQuickSave = () => {
    if (!name.trim()) {
      setName([parkName, format(new Date(), "dd/MM/yyyy HH:mm")].filter(Boolean).join(" - "));
    }
    setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FolderOpen className="w-4 h-4" />
                Cronogramas Salvos
                <Info className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Salvos neste navegador. Use Exportar para compartilhar.</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="default" className="gap-2" onClick={handleQuickSave}>
        <Save className="w-4 h-4" />
        Salvar
      </Button>
      <DialogContent className="max-w-2xl bg-background">
        <DialogHeader>
          <DialogTitle>Cronogramas Salvos</DialogTitle>
          <DialogDescription>
            Ficam guardados apenas neste navegador. Para levar a outro computador ou enviar a um colega,
            exporte o arquivo e importe no destino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="saved-name">Nome do cronograma</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="saved-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Service 1Y - Jerusalém 2026"
            />
            <div className="flex gap-2">
              <Button onClick={() => handleSave(!currentId)} className="gap-2">
                <Save className="w-4 h-4" />
                {currentId ? "Atualizar" : "Salvar"}
              </Button>
              {currentId && (
                <Button variant="outline" onClick={() => handleSave(true)}>
                  Salvar como novo
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInput.current?.click()}>
            <Upload className="w-4 h-4" />
            Importar arquivo
          </Button>
        </div>

        <div className="border-t pt-4 max-h-[45vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum cronograma salvo ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.park_name ? `${item.park_name} • ` : ""}
                      Atualizado em {format(new Date(item.updated_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleLoad(item)} className="gap-1">
                      <FolderOpen className="w-4 h-4" />
                      Abrir
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => handleExport(item)} title="Exportar arquivo">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => handleDuplicate(item)} title="Duplicar">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => handleDelete(item)} title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
