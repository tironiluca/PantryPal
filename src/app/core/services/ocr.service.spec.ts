import Tesseract from 'tesseract.js';
import { OcrService } from './ocr.service';

vi.mock('tesseract.js', () => ({
  default: { recognize: vi.fn() },
}));

function recognizeText(text: string) {
  (Tesseract.recognize as any).mockResolvedValue({ data: { text } });
}

describe('OcrService', () => {
  const service = new OcrService();

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns null when no date-like text is found', async () => {
    recognizeText('best before: soon, no digits here');
    await expect(service.extractExpiry({} as File)).resolves.toBeNull();
  });

  it('extracts an ISO yyyy-mm-dd date found in the scanned text', async () => {
    recognizeText('Best before\n2027-08-15\nEnjoy fresh');
    await expect(service.extractExpiry({} as File)).resolves.toBe('2027-08-15');
  });

  it('extracts a month/day/year date and reassembles it as ISO', async () => {
    recognizeText('EXP 08/15/2027');
    await expect(service.extractExpiry({} as File)).resolves.toBe('2027-08-15');
  });

  it('normalizes dot and dash separated dates before parsing', async () => {
    recognizeText('EXP 08.15.2027');
    await expect(service.extractExpiry({} as File)).resolves.toBe('2027-08-15');
  });

  it('returns null for a date already in the past', async () => {
    recognizeText('EXP 01/01/2020');
    await expect(service.extractExpiry({} as File)).resolves.toBeNull();
  });

  it('returns null for a date more than five years in the future', async () => {
    recognizeText('EXP 01/01/2035');
    await expect(service.extractExpiry({} as File)).resolves.toBeNull();
  });

  it('returns null when the matched text does not form a valid calendar date', async () => {
    recognizeText('CODE 9999-99-99');
    await expect(service.extractExpiry({} as File)).resolves.toBeNull();
  });
});
