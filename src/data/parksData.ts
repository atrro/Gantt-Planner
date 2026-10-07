import parksDataJson from './parksData.json';
import { readSerialsFromExcel } from '@/lib/excelReader';

export interface SerialData {
  serialNumber: string;
  parkName: string;
  functionalLocation: string;
}

export interface HolidayData {
  [parkName: string]: string[];
}

export const PARK_NAMES = [
  "Alegria",
  "Alto Sertão III",
  "Amontada",
  "Angicos",
  "Aroeira",
  "Assuruá",
  "Aventura",
  "Babilônia Centro",
  "Babilônia Sul CDV",
  "Cabeço Preto",
  "Caldeirão",
  "Campo Largo",
  "Catanduba",
  "CGN",
  "Copel",
  "Cristalândia",
  "Cumaru",
  "Delfina",
  "Elera",
  "Folha Larga CDV",
  "Folha Larga Norte",
  "Gargaú",
  "Gravatá",
  "Honda",
  "Icaraí",
  "Jerusalém",
  "Kairós",
  "Macambira",
  "Monte Verde",
  "Morro do Chapeu I",
  "Morro do Chapeu II",
  "Mundo Novo",
  "Novo Horizonte",
  "Ouro Branco",
  "Pedra do Reino",
  "Pedra Pintada",
  "Pedra Rajada",
  "Riachão",
  "Rio do Vento Expansão",
  "Rio do Vento II",
  "Santa Rosa Mundo Novo",
  "Sento Sé",
  "Seridó",
  "Serra das almas",
  "Serra das vacas",
  "Serra do Assuruá",
  "Serra do Tigre",
  "Serrote e Serra do Mato",
  "Taiba",
  "UMARI",
  "Ventos da Bahia",
  "Ventos do Piauí",
  "Vilas",
  "Vilas IV"
];

// Load holidays from JSON
export const HOLIDAYS: HolidayData = parksDataJson.holidays;

// Load serials from JSON (priority source)
const JSON_SERIALS: { [parkName: string]: Array<{serialNumber: string, functionalLocation: string}> } = (parksDataJson as any).serials || {};

// Cache para os seriais carregados do Excel
let serialsCache: { [parkName: string]: Array<{serialNumber: string, functionalLocation: string}> } | null = null;

// Função para carregar seriais do Excel (carrega uma vez e cacheia)
async function loadSerials() {
  if (serialsCache) {
    return serialsCache;
  }
  
  const excelData = await readSerialsFromExcel();
  serialsCache = excelData.serials;
  return serialsCache;
}

export async function getSerialsByPark(parkName: string): Promise<SerialData[]> {
  // First check if serials exist in JSON (priority)
  if (JSON_SERIALS[parkName] && JSON_SERIALS[parkName].length > 0) {
    return JSON_SERIALS[parkName]
      .map(s => ({
        serialNumber: s.serialNumber,
        parkName,
        functionalLocation: s.functionalLocation
      }))
      .sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
  }
  
  // Fallback to Excel
  const serials = await loadSerials();
  const parkSerials = serials[parkName] || [];
  
  return parkSerials
    .map(s => ({
      serialNumber: s.serialNumber,
      parkName,
      functionalLocation: s.functionalLocation
    }))
    .sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
}

export const getHolidaysByPark = (parkName: string): Date[] => {
  const holidays = HOLIDAYS[parkName] || [];
  return holidays.map(h => {
    const [day, month, year] = h.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  });
};
