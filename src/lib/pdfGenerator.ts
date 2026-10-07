import jsPDF from "jspdf";
import { Activity } from "@/pages/Schedule";
import { format, differenceInDays, min, max, getWeek, startOfWeek, addDays } from "date-fns";
import { enUS } from "date-fns/locale";
import vestasLogo from "@/assets/vestas-logo.png";

export interface PdfLabels {
  id: string;
  functional: string;
  serial: string;
  team: string;
  start: string;
  end: string;
  duration: string;
  week: string;
}

export const DEFAULT_PDF_LABELS: PdfLabels = {
  id: "ID",
  functional: "Description of functional location",
  serial: "Serial Number",
  team: "Team",
  start: "Start",
  end: "End",
  duration: "Duration (days)",
  week: "Week",
};

export interface PdfLayoutOptions {
  weeksPerPage?: number;
  rowsPerPage?: number;
  /** Indices (from buildPdfPages output) that the user removed in the preview */
  excludedPages?: number[];
  /** Full title text; when provided it replaces the default composed title */
  titleOverride?: string;
  labels?: Partial<PdfLabels>;
}


export interface PdfPage {
  activities: Activity[];
  windowStart: Date;
  weeks: number[];
  weekDates: Date[];
}

/**
 * Computes the pagination used both by the PDF export and the on-screen preview.
 *
 * Single source of truth: a continuous week sequence is derived from the whole
 * schedule and then split into windows of `weeksPerPage`. Weeks therefore never
 * restart or repeat between window groups. Inside each window the rows are
 * chunked by `rowsPerPage`.
 */
export const buildPdfPages = (
  activities: Activity[],
  options: PdfLayoutOptions = {}
): PdfPage[] => {
  const weeksPerPage = Math.min(8, Math.max(1, options.weeksPerPage ?? 8));
  const rowsPerPage = Math.min(50, Math.max(1, options.rowsPerPage ?? 50));

  if (activities.length === 0) return [];

  const allDates = activities.flatMap((a) => [a.startDate, a.endDate]);
  const globalStart = startOfWeek(min(allDates), { weekStartsOn: 1 });
  const globalEnd = max(allDates);
  const totalWeeks = Math.max(
    1,
    Math.ceil((differenceInDays(globalEnd, globalStart) + 1) / 7)
  );

  // Continuous week sequence for the entire document
  const weekSequence: Date[] = Array.from({ length: totalWeeks }, (_, i) =>
    addDays(globalStart, i * 7)
  );

  const pages: PdfPage[] = [];

  for (let w = 0; w < weekSequence.length; w += weeksPerPage) {
    const weekDates = weekSequence.slice(w, w + weeksPerPage);
    const windowStart = weekDates[0];
    const windowEnd = addDays(windowStart, weekDates.length * 7 - 1);
    const weeks = weekDates.map((d) =>
      getWeek(d, { weekStartsOn: 1, firstWeekContainsDate: 4 })
    );

    const windowActivities = activities.filter(
      (a) => a.startDate <= windowEnd && a.endDate >= windowStart
    );
    if (windowActivities.length === 0) continue;

    for (let chunk = 0; chunk * rowsPerPage < windowActivities.length; chunk++) {
      pages.push({
        activities: windowActivities.slice(
          chunk * rowsPerPage,
          chunk * rowsPerPage + rowsPerPage
        ),
        windowStart,
        weeks,
        weekDates,
      });
    }
  }

  return pages;
};

/**
 * Suggests the best balance between weeks/page and rows/page for the schedule.
 */
