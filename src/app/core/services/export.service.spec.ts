import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportService } from './export.service';
import { ShoppingListItem } from './meal-plan.service';

vi.mock('jspdf', () => ({ jsPDF: vi.fn() }));
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

function fakeDoc() {
  return {
    internal: {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
      getNumberOfPages: () => 1,
      getCurrentPageInfo: () => ({ pageNumber: 1 }),
    },
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
    lastAutoTable: { finalY: 100 },
  };
}

function items(): ShoppingListItem[] {
  return [
    {
      ingredientId: 'milk',
      ingredientName: 'Milk',
      totalQuantity: 2,
      unit: 'L',
      inventoryQuantity: 1,
      needed: 1,
      mealPlans: ['Pancakes'],
    },
    {
      ingredientId: 'flour',
      ingredientName: 'Flour, "Special"',
      totalQuantity: 0.5,
      unit: 'kg',
      inventoryQuantity: 0,
      needed: 0,
      mealPlans: ['Bread', 'Pizza', 'Cake'],
    },
  ];
}

describe('ExportService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportToPdf', () => {
    it('builds the title, table rows, and filename from the given items', () => {
      const doc = fakeDoc();
      (jsPDF as any).mockImplementation(function () { return doc; });
      const service = new ExportService();

      service.exportToPdf(items(), { title: 'My List' });

      expect(doc.text).toHaveBeenCalledWith('My List', 105, 20, { align: 'center' });
      expect(autoTable).toHaveBeenCalledTimes(1);
      const [, config] = (autoTable as any).mock.calls[0];
      expect(config.head).toEqual([['Item', 'Quantity', 'In Stock', 'For Recipes']]);
      expect(config.body).toEqual([
        ['Milk', '1 L', '1 L', 'Pancakes'],
        ['Flour, "Special"', '0.50 kg', '-', 'Bread, Pizza...'],
      ]);
      expect(doc.save).toHaveBeenCalledWith(expect.stringMatching(/^shopping-list-\d{4}-\d{2}-\d{2}\.pdf$/));
    });

    it('omits the inventory and recipe columns when disabled', () => {
      const doc = fakeDoc();
      (jsPDF as any).mockImplementation(function () { return doc; });
      const service = new ExportService();

      service.exportToPdf(items(), { showInventory: false, showRecipes: false });

      const [, config] = (autoTable as any).mock.calls[0];
      expect(config.head).toEqual([['Item', 'Quantity']]);
      expect(config.body).toEqual([
        ['Milk', '1 L'],
        ['Flour, "Special"', '0.50 kg'],
      ]);
    });
  });

  describe('exportToCsv', () => {
    let createObjectURL: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      createObjectURL = vi.fn(() => 'blob:fake-url');
      vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('builds CSV content with escaped fields and triggers a download', () => {
      const service = new ExportService();
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      service.exportToCsv(items(), { title: 'My List' });

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const [blob] = createObjectURL.mock.calls[0];
      expect(blob.type).toBe('text/csv;charset=utf-8;');
      expect(clickSpy).toHaveBeenCalled();

      clickSpy.mockRestore();
    });

    it('escapes commas and quotes in CSV fields', async () => {
      const service = new ExportService();
      let csvText = '';
      const originalBlob = globalThis.Blob;
      vi.stubGlobal(
        'Blob',
        class extends originalBlob {
          constructor(parts: any[], options?: any) {
            super(parts, options);
            csvText = parts.join('');
          }
        }
      );
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      service.exportToCsv(items());

      expect(csvText).toContain('"Flour, ""Special"""');
      expect(csvText).toContain('Bread; Pizza; Cake');
    });
  });

  describe('generatePrintHtml', () => {
    it('renders a table row per item with checkbox, quantity, and recipe columns', () => {
      const service = new ExportService();

      const html = service.generatePrintHtml(items(), { title: 'My <List>' });

      expect(html).toContain('<title>My &lt;List&gt;</title>');
      expect(html).toContain('<strong>Milk</strong>');
      expect(html).toContain('1 L');
      expect(html).toContain('Bread, Pizza, Cake');
      expect(html).toContain('Total items:</strong> 2');
      expect(html).toContain('Need to buy:</strong> 1');
      expect(html).toContain('Already in stock:</strong> 1');
    });

    it('omits the inventory and recipe table headers when disabled', () => {
      const service = new ExportService();

      const html = service.generatePrintHtml(items(), { showInventory: false, showRecipes: false });

      expect(html).not.toContain('In Stock');
      expect(html).not.toContain('For Recipes');
    });
  });

  describe('printShoppingList', () => {
    it('writes the generated HTML into a new window and triggers print', () => {
      vi.useFakeTimers();
      const service = new ExportService();
      const printWindow = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(printWindow as any);

      service.printShoppingList(items());

      expect(printWindow.document.write).toHaveBeenCalled();
      expect(printWindow.focus).toHaveBeenCalled();
      expect(printWindow.print).not.toHaveBeenCalled();

      vi.advanceTimersByTime(250);
      expect(printWindow.print).toHaveBeenCalled();

      vi.useRealTimers();
      (window.open as any).mockRestore();
    });

    it('alerts when popups are blocked', () => {
      const service = new ExportService();
      vi.spyOn(window, 'open').mockReturnValue(null);
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      service.printShoppingList(items());

      expect(alertSpy).toHaveBeenCalledWith('Please allow popups to print the shopping list');

      (window.open as any).mockRestore();
      alertSpy.mockRestore();
    });
  });

  describe('exportMealPlanToPdf', () => {
    it('renders the meal plan table and saves a dated filename', () => {
      const doc = fakeDoc();
      (jsPDF as any).mockImplementation(function () { return doc; });
      const service = new ExportService();

      service.exportMealPlanToPdf(
        [{ date: '2026-06-01', mealType: 'dinner', recipeName: 'Soup', servings: 2 }],
        { start: '2026-06-01', end: '2026-06-07' }
      );

      expect(doc.text).toHaveBeenCalledWith('Meal Plan', 105, 20, { align: 'center' });
      const [, config] = (autoTable as any).mock.calls[0];
      expect(config.body).toEqual([['2026-06-01', 'dinner', 'Soup', '2']]);
      expect(doc.save).toHaveBeenCalledWith(expect.stringMatching(/^meal-plan-\d{4}-\d{2}-\d{2}\.pdf$/));
    });
  });
});
