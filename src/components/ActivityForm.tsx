import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Activity } from "@/pages/Schedule";
import { differenceInBusinessDays, differenceInDays, parse, isWeekend } from "date-fns";
import { toast } from "sonner";

interface ActivityFormProps {
  onSubmit: (activities: Activity[]) => void;
  onCancel: () => void;
  parkName: string;
  holidays: Date[];
}

export const ActivityForm = ({ onSubmit, onCancel, parkName, holidays }: ActivityFormProps) => {
  const [pastedData, setPastedData] = useState("");
  const [includeWeekends, setIncludeWeekends] = useState(false);

  const calculateBusinessDays = (start: Date, end: Date): number => {
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const isHoliday = holidays.some(h => 
        h.getDate() === current.getDate() &&
        h.getMonth() === current.getMonth() &&
        h.getFullYear() === current.getFullYear()
      );
      
      if (!isWeekend(current) && !isHoliday) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  };

  const parseExcelData = (data: string): Activity[] => {
    const lines = data.trim().split('\n');
    const activities: Activity[] = [];

    lines.forEach((line, index) => {
      const columns = line.split('\t');
      
      // Expecting at least: Seq, Description, Serial, Start Date, End Date
      if (columns.length < 5) {
        return;
      }

      // Skip header line if it contains "Seq" or "Description"
      if (index === 0 && (columns[0]?.includes('Seq') || columns[1]?.includes('Description'))) {
        return;
      }

      const seq = columns[0]?.trim() || "";
      const functionalDescription = columns[1]?.trim() || "";
      const serialNumber = columns[2]?.trim() || "";
      
      // Check if team column exists (6 or more columns means team is included)
      const hasTeam = columns.length >= 6;
      const team = hasTeam ? columns[3]?.trim() : undefined;
      const startDateStr = hasTeam ? columns[4]?.trim() : columns[3]?.trim();
      const endDateStr = hasTeam ? columns[5]?.trim() : columns[4]?.trim();
      const predecessor = hasTeam ? (columns[6]?.trim() || "") : (columns[5]?.trim() || "");

      let startDate: Date;
      let endDate: Date;

      try {
        if (startDateStr.includes('/')) {
          startDate = parse(startDateStr, 'dd/MM/yyyy', new Date());
          endDate = parse(endDateStr, 'dd/MM/yyyy', new Date());
        } else if (startDateStr.includes('-')) {
          startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
          endDate = parse(endDateStr, 'yyyy-MM-dd', new Date());
        } else {
          throw new Error("Invalid date format");
        }

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error("Invalid date");
        }

        const duration = differenceInDays(endDate, startDate) + 1;

        activities.push({
          id: `${Date.now()}-${index}`,
          serialNumber,
          functionalDescription,
          activityDescription: seq, // Store seq in activityDescription for display
          startDate,
          endDate,
          includeWeekends,
          duration,
          predecessor,
          team: team || undefined,
        });
      } catch (error) {
        console.error(`Error parsing line ${index + 1}:`, line, error);
      }
    });

    return activities;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!parkName) {
      toast.error("Selecione um parque primeiro");
      return;
    }
    
    if (!pastedData.trim()) {
      toast.error("Cole os dados do Excel");
      return;
    }

    const activities = parseExcelData(pastedData);
    
    if (activities.length === 0) {
      toast.error("Nenhuma atividade válida encontrada. Verifique o formato dos dados.");
      return;
    }
    
    onSubmit(activities);
    setPastedData("");
    setIncludeWeekends(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="pastedData">Dados do Excel *</Label>
        <p className="text-sm text-muted-foreground">
          Cole os dados do Excel com as colunas: Seq | Description of functional location | Serial Number | Equipe (opcional) | Data Início | Data Fim | Predecessora (opcional)
        </p>
        <Textarea
          id="pastedData"
          value={pastedData}
          onChange={(e) => setPastedData(e.target.value)}
          placeholder="Cole aqui os dados do Excel (use Ctrl+V)&#10;&#10;Exemplo:&#10;1	XL01 - HONDA V112_3.0MW	207566	Equipe 1	23/03/2026	24/03/2026	&#10;2	XL02 - HONDA V112_3.0MW	207567	Equipe 2	23/03/2026	24/03/2026	1"
          rows={12}
          required
          className="font-mono text-sm"
        />
      </div>

      <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="weekends">Incluir finais de semana</Label>
          <p className="text-sm text-muted-foreground">
            Considerar sábado e domingo no cálculo de duração
          </p>
        </div>
        <Switch
          id="weekends"
          checked={includeWeekends}
          onCheckedChange={setIncludeWeekends}
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          Importar Atividades
        </Button>
      </div>
    </form>
  );
};