export const suggestAutoLayout = (
  activities: Activity[]
): { weeksPerPage: number; rowsPerPage: number } => {
  if (activities.length === 0) return { weeksPerPage: 8, rowsPerPage: 50 };

  const allDates = activities.flatMap((a) => [a.startDate, a.endDate]);
  const globalStart = startOfWeek(min(allDates), { weekStartsOn: 1 });
  const globalEnd = max(allDates);
  const totalWeeks = Math.max(
    1,
    Math.ceil((differenceInDays(globalEnd, globalStart) + 1) / 7)
  );
  const rowCount = activities.length;

  let best = { weeksPerPage: 8, rowsPerPage: 50, score: -Infinity };

  for (let wpp = 1; wpp <= 8; wpp++) {
    for (let rpp = 5; rpp <= 50; rpp++) {
      const pages = buildPdfPages(activities, {
        weeksPerPage: wpp,
        rowsPerPage: rpp,
      }).length;
      if (pages === 0) continue;

      // Geometry (A3 landscape, mm) — mirrors generatePDF
      const availableHeight = 297 - 30 - 25 - 16;
      const rowHeight = availableHeight / rpp;
      const ganttWidth = 420 - 30 - 213 - 4;
      const weekWidth = ganttWidth / wpp;

      // Legibility: rows should be at least ~4mm tall, weeks at least ~10mm wide
      const rowScore = Math.min(rowHeight / 5, 1.2);
      const weekScore = Math.min(weekWidth / 14, 1.2);
      // Page usage: fill the rows we actually have
      const fill = Math.min(rowCount, rpp) / rpp;
      const weekFill = Math.min(totalWeeks, wpp) / wpp;
      // Fewer pages is better, but not at the cost of legibility
      const pagePenalty = pages / Math.max(1, Math.ceil(rowCount / 50) * Math.ceil(totalWeeks / 8));

      const score =
        rowScore * 2.2 + weekScore * 2.2 + fill * 1.4 + weekFill * 1.4 - pagePenalty * 0.6;

      if (score > best.score) best = { weeksPerPage: wpp, rowsPerPage: rpp, score };
    }
  }

  return { weeksPerPage: best.weeksPerPage, rowsPerPage: best.rowsPerPage };
};


const drawHeader = (pdf: jsPDF, pageWidth: number, margin: number, titleText: string, pageNum: number) => {
  // Add Vestas logo with correct aspect ratio (3.33:1)
  const logoWidth = 40;
  const logoHeight = 18;
  pdf.addImage(vestasLogo, "PNG", margin, margin, logoWidth, logoHeight);

  // Title
  pdf.setTextColor(33, 87, 138);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  if (titleText.trim() !== "") {
    pdf.text(titleText, pageWidth / 2, margin + 10, { align: "center" });
  }


  // Page number in top right
  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(10);
  pdf.text(
    `Page ${pageNum}`,
    pageWidth - margin,
    margin + 10,
    { align: "right" }
  );
};

const drawCalendarHeader = (
  pdf: jsPDF,
  yPos: number,
  ganttX: number,
  ganttWidth: number,
  weekDates: Date[],
  tableHeight: number,
  weekLabel: string = "Week"
) => {

  const totalWeeks = weekDates.length;
  const weekWidth = ganttWidth / totalWeeks;

  // Draw month/year labels
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);

  // Build month segments based on actual week dates
  const monthSegments: { month: number, year: number, startX: number, endX: number }[] = [];
  let currentMonth = -1;
  let currentYear = -1;
  let segmentStartX = ganttX;

  for (let i = 0; i < totalWeeks; i++) {
    const weekDate = weekDates[i];
    const weekX = ganttX + (i * weekWidth);
    const weekMonth = weekDate.getMonth();
    const weekYear = weekDate.getFullYear();

    if (weekMonth !== currentMonth || weekYear !== currentYear) {
      if (currentMonth !== -1) {
        monthSegments.push({
          month: currentMonth,
          year: currentYear,
          startX: segmentStartX,
          endX: weekX
        });
      }
      currentMonth = weekMonth;
      currentYear = weekYear;
      segmentStartX = weekX;
    }
  }

  // Add last segment
  monthSegments.push({
    month: currentMonth,
    year: currentYear,
    startX: segmentStartX,
    endX: ganttX + ganttWidth
  });

  // Draw month labels
  const monthBoundaries: number[] = [];
  monthSegments.forEach((segment, index) => {
    const segmentWidth = segment.endX - segment.startX;
    const centerX = segment.startX + segmentWidth / 2;

    const monthDate = new Date(segment.year, segment.month, 1);
    const monthLabel = format(monthDate, "MMM/yyyy");
    pdf.text(monthLabel, centerX, yPos + 4, { align: "center" });

    if (index > 0) {
      monthBoundaries.push(segment.startX);
    }
  });

  // Draw separator line between months and weeks
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.3);
  pdf.line(ganttX, yPos + 6, ganttX + ganttWidth, yPos + 6);

  // Draw week numbers
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6);

  for (let i = 0; i < totalWeeks; i++) {
    const weekX = ganttX + (i * weekWidth);
    const weekNum = getWeek(weekDates[i], { weekStartsOn: 1, firstWeekContainsDate: 4 });

    if (i > 0) {
      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(0.1);
      pdf.line(weekX, yPos + 6, weekX, yPos + 16);
    }

    if (weekLabel.trim() !== "") {
      pdf.text(weekLabel, weekX + weekWidth / 2, yPos + 9, { align: "center" });
    }

    pdf.text(weekNum.toString().padStart(2, '0'), weekX + weekWidth / 2, yPos + 13, { align: "center" });
  }

  // Draw subtle minimalist month dividers through the entire table
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.15);
  monthBoundaries.forEach(boundaryX => {
    pdf.line(boundaryX, yPos, boundaryX, yPos + 16 + tableHeight);
  });

  return monthBoundaries;
};

