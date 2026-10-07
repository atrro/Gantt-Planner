import * as XLSX from 'xlsx';

export interface SerialData {
  serialNumber: string;
  parkName: string;
  functionalLocation: string;
}

export interface ProcessedData {
  serials: { [parkName: string]: Array<{serialNumber: string, functionalLocation: string}> };
}

export async function readSerialsFromExcel(): Promise<ProcessedData> {
  try {
    // Fetch the Excel file
    const response = await fetch(`${import.meta.env.BASE_URL}data/FERIADOS.xlsx`);
    const arrayBuffer = await response.arrayBuffer();
    
    // Parse the workbook
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Get the "Serial" sheet
    const serialSheet = workbook.Sheets['Serial'];
    if (!serialSheet) {
      console.error('Serial sheet not found in workbook');
      return { serials: {} };
    }
    
    // Convert to JSON
    const data: any[] = XLSX.utils.sheet_to_json(serialSheet, { header: 1 });
    
    // Process the data - skip header row
    const serials: { [parkName: string]: Array<{serialNumber: string, functionalLocation: string}> } = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row.length >= 3) {
        const serialNumber = String(row[0] || '').trim();
        const parkName = String(row[1] || '').trim();
        const functionalLocation = String(row[2] || '').trim();
        
        if (serialNumber && parkName && functionalLocation) {
          if (!serials[parkName]) {
            serials[parkName] = [];
          }
          
          serials[parkName].push({
            serialNumber,
            functionalLocation
          });
        }
      }
    }
    
    return { serials };
  } catch (error) {
    console.error('Error reading Excel file:', error);
    return { serials: {} };
  }
}
