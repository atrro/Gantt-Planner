import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Download, Copy, List, Plus, Trash2, Calendar, FileText, Eraser } from "lucide-react";
import { toast } from "sonner";
import { PARK_NAMES, getSerialsByPark, getHolidaysByPark, SerialData } from "@/data/parksData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, addDays, parse } from "date-fns";
import * as XLSX from 'xlsx';
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { Activity } from "@/pages/Schedule";
import { SavedSchedules } from "@/components/SavedSchedules";


interface EditableHoliday {
  date: Date;
  description: string;
}

interface SequencedSerial extends SerialData {
  sequence: number;
}

interface ScheduleEntry {
  seq: number;
  functionalLocation: string;
  serialNumber: string;
  team: string;
  startDate: string;
  endDate: string;
  duration: number;
}

interface ServicePeriod {
  id: number;
  serviceDescription: string;
  teamCount: number;
  duration: number;
  startDate: string;
}

const MaintenanceAnalysis = () => {
  const navigate = useNavigate();
  const [parkName, setParkName] = useState("");
  const [usePeriods, setUsePeriods] = useState(false);
  const [periods, setPeriods] = useState<ServicePeriod[]>([
    { id: 1, serviceDescription: "", teamCount: 1, duration: 1, startDate: "" }
  ]);
  const [includeSaturdays, setIncludeSaturdays] = useState(false);
  const [includeSundays, setIncludeSundays] = useState(false);
  const [includeHolidays, setIncludeHolidays] = useState(false);
  const [serials, setSerials] = useState<SequencedSerial[]>([]);
  const [holidays, setHolidays] = useState<Date[]>([]);
  const [editableHolidays, setEditableHolidays] = useState<EditableHoliday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayDescription, setNewHolidayDescription] = useState("");
  const [showSerials, setShowSerials] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewActivities, setPreviewActivities] = useState<Activity[]>([]);
  const [previewTitle, setPreviewTitle] = useState("");

  const storageKey = "maintenanceAnalysisState";

  useEffect(() => {
    // Load persisted state
    const savedState = localStorage.getItem(storageKey);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.parkName) setParkName(state.parkName);
        if (state.usePeriods !== undefined) setUsePeriods(state.usePeriods);
        if (state.periods) setPeriods(state.periods);
        if (state.includeSaturdays !== undefined) setIncludeSaturdays(state.includeSaturdays);
        if (state.includeSundays !== undefined) setIncludeSundays(state.includeSundays);
        if (state.includeHolidays !== undefined) setIncludeHolidays(state.includeHolidays);
        if (state.serials) setSerials(state.serials);
        if (state.editableHolidays) {
          // Convert date strings back to Date objects
          const holidays = state.editableHolidays.map((h: any) => ({
            ...h,
            date: new Date(h.date)
          }));
          setEditableHolidays(holidays);
        }
        if (state.showSerials !== undefined) setShowSerials(state.showSerials);
        if (state.schedule) setSchedule(state.schedule);

        // Reconcile cached serials/functional locations with the latest park data
        if (state.parkName) {
          (async () => {
            try {
              const latest = await getSerialsByPark(state.parkName);
              if (!latest || latest.length === 0) return;
              const savedSerials: SequencedSerial[] = state.serials || [];
              const latestBySerial = new Map(latest.map((s: any) => [String(s.serialNumber), s]));
              const sameSet =
                savedSerials.length === latest.length &&
                savedSerials.every((s) => latestBySerial.has(String(s.serialNumber)));

              if (sameSet) {
                // Only refresh functional locations, keep sequencing
                const needsUpdate = savedSerials.some(
                  (s) => latestBySerial.get(String(s.serialNumber))?.functionalLocation !== s.functionalLocation
                );
                if (needsUpdate) {
                  const updated = savedSerials.map((s) => ({
                    ...s,
                    functionalLocation:
                      latestBySerial.get(String(s.serialNumber))?.functionalLocation ?? s.functionalLocation,
                  }));
                  setSerials(updated);
                  setSchedule((prev) =>
                    prev.map((e: any) => ({
                      ...e,
                      functionalLocation:
                        latestBySerial.get(String(e.serialNumber))?.functionalLocation ?? e.functionalLocation,
                    }))
                  );
                }
              } else {
                // Serial list itself changed: reload from source
                setSerials(latest.map((s: any) => ({ ...s, sequence: 0 })));
                setShowSerials(false);
                setSchedule([]);
              }
            } catch (e) {
              console.error("Error syncing park data:", e);
            }
          })();
        }
      } catch (error) {
        console.error("Error loading saved state:", error);
      }
    }
  }, [storageKey]);


  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (!storageKey) return;
    const state = {
      parkName,
      usePeriods,
      periods,
      includeSaturdays,
      includeSundays,
      includeHolidays,
      serials,
      editableHolidays,
      showSerials,
      schedule
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [storageKey, parkName, usePeriods, periods, includeSaturdays, includeSundays, includeHolidays, serials, editableHolidays, showSerials, schedule]);

  const handleParkSelect = async (value: string) => {
    setParkName(value);
    const parkSerials = await getSerialsByPark(value);
    const parkHolidays = getHolidaysByPark(value);
    
    setSerials(parkSerials.map((s, idx) => ({ ...s, sequence: 0 })));
    setHolidays(parkHolidays);
    
    // Initialize editable holidays with descriptions
    const holidaysWithDescriptions = parkHolidays.map(date => ({
      date,
      description: getHolidayDescription(format(date, 'dd/MM/yyyy'))
    }));
    setEditableHolidays(holidaysWithDescriptions);
    
    setShowSerials(false);
    setSchedule([]);
  };

  const validateDate = (dateStr: string): boolean => {
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateStr.match(dateRegex);
    
    if (!match) return false;
    
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 2000 || year > 2100) return false;
    
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
  };

  const addPeriod = () => {
    if (periods.length >= 3) {
      toast.error("Máximo de 3 períodos permitido");
      return;
    }

    const lastPeriod = periods[periods.length - 1];
    let suggestedStartDate = "";

    if (lastPeriod.startDate && validateDate(lastPeriod.startDate)) {
      const [day, month, year] = lastPeriod.startDate.split('/').map(Number);
      const lastStartDate = new Date(year, month - 1, day);
      const lastEndDate = calculateWorkingDays(lastStartDate, lastPeriod.duration);
      const nextWorkingDay = getNextWorkingDay(lastEndDate);
      suggestedStartDate = format(nextWorkingDay, 'dd/MM/yyyy');
    }

    setPeriods([...periods, { 
      id: periods.length + 1, 
      serviceDescription: "", 
      teamCount: 1, 
      duration: 1,
      startDate: suggestedStartDate
    }]);
  };

  const removePeriod = (id: number) => {
    if (periods.length === 1) {
      toast.error("Deve haver pelo menos um período");
      return;
    }
    setPeriods(periods.filter(p => p.id !== id));
  };

  const updatePeriod = (id: number, field: keyof ServicePeriod, value: any) => {
    setPeriods(periods.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const getNextWorkingDay = (date: Date): Date => {
    let nextDay = addDays(date, 1);
    
    while (!isWorkingDay(nextDay)) {
      nextDay = addDays(nextDay, 1);
    }
    
    return nextDay;
  };

  const findFirstWorkingDay = (date: Date): Date => {
    let currentDay = new Date(date);
    
    while (!isWorkingDay(currentDay)) {
      currentDay = addDays(currentDay, 1);
    }
    
    return currentDay;
  };

  const handleGenerateSerials = () => {
    if (!parkName) {
      toast.error("Selecione um parque");
      return;
    }

    if (usePeriods) {
      for (const period of periods) {
        if (!period.serviceDescription || !period.startDate || !period.teamCount || !period.duration) {
          toast.error(`Preencha todos os campos do período ${period.id}`);
          return;
        }
        if (period.duration < 0.5 || !Number.isInteger(period.duration * 2)) {
          toast.error(`A duração do período ${period.id} deve usar intervalos de 0,5 dia`);
          return;
        }
        if (!validateDate(period.startDate)) {
          toast.error(`Data inválida no período ${period.id}. Use o formato dd/mm/yyyy`);
          return;
        }
      }
    } else {
      const period = periods[0];
      if (!period.serviceDescription || !period.startDate || !period.teamCount || !period.duration) {
        toast.error("Preencha todos os campos");
        return;
      }
      if (period.duration < 0.5 || !Number.isInteger(period.duration * 2)) {
        toast.error("A duração deve usar intervalos de 0,5 dia");
        return;
      }
      if (!validateDate(period.startDate)) {
        toast.error("Data inválida. Use o formato dd/mm/yyyy (ex: 23/03/2026)");
        return;
      }
    }

    setShowSerials(true);
    toast.success("Tabela de seriais gerada");
  };

  const handleAutoSequence = () => {
    setSerials(prev => prev.map((s, idx) => ({ ...s, sequence: idx + 1 })));
    toast.success("Sequência preenchida automaticamente");
  };

  const handleSequenceChange = (index: number, value: string) => {
    const newSerials = [...serials];
    newSerials[index].sequence = parseInt(value) || 0;
    setSerials(newSerials);
  };

  const handlePasteSequence = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.trim().split('\n');
      
      // Parse the pasted data
      const pastedData: { sequence: number; serial: string }[] = [];
      
      for (const line of lines) {
        const parts = line.split('\t').map(s => s.trim());
        if (parts.length >= 2) {
          const sequence = parseInt(parts[0]);
          const serial = parts[1];
          if (!isNaN(sequence) && serial) {
            pastedData.push({ sequence, serial });
          }
        }
      }
      
      if (pastedData.length === 0) {
        toast.error("Nenhum dado válido encontrado. Use o formato: Sequencia Serial (separados por tab)");
        return;
      }
      
      // Update serials with pasted sequences
      const newSerials = [...serials];
      let matchCount = 0;
      
      for (const pasted of pastedData) {
        const index = newSerials.findIndex(s => s.serialNumber === pasted.serial);
        if (index !== -1) {
          newSerials[index].sequence = pasted.sequence;
          matchCount++;
        }
      }
      
      setSerials(newSerials);
      toast.success(`${matchCount} seriais sequenciados a partir dos dados colados`);
    } catch (error) {
      toast.error("Erro ao colar dados. Certifique-se de copiar os dados do Excel.");
    }
  };

  const isWorkingDay = (date: Date): boolean => {
    const isHoliday = editableHolidays.some(h => 
      h.date.getDate() === date.getDate() &&
      h.date.getMonth() === date.getMonth() &&
      h.date.getFullYear() === date.getFullYear()
    );
    
    const isSaturday = date.getDay() === 6;
    const isSunday = date.getDay() === 0;
    
    const skipDay = 
      (!includeSaturdays && isSaturday) ||
      (!includeSundays && isSunday) ||
      (!includeHolidays && isHoliday);
    
    return !skipDay;
  };

  const calculateWorkingDays = (start: Date, duration: number): Date => {
    let currentDate = new Date(start);
    let daysAdded = 1; // Start counting from 1 since the start date is day 1

    while (daysAdded < duration) {
      currentDate = addDays(currentDate, 1);
      if (isWorkingDay(currentDate)) {
        daysAdded++;
      }
    }

    return currentDate;
  };

  const getWorkingDateForHalfDaySlot = (start: Date, slotOffset: number): Date => {
    let currentDate = findFirstWorkingDay(start);
    let remainingSlots = slotOffset;

    while (remainingSlots >= 2) {
      currentDate = getNextWorkingDay(currentDate);
      remainingSlots -= 2;
    }

    return currentDate;
  };

  const calculateServiceWindow = (periodStart: Date, duration: number, roundIndex: number) => {
    const slotsPerService = Math.round(duration * 2);
    const startSlot = roundIndex * slotsPerService;
    const endSlot = startSlot + slotsPerService - 1;

    return {
      startDate: getWorkingDateForHalfDaySlot(periodStart, startSlot),
      endDate: getWorkingDateForHalfDaySlot(periodStart, endSlot),
    };
  };

  const handleGenerateSchedule = () => {
    const sequencedSerials = serials
      .filter(s => s.sequence > 0)
      .sort((a, b) => a.sequence - b.sequence);

    if (sequencedSerials.length === 0) {
      toast.error("Preencha a sequência de pelo menos um serial");
      return;
    }

    const newSchedule: ScheduleEntry[] = [];
    let currentSerialIndex = 0;

    // If not using periods, use single period logic
    if (!usePeriods || periods.length === 1) {
      const period = periods[0];
      if (!period.startDate || !validateDate(period.startDate)) {
        toast.error("Data de início inválida");
        return;
      }

      const [day, month, year] = period.startDate.split('/').map(Number);
      const periodStartDate = new Date(year, month - 1, day);
      const teamsArray = Array.from({ length: period.teamCount }, (_, i) => `T${i + 1}`);
      let roundIndex = 0;

      while (currentSerialIndex < sequencedSerials.length) {
        const serviceWindow = calculateServiceWindow(periodStartDate, period.duration, roundIndex);
        for (let teamIdx = 0; teamIdx < teamsArray.length; teamIdx++) {
          if (currentSerialIndex >= sequencedSerials.length) break;

          const serial = sequencedSerials[currentSerialIndex];
          const teamName = teamsArray[teamIdx];
          
          const entryStartDate = serviceWindow.startDate;
          const entryEndDate = serviceWindow.endDate;

          newSchedule.push({
            seq: serial.sequence,
            functionalLocation: serial.functionalLocation,
            serialNumber: serial.serialNumber,
            team: teamName,
            startDate: format(entryStartDate, 'dd/MM/yyyy'),
            endDate: format(entryEndDate, 'dd/MM/yyyy'),
            duration: period.duration,
          });

          currentSerialIndex++;
        }

        roundIndex++;
      }
    } else {
      // Multiple periods logic
      for (let periodIdx = 0; periodIdx < periods.length && currentSerialIndex < sequencedSerials.length; periodIdx++) {
        const period = periods[periodIdx];
        if (!period.startDate || !validateDate(period.startDate)) continue;

        const [day, month, year] = period.startDate.split('/').map(Number);
        const periodStartDate = new Date(year, month - 1, day);
        const teamsArray = Array.from({ length: period.teamCount }, (_, i) => `T${i + 1}`);
        let roundIndex = 0;

        // Get next period start date to know when to stop
        let nextPeriodStartDate: Date | null = null;
        if (periodIdx < periods.length - 1) {
          const nextPeriod = periods[periodIdx + 1];
          if (nextPeriod.startDate && validateDate(nextPeriod.startDate)) {
            const [nDay, nMonth, nYear] = nextPeriod.startDate.split('/').map(Number);
            nextPeriodStartDate = new Date(nYear, nMonth - 1, nDay);
          }
        }

        // Process serials for this period until we reach the next period's start date
        while (currentSerialIndex < sequencedSerials.length) {
          const serviceWindow = calculateServiceWindow(periodStartDate, period.duration, roundIndex);
          // Check if we've reached the next period's start date
          if (nextPeriodStartDate && serviceWindow.startDate >= nextPeriodStartDate) {
            break;
          }

          // Assign serials to all teams for the current round
          for (let teamIdx = 0; teamIdx < teamsArray.length; teamIdx++) {
            if (currentSerialIndex >= sequencedSerials.length) break;

            const serial = sequencedSerials[currentSerialIndex];
            const teamName = teamsArray[teamIdx];
            
            const entryStartDate = serviceWindow.startDate;
            const entryEndDate = serviceWindow.endDate;

            newSchedule.push({
              seq: serial.sequence,
              functionalLocation: serial.functionalLocation,
              serialNumber: serial.serialNumber,
              team: teamName,
              startDate: format(entryStartDate, 'dd/MM/yyyy'),
              endDate: format(entryEndDate, 'dd/MM/yyyy'),
              duration: period.duration,
            });

            currentSerialIndex++;
          }

          roundIndex++;

          // Check again after moving to next date
          const nextWindow = calculateServiceWindow(periodStartDate, period.duration, roundIndex);
          if (nextPeriodStartDate && nextWindow.startDate >= nextPeriodStartDate) {
            break;
          }
        }
      }
    }

    setSchedule(newSchedule);
    toast.success(`Cronograma gerado com ${newSchedule.length} entradas`);
  };

  const handleCopySchedule = () => {
    if (schedule.length === 0) {
      toast.error("Gere o cronograma primeiro");
      return;
    }

    const header = "Seq\tFunctional Location\tSerial Number\tEquipe\tData Início\tData Fim\n";
    const rows = schedule.map(entry => 
      `${entry.seq}\t${entry.functionalLocation}\t${entry.serialNumber}\t${entry.team}\t${entry.startDate}\t${entry.endDate}`
    ).join('\n');

    navigator.clipboard.writeText(header + rows);
    toast.success("Cronograma copiado para a área de transferência");
  };

  const getHolidayDescription = (dateStr: string): string => {
    const holidayMap: { [key: string]: string } = {
      '01/01': 'Confraternização Universal',
      '02/01': 'Feriado Municipal',
      '16/02': 'Carnaval',
      '17/02': 'Carnaval',
      '20/03': 'Feriado Municipal',
      '25/03': 'Feriado Municipal',
      '27/03': 'Feriado Municipal',
      '06/03': 'Feriado Municipal',
      '02/04': 'Feriado Municipal',
      '03/04': 'Paixão de Cristo',
      '05/04': 'Feriado Municipal',
      '20/04': 'Páscoa',
      '21/04': 'Tiradentes',
      '27/04': 'Feriado Municipal',
      '01/05': 'Dia do Trabalhador',
      '03/05': 'Feriado Municipal',
      '08/05': 'Feriado Municipal',
      '15/05': 'Feriado Municipal',
      '05/06': 'Feriado Municipal',
      '08/06': 'Feriado Municipal',
      '09/06': 'Feriado Municipal',
      '13/06': 'Feriado Municipal',
      '19/06': 'Feriado Municipal',
      '24/06': 'São João',
      '26/06': 'Feriado Municipal',
      '27/06': 'Feriado Municipal',
      '29/06': 'Feriado Municipal',
      '02/07': 'Independência da Bahia',
      '03/07': 'Feriado Municipal',
      '06/07': 'Feriado Municipal',
      '09/07': 'Feriado Municipal',
      '11/07': 'Feriado Municipal',
      '12/07': 'Feriado Municipal',
      '17/07': 'Feriado Municipal',
      '25/07': 'Feriado Municipal',
      '26/07': 'Feriado Municipal',
      '28/07': 'Feriado Municipal',
      '31/07': 'Feriado Municipal',
      '07/08': 'Feriado Municipal',
      '08/08': 'Feriado Municipal',
      '15/08': 'Feriado Municipal',
      '21/08': 'Feriado Municipal',
      '28/08': 'Feriado Municipal',
      '05/09': 'Feriado Municipal',
      '07/09': 'Independência do Brasil',
      '08/09': 'Feriado Municipal',
      '11/09': 'Feriado Municipal',
      '17/09': 'Feriado Municipal',
      '20/09': 'Feriado Municipal',
      '25/09': 'Feriado Municipal',
      '28/09': 'Feriado Municipal',
      '03/10': 'Feriado Municipal',
      '04/10': 'Feriado Municipal',
      '12/10': 'Nossa Senhora Aparecida',
      '16/10': 'Feriado Municipal',
      '19/10': 'Feriado Municipal',
      '23/10': 'Feriado Municipal',
      '30/10': 'Feriado Municipal',
      '31/10': 'Feriado Municipal',
      '02/11': 'Finados',
      '08/11': 'Feriado Municipal',
      '15/11': 'Proclamação da República',
      '19/11': 'Feriado Municipal',
      '20/11': 'Consciência Negra',
      '22/11': 'Feriado Municipal',
      '25/11': 'Feriado Municipal',
      '27/11': 'Feriado Municipal',
      '28/11': 'Feriado Municipal',
      '04/12': 'Feriado Municipal',
      '07/12': 'Feriado Municipal',
      '11/12': 'Feriado Municipal',
      '20/12': 'Feriado Municipal',
      '25/12': 'Natal',
      '27/12': 'Feriado Municipal',
      '30/12': 'Feriado Municipal',
      '31/12': 'Feriado Municipal'
    };

    const dayMonth = dateStr.substring(0, 5);
    return holidayMap[dayMonth] || 'Feriado';
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate) {
      toast.error("Informe a data do feriado");
      return;
    }
    if (!validateDate(newHolidayDate)) {
      toast.error("Data inválida. Use o formato dd/mm/yyyy");
      return;
    }
    if (!newHolidayDescription) {
      toast.error("Informe a descrição do feriado");
      return;
    }

    const [day, month, year] = newHolidayDate.split('/').map(Number);
    const newDate = new Date(year, month - 1, day);

    // Check if holiday already exists
    const exists = editableHolidays.some(h =>
      h.date.getDate() === newDate.getDate() &&
      h.date.getMonth() === newDate.getMonth() &&
      h.date.getFullYear() === newDate.getFullYear()
    );

    if (exists) {
      toast.error("Este feriado já existe");
      return;
    }

    setEditableHolidays([...editableHolidays, { date: newDate, description: newHolidayDescription }]);
    setNewHolidayDate("");
    setNewHolidayDescription("");
    toast.success("Feriado adicionado");
  };

  const handleDeleteHoliday = (index: number) => {
    setEditableHolidays(editableHolidays.filter((_, i) => i !== index));
    toast.success("Feriado removido");
  };

  const getCloudState = () => ({
    parkName,
    usePeriods,
    periods,
    includeSaturdays,
    includeSundays,
    includeHolidays,
    serials,
    editableHolidays: editableHolidays.map(h => ({ ...h, date: h.date.toISOString() })),
    showSerials,
    schedule,
  });

  const applyCloudState = (state: any) => {
    if (!state) return;
    setParkName(state.parkName || "");
    setUsePeriods(!!state.usePeriods);
    setPeriods(state.periods || [{ id: 1, serviceDescription: "", teamCount: 1, duration: 1, startDate: "" }]);
    setIncludeSaturdays(!!state.includeSaturdays);
    setIncludeSundays(!!state.includeSundays);
    setIncludeHolidays(!!state.includeHolidays);
    setSerials(state.serials || []);
    const loadedHolidays = (state.editableHolidays || []).map((h: any) => ({ ...h, date: new Date(h.date) }));
    setEditableHolidays(loadedHolidays);
    setHolidays(loadedHolidays.map((h: EditableHoliday) => h.date));
    setShowSerials(!!state.showSerials);
    setSchedule(state.schedule || []);
  };

  const handleClearData = () => {

    setParkName("");
    setUsePeriods(false);
    setPeriods([{ id: 1, serviceDescription: "", teamCount: 1, duration: 1, startDate: "" }]);
    setIncludeSaturdays(false);
    setIncludeSundays(false);
    setIncludeHolidays(false);
    setSerials([]);
    setHolidays([]);
    setEditableHolidays([]);
    setNewHolidayDate("");
    setNewHolidayDescription("");
    setShowSerials(false);
    setSchedule([]);
    if (storageKey) localStorage.removeItem(storageKey);
    toast.success("Dados limpos com sucesso");
  };

  const handleGeneratePDF = () => {
    if (schedule.length === 0) {
      toast.error("Gere o cronograma primeiro");
      return;
    }

    if (!parkName) {
      toast.error("Selecione um parque");
      return;
    }

    // Get service description from periods or use a default
    const activityName = usePeriods && periods[0]?.serviceDescription 
      ? periods[0].serviceDescription 
      : "Manutenção";

    // Convert schedule to activities format for PDF
    const activities: Activity[] = schedule.map((entry) => {
      // Parse dates from string format (dd/MM/yyyy)
      const parseDate = (dateStr: string) => {
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
      };

      const startDate = parseDate(entry.startDate);
      const endDate = parseDate(entry.endDate);

      return {
        id: entry.seq.toString(),
        serialNumber: entry.serialNumber,
        functionalDescription: entry.functionalLocation,
        activityDescription: entry.seq.toString(),
        startDate,
        endDate,
        includeWeekends: includeSaturdays || includeSundays,
        duration: entry.duration,
        predecessor: "",
        team: entry.team
      };
    });

    setPreviewActivities(activities);
    setPreviewTitle(activityName);
    setShowPreview(true);
  };

  const handleExportToExcel = () => {
    if (schedule.length === 0) {
      toast.error("Gere o cronograma primeiro");
      return;
    }

    // Prepare data for Cronograma sheet
    const worksheetData = [
      ['Seq', 'Functional Location', 'Serial Number', 'Equipe', 'Data Início', 'Data Fim', 'Duration (Days)'],
      ...schedule.map(entry => [
        entry.seq,
        entry.functionalLocation,
        entry.serialNumber,
        entry.team,
        entry.startDate,
        entry.endDate,
        `${entry.duration}d`
      ])
    ];

    // Prepare data for Feriados sheet using editable holidays
    const holidaysData = [
      ['Parque', 'Data Feriado', 'Descrição Feriado'],
      ...editableHolidays.map(holiday => {
        const dateStr = format(holiday.date, 'dd/MM/yyyy');
        return [
          parkName,
          dateStr,
          holiday.description
        ];
      }).sort((a, b) => {
        const [dayA, monthA] = a[1].split('/');
        const [dayB, monthB] = b[1].split('/');
        const dateA = new Date(2026, parseInt(monthA) - 1, parseInt(dayA));
        const dateB = new Date(2026, parseInt(monthB) - 1, parseInt(dayB));
        return dateA.getTime() - dateB.getTime();
      })
    ];

    // Create workbook and worksheets
    const cronogramaSheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const feriadosSheet = XLSX.utils.aoa_to_sheet(holidaysData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, cronogramaSheet, 'Cronograma');
    XLSX.utils.book_append_sheet(workbook, feriadosSheet, 'Feriados');

    // Generate Excel file and download
    XLSX.writeFile(workbook, `cronograma_${parkName}_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    
    toast.success("Arquivo Excel exportado com sucesso");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-vestas-blue-light">
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Análise da Manutenção</h1>
            <p className="text-muted-foreground">Planejamento e sequenciamento de serviços</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Parâmetros do Serviço</CardTitle>
              <CardDescription>
                Defina os parâmetros básicos para o planejamento da manutenção
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="park">Nome do Parque *</Label>
                  <Select onValueChange={handleParkSelect} value={parkName}>
                    <SelectTrigger id="park">
                      <SelectValue placeholder="Selecione o parque" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {PARK_NAMES.map((park) => (
                        <SelectItem key={park} value={park}>
                          {park}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ações</Label>
                  <div className="flex items-start gap-2 flex-wrap">
                    <Button 
                      onClick={handleClearData} 
                      variant="outline" 
                      size="default"
                      disabled={!parkName}
                    >
                      <Eraser className="w-4 h-4 mr-2" />
                      Limpar Dados
                    </Button>
                    <SavedSchedules
                      module="maintenance"
                      parkName={parkName}
                      getState={getCloudState}
                      applyState={applyCloudState}
                    />
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dividir em Períodos?</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="usePeriods"
                      checked={usePeriods}
                      onCheckedChange={setUsePeriods}
                    />
                    <Label htmlFor="usePeriods" className="cursor-pointer">
                      {usePeriods ? "Sim, dividir em múltiplos períodos" : "Não, usar período único"}
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Dias de Trabalho</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeSaturdays"
                      checked={includeSaturdays}
                      onCheckedChange={setIncludeSaturdays}
                    />
                    <Label htmlFor="includeSaturdays" className="cursor-pointer">
                      Trabalhar aos sábados
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeSundays"
                      checked={includeSundays}
                      onCheckedChange={setIncludeSundays}
                    />
                    <Label htmlFor="includeSundays" className="cursor-pointer">
                      Trabalhar aos domingos
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeHolidays"
                      checked={includeHolidays}
                      onCheckedChange={setIncludeHolidays}
                    />
                    <Label htmlFor="includeHolidays" className="cursor-pointer">
                      Trabalhar em feriados
                    </Label>
                  </div>
                </div>
              </div>

              {periods.map((period) => (
                <Card key={period.id} className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">
                      {usePeriods ? `Período ${period.id}` : "Dados do Service"}
                    </h3>
                    {usePeriods && periods.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePeriod(period.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`service-${period.id}`}>Descrição do Service *</Label>
                      <Input
                        id={`service-${period.id}`}
                        value={period.serviceDescription}
                        onChange={(e) => updatePeriod(period.id, 'serviceDescription', e.target.value)}
                        placeholder="Ex: Manutenção Preventiva Anual"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`startDate-${period.id}`}>Data de Início (dd/mm/yyyy) *</Label>
                      <Input
                        id={`startDate-${period.id}`}
                        value={period.startDate}
                        onChange={(e) => updatePeriod(period.id, 'startDate', e.target.value)}
                        placeholder="23/03/2026"
                        maxLength={10}
                      />
                      {period.startDate && !validateDate(period.startDate) && (
                        <p className="text-sm text-destructive">
                          Formato inválido. Use dd/mm/yyyy
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`teams-${period.id}`}>Quantidade de Equipes *</Label>
                      <Input
                        id={`teams-${period.id}`}
                        type="number"
                        min="1"
                        value={period.teamCount}
                        onChange={(e) => updatePeriod(period.id, 'teamCount', parseInt(e.target.value) || 1)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`duration-${period.id}`}>Duração em Dias do Service *</Label>
                      <Input
                        id={`duration-${period.id}`}
                        type="number"
                         min="0.5"
                         step="0.5"
                        value={period.duration}
                         onChange={(e) => updatePeriod(period.id, 'duration', parseFloat(e.target.value) || 0.5)}
                      />
                    </div>
                  </div>
                </Card>
              ))}

              {usePeriods && periods.length < 3 && (
                <Button onClick={addPeriod} variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Período ({periods.length}/3)
                </Button>
              )}

              <Button onClick={handleGenerateSerials} className="w-full" size="lg">
                <List className="w-5 h-5 mr-2" />
                Gerar Tabela de Sequenciamento
              </Button>
            </CardContent>
          </Card>

          {parkName && editableHolidays.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Gerenciar Feriados
                </CardTitle>
                <CardDescription>
                  Visualize, edite ou adicione feriados. Feriados são considerados dias não úteis no cronograma.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-16">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editableHolidays
                        .sort((a, b) => a.date.getTime() - b.date.getTime())
                        .map((holiday, index) => (
                          <TableRow key={index}>
                            <TableCell>{format(holiday.date, 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{holiday.description}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteHoliday(index)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Adicionar Novo Feriado</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="newHolidayDate">Data (dd/mm/yyyy)</Label>
                      <Input
                        id="newHolidayDate"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        placeholder="01/01/2026"
                        maxLength={10}
                      />
                      {newHolidayDate && !validateDate(newHolidayDate) && (
                        <p className="text-sm text-destructive">Formato inválido</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newHolidayDescription">Descrição</Label>
                      <Input
                        id="newHolidayDescription"
                        value={newHolidayDescription}
                        onChange={(e) => setNewHolidayDescription(e.target.value)}
                        placeholder="Exemplo: Aniversário da Cidade"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleAddHoliday} className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {showSerials && (
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sequenciamento de Seriais</CardTitle>
                    <CardDescription>
                      Defina a ordem de execução dos seriais (0 = não executar). Você pode colar dados do Excel (Ctrl+V).
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handlePasteSequence} variant="outline">
                      Colar do Excel
                    </Button>
                    <Button onClick={handleAutoSequence} variant="outline">
                      Preencher Automaticamente
                    </Button>
                    <Button onClick={handleGenerateSchedule} variant="default">
                      Gerar Cronograma
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Sequência</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Functional Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serials.map((serial, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={serial.sequence}
                              onChange={(e) => handleSequenceChange(index, e.target.value)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell className="font-mono">{serial.serialNumber}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {serial.functionalLocation}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {schedule.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Cronograma Gerado</CardTitle>
                    <CardDescription>
                      {schedule.length} entradas no cronograma
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCopySchedule} variant="outline">
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar
                    </Button>
                    <Button onClick={handleGeneratePDF} variant="outline">
                      <FileText className="w-4 h-4 mr-2" />
                      Gerar PDF
                    </Button>
                    <Button onClick={handleExportToExcel} variant="default">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Seq</TableHead>
                        <TableHead>Functional Location</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead>Data Início</TableHead>
                        <TableHead>Data Fim</TableHead>
                        <TableHead>Duration (Days)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.map((entry, index) => (
                        <TableRow key={index}>
                          <TableCell>{entry.seq}</TableCell>
                          <TableCell className="text-sm">{entry.functionalLocation}</TableCell>
                          <TableCell className="font-mono">{entry.serialNumber}</TableCell>
                          <TableCell>{entry.team}</TableCell>
                          <TableCell>{entry.startDate}</TableCell>
                          <TableCell>{entry.endDate}</TableCell>
                          <TableCell>{entry.duration}d</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <PdfPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        activities={previewActivities}
        activityName={previewTitle}
        windfarmName={parkName}
        useProvidedDuration
        onApplyChanges={(updated, newTitle) => {
          setPreviewActivities(updated);
          setPreviewTitle(newTitle);
          const fmt = (d: Date) =>
            `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
          setSchedule((prev) =>
            updated.map((a, i) => ({
              seq: Number(a.activityDescription) || prev[i]?.seq || i + 1,
              functionalLocation: a.functionalDescription,
              serialNumber: a.serialNumber,
              team: a.team || "",
              startDate: fmt(a.startDate),
              endDate: fmt(a.endDate),
              duration: a.duration,
            }))
          );
        }}
      />

    </div>
  );
};

export default MaintenanceAnalysis;