export const generatePDF = (
  activities: Activity[],
  activityName: string,
  windfarmName: string,
  useProvidedDuration: boolean = false,
  options: PdfLayoutOptions = {}
) => {
  // A3 landscape dimensions in mm
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a3",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  const rowsPerPage = Math.min(50, Math.max(1, options.rowsPerPage ?? 50));
  const headerHeight = 25;
  const calendarHeight = 16;
  const availableHeight = pageHeight - (2 * margin) - headerHeight - calendarHeight;

  const labels: PdfLabels = { ...DEFAULT_PDF_LABELS, ...(options.labels ?? {}) };
  const titleText =
    options.titleOverride !== undefined
      ? options.titleOverride
      : `Cronograma ${activityName} - ${windfarmName}`;

  const excluded = new Set(options.excludedPages ?? []);
  const pages = buildPdfPages(activities, options).filter((_, i) => !excluded.has(i));


  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage();
    }

    const pageNum = pageIndex + 1;
    const pageActivities = page.activities;
    const activitiesCount = pageActivities.length;

    // Calculate dynamic row height to fit activities in available space
    const rowHeight = availableHeight / rowsPerPage;

    // Draw header
    drawHeader(pdf, pageWidth, margin, titleText, pageNum);


    // Table starting position
    let yPos = margin + headerHeight;

    const windowStart = page.windowStart;
    const totalDays = page.weeks.length * 7;

    // Check if any activity has team information
    const hasTeamInfo = pageActivities.some(a => a.team && a.team.trim() !== "");

    // Table headers - adjust column widths based on whether team column is shown
    const colWidths = hasTeamInfo ? {
      seq: 15,
      functional: 70,
      serial: 30,
      team: 20,
      start: 28,
      end: 28,
      duration: 22,
      gantt: contentWidth - 213,
    } : {
      seq: 15,
      functional: 70,
      serial: 30,
      team: 0,
      start: 28,
      end: 28,
      duration: 22,
      gantt: contentWidth - 193,
    };

    // Header background with modern gradient effect
    pdf.setFillColor(33, 87, 138);
    pdf.rect(margin, yPos, contentWidth, 16, "F");

    // Header text
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");

    let xPos = margin + 2;
    pdf.text(labels.id, xPos, yPos + 8);
    xPos += colWidths.seq;
    pdf.text(labels.functional, xPos, yPos + 8, { maxWidth: colWidths.functional - 4 });
    xPos += colWidths.functional;
    pdf.text(labels.serial, xPos, yPos + 8, { maxWidth: colWidths.serial - 4 });
    xPos += colWidths.serial;

    if (hasTeamInfo) {
      pdf.text(labels.team, xPos, yPos + 8, { maxWidth: colWidths.team - 4 });
      xPos += colWidths.team;
    }

    pdf.text(labels.start, xPos, yPos + 8, { maxWidth: colWidths.start - 4 });
    xPos += colWidths.start;
    pdf.text(labels.end, xPos, yPos + 8, { maxWidth: colWidths.end - 4 });
    xPos += colWidths.end;
    pdf.text(labels.duration, xPos, yPos + 8, { maxWidth: colWidths.duration - 4 });
    xPos += colWidths.duration;

    // Draw calendar header for Gantt column
    const ganttX = xPos;
    const ganttWidth = colWidths.gantt - 4;

    // Calculate table height
    const tableHeight = rowHeight * activitiesCount;

    drawCalendarHeader(pdf, yPos, ganttX, ganttWidth, page.weekDates, tableHeight, labels.week);


    yPos += 16;

    // Table rows
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(60, 60, 60);

    pageActivities.forEach((activity, index) => {
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, yPos, contentWidth, rowHeight, "F");
      }

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, yPos, contentWidth, rowHeight);

      pdf.setFontSize(7);
      xPos = margin + 2;

      const textY = yPos + rowHeight / 2 + 1;
      pdf.text(activity.activityDescription, xPos, textY, {
        maxWidth: colWidths.seq - 4,
      });
      xPos += colWidths.seq;

      pdf.text(activity.functionalDescription, xPos, textY, {
        maxWidth: colWidths.functional - 4,
      });
      xPos += colWidths.functional;

      pdf.text(activity.serialNumber, xPos, textY, {
        maxWidth: colWidths.serial - 4,
      });
      xPos += colWidths.serial;

      if (hasTeamInfo) {
        pdf.text(activity.team || "-", xPos, textY, {
          maxWidth: colWidths.team - 4,
        });
        xPos += colWidths.team;
      }

      const startDayAbbr = format(activity.startDate, "EEE", { locale: enUS });
      pdf.text(`${startDayAbbr} ${format(activity.startDate, "dd/MM/yyyy")}`, xPos, textY);
      xPos += colWidths.start;

      const endDayAbbr = format(activity.endDate, "EEE", { locale: enUS });
      pdf.text(`${endDayAbbr} ${format(activity.endDate, "dd/MM/yyyy")}`, xPos, textY);
      xPos += colWidths.end;

      const durationToDisplay = useProvidedDuration
        ? activity.duration
        : differenceInDays(activity.endDate, activity.startDate) + 1;
      pdf.text(`${durationToDisplay}d`, xPos, textY);
      xPos += colWidths.duration;

      // Gantt bar (clipped to the current week window)
      const ganttBarX = xPos;
      const ganttBarWidth = colWidths.gantt - 4;
      const barInset = Math.min(1.2, rowHeight * 0.15);
      const ganttY = yPos + barInset;
      const ganttHeight = Math.max(1.2, rowHeight - barInset * 2);


      const daysFromStart = differenceInDays(activity.startDate, windowStart);
      const activityDays = differenceInDays(activity.endDate, activity.startDate) + 1;
      const clipStart = Math.max(0, daysFromStart);
      const clipEnd = Math.min(totalDays, daysFromStart + activityDays);

      if (clipEnd > clipStart) {
        const barX = ganttBarX + (clipStart / totalDays) * ganttBarWidth;
        const barWidth = ((clipEnd - clipStart) / totalDays) * ganttBarWidth;

        pdf.setFillColor(59, 130, 246);
        pdf.roundedRect(barX, ganttY, barWidth, ganttHeight, 2, 2, "F");

        // Add end date label at the end of the bar (only if the bar really ends here)
        if (daysFromStart + activityDays <= totalDays) {
          pdf.setFontSize(6);
          pdf.setTextColor(60, 60, 60);
          const endDateLabel = format(activity.endDate, "dd/MM/yyyy");
          const endDateWidth = pdf.getTextWidth(endDateLabel);
          const labelX = barX + barWidth + 2;

          if (labelX + endDateWidth <= ganttBarX + ganttBarWidth) {
            pdf.text(endDateLabel, labelX, ganttY + ganttHeight / 2 + 1);
          }
          pdf.setTextColor(60, 60, 60);
        }
      }

      yPos += rowHeight;
    });
  });

  // Save PDF with custom filename
  const dateStr = format(new Date(), "yyyyMMdd");
  const fileName = `Cronograma ${activityName} - ${windfarmName}_${dateStr}.pdf`;
  pdf.save(fileName);
};
