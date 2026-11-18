import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { InventoryListComponent } from './inventory-list.component';
import { DbService } from '../../core/services/db.service';
import { OcrService } from '../../core/services/ocr.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { SnackbarService } from '../../core/services/snackbar.service';
import { DataEventsService } from '../../core/services/data-events.service';
import { KeyboardService } from '../../core/services/keyboard.service';
import { DietAdviceService } from '../../core/services/diet-advice.service';

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe('InventoryListComponent', () => {
  let fixture: ComponentFixture<InventoryListComponent>;
  let component: InventoryListComponent;
  let dbSpy: { queryByUser: ReturnType<typeof vi.fn>; getIngredientsByIds: ReturnType<typeof vi.fn>; softDelete: ReturnType<typeof vi.fn>; canModify: ReturnType<typeof vi.fn> };
  let ocrSpy: { extractExpiry: ReturnType<typeof vi.fn> };
  let dialogSpy: { open: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handle: ReturnType<typeof vi.fn> };
  let snackbarSpy: { success: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  let dataEventsSpy: { on: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> };

  const baseRows = [
    { id: 'i1', ingredientId: 'ing-1', quantity: 1, minRestock: 2, unit: 'g', location: 'fridge', expiry: daysFromNow(3), barcode: '111' },
    { id: 'i2', ingredientId: 'ing-2', quantity: 5, minRestock: 1, unit: 'g', location: 'pantry', expiry: daysFromNow(-2), barcode: '222' },
  ];

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [
        InventoryListComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: DbService, useValue: dbSpy },
        { provide: OcrService, useValue: ocrSpy },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: ErrorHandlerService, useValue: errorHandlerSpy },
        { provide: SnackbarService, useValue: snackbarSpy },
        { provide: DataEventsService, useValue: dataEventsSpy },
        { provide: KeyboardService, useValue: { addNew$: of(), focusSearch$: of(), escape$: of() } },
        { provide: DietAdviceService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryListComponent);
    component = fixture.componentInstance;
    // MatDialogModule (imported by the component) re-provides the real MatDialog,
    // which shadows the TestBed-level override, so replace it directly on the instance.
    (component as any).dialog = dialogSpy;
  }

  beforeEach(() => {
    dbSpy = {
      queryByUser: vi.fn().mockReturnValue(baseRows.map(r => ({ ...r }))),
      getIngredientsByIds: vi.fn().mockReturnValue([{ id: 'ing-1', name: 'Milk' }, { id: 'ing-2', name: 'Eggs' }]),
      softDelete: vi.fn(),
      canModify: vi.fn(() => true),
    };
    ocrSpy = { extractExpiry: vi.fn() };
    dialogSpy = { open: vi.fn() };
    errorHandlerSpy = { handle: vi.fn() };
    snackbarSpy = { success: vi.fn(), info: vi.fn(), warning: vi.fn() };
    dataEventsSpy = { on: vi.fn().mockReturnValue(of()), emit: vi.fn() };
  });

  it('loads inventory and resolves ingredient names on construction', async () => {
    await setup();

    expect(component.rows.length).toBe(2);
    expect(component.getIngredientName('ing-1')).toBe('Milk');
    expect(component.loading()).toBe(false);
  });

  it('falls back to the raw id when the ingredient name lookup fails', async () => {
    dbSpy.getIngredientsByIds.mockImplementation(() => { throw new Error('boom'); });
    await setup();

    expect(component.getIngredientName('ing-1')).toBe('ing-1');
  });

  it('skips the name lookup entirely when there is no inventory', async () => {
    dbSpy.queryByUser.mockReturnValue([]);
    await setup();

    expect(dbSpy.getIngredientsByIds).not.toHaveBeenCalled();
    expect(component.rows).toEqual([]);
  });

  it('reports an error and clears the list when loading inventory fails', async () => {
    dbSpy.queryByUser.mockImplementation(() => { throw new Error('db down'); });
    await setup();

    expect(errorHandlerSpy.handle).toHaveBeenCalledWith(expect.any(Error), 'Failed to load inventory');
    expect(component.rows).toEqual([]);
    expect(component.filteredRows).toEqual([]);
  });

  describe('getExpiryStatus', () => {
    beforeEach(async () => { await setup(); });

    it('returns null when there is no expiry', () => {
      expect(component.getExpiryStatus(undefined)).toBeNull();
    });

    it('flags an expired date', () => {
      expect(component.getExpiryStatus(daysFromNow(-1))).toBe('expired');
    });

    it('flags a date expiring within a week as a warning', () => {
      expect(component.getExpiryStatus(daysFromNow(3))).toBe('warning');
    });

    it('treats a date further out as ok', () => {
      expect(component.getExpiryStatus(daysFromNow(20))).toBe('ok');
    });
  });

  describe('expiry chip icon and label', () => {
    // Local noon n calendar days from today, so the count never straddles midnight.
    const inDays = (n: number) => {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + n);
      return d.toISOString();
    };
    const localDate = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    beforeEach(async () => { await setup(); });

    it('gives each status its own icon, so colour is not the only signal', () => {
      expect(component.getExpiryIcon(inDays(-2))).toBe('error');
      expect(component.getExpiryIcon(inDays(3))).toBe('schedule');
      expect(component.getExpiryIcon(inDays(30))).toBe('event');
    });

    it('labels expired and soon items in words', () => {
      expect(component.getExpiryLabel(inDays(-2))).toEqual({ key: 'inventory.expired' });
      expect(component.getExpiryLabel(inDays(0))).toEqual({ key: 'inventory.expiresToday' });
      expect(component.getExpiryLabel(inDays(1))).toEqual({ key: 'inventory.expiresInOneDay' });
      expect(component.getExpiryLabel(inDays(5))).toEqual({ key: 'inventory.expiresInDays', params: { days: 5 } });
    });

    it('counts calendar days for date-only values, so tomorrow is "1 day"', () => {
      expect(component.getExpiryLabel(localDate(0))).toEqual({ key: 'inventory.expiresToday' });
      expect(component.getExpiryLabel(localDate(1))).toEqual({ key: 'inventory.expiresInOneDay' });
      expect(component.getExpiryLabel(localDate(2))).toEqual({ key: 'inventory.expiresInDays', params: { days: 2 } });
      expect(component.getExpiryStatus(localDate(-1))).toBe('expired');
      expect(component.getExpiryStatus(localDate(0))).toBe('warning');
    });

    it('shows the date itself for items that are fine or undated', () => {
      expect(component.getExpiryLabel(inDays(30))).toBeNull();
      expect(component.getExpiryLabel(undefined)).toBeNull();
    });
  });

  describe('getLocationIcon', () => {
    beforeEach(async () => { await setup(); });

    it('maps known locations to an icon', () => {
      expect(component.getLocationIcon('fridge')).toBe('kitchen');
      expect(component.getLocationIcon('freezer')).toBe('ac_unit');
      expect(component.getLocationIcon('pantry')).toBe('shelves');
    });

    it('falls back to the generic inventory icon', () => {
      expect(component.getLocationIcon(undefined)).toBe('inventory_2');
      expect(component.getLocationIcon('garage')).toBe('inventory_2');
    });
  });

  describe('isLowStock', () => {
    beforeEach(async () => { await setup(); });

    it('is true when quantity is at or below minRestock', () => {
      expect(component.isLowStock({ quantity: 1, minRestock: 2 } as any)).toBe(true);
      expect(component.isLowStock({ quantity: 2, minRestock: 2 } as any)).toBe(true);
    });

    it('is false once stock exceeds minRestock', () => {
      expect(component.isLowStock({ quantity: 3, minRestock: 2 } as any)).toBe(false);
    });
  });

  describe('applyFilters', () => {
    beforeEach(async () => { await setup(); });

    it('filters by resolved ingredient name', () => {
      component.searchTerm = 'milk';
      component.applyFilters();
      expect(component.filteredRows.map(r => r.id)).toEqual(['i1']);
    });

    it('filters by barcode', () => {
      component.searchTerm = '222';
      component.applyFilters();
      expect(component.filteredRows.map(r => r.id)).toEqual(['i2']);
    });

    it('filters by location', () => {
      component.locationFilter = 'pantry';
      component.applyFilters();
      expect(component.filteredRows.map(r => r.id)).toEqual(['i2']);
    });

    it('filters to only expired items', () => {
      component.expiringFilter = 'expired';
      component.applyFilters();
      expect(component.filteredRows.map(r => r.id)).toEqual(['i2']);
    });

    it('filters to items expiring within a week', () => {
      component.expiringFilter = 'week';
      component.applyFilters();
      expect(component.filteredRows.map(r => r.id)).toEqual(['i1']);
    });

    it('excludes items without an expiry when an expiry filter is active', () => {
      dbSpy.queryByUser.mockReturnValue([{ id: 'i3', ingredientId: 'ing-1', quantity: 1, minRestock: 1 }]);
      component.refresh();
      component.expiringFilter = 'week';
      component.applyFilters();
      expect(component.filteredRows).toEqual([]);
    });

    it('sorts by expiry ascending by default', () => {
      component.applyFilters();
      expect(component.filteredRows.map(r => r.id)).toEqual(['i2', 'i1']);
    });

    it('reverses order when sort direction is descending', () => {
      component.sortDirection = 'desc';
      component.applyFilters();
      expect(component.filteredRows.map(r => r.id)).toEqual(['i1', 'i2']);
    });

    it('sorts null values to the end regardless of direction', () => {
      dbSpy.queryByUser.mockReturnValue([
        { id: 'a', ingredientId: 'ing-1', quantity: 1, minRestock: 1, expiry: null },
        { id: 'b', ingredientId: 'ing-1', quantity: 1, minRestock: 1, expiry: daysFromNow(1) },
      ]);
      component.refresh();
      component.applyFilters();
      expect(component.filteredRows.map(r => r.id)).toEqual(['b', 'a']);
    });
  });

  describe('onSortChange', () => {
    beforeEach(async () => { await setup(); });

    it('flips direction when the same column is chosen again', () => {
      component.sortColumn = 'quantity';
      component.sortDirection = 'asc';
      component.onSortChange('quantity');
      expect(component.sortDirection).toBe('desc');
    });

    it('resets to ascending when a new column is chosen', () => {
      component.sortDirection = 'desc';
      component.onSortChange('location');
      expect(component.sortColumn).toBe('location');
      expect(component.sortDirection).toBe('asc');
    });
  });

  describe('toggleSortDirection', () => {
    it('flips the current sort direction', async () => {
      await setup();
      component.sortDirection = 'asc';
      component.toggleSortDirection();
      expect(component.sortDirection).toBe('desc');
    });
  });

  describe('clearFilters', () => {
    it('resets all filters and the search term', async () => {
      await setup();
      component.searchTerm = 'milk';
      component.locationFilter = 'pantry';
      component.expiringFilter = 'week';

      component.clearFilters();

      expect(component.searchTerm).toBe('');
      expect(component.locationFilter).toBeNull();
      expect(component.expiringFilter).toBe('all');
      expect(component.filteredRows.length).toBe(2);
    });
  });

  describe('expiringCount', () => {
    it('counts items expiring within the next week', async () => {
      await setup();
      expect(component.expiringCount).toBe(1);
    });

    it('agrees with the week filter and the "soon" chip, including items due today', async () => {
      await setup();
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      component.rows = [
        { ...component.rows[0], id: 'today', expiry: iso },
        { ...component.rows[1], id: 'past', expiry: daysFromNow(-3) },
      ];
      component.expiringFilter = 'week';
      component.applyFilters();

      expect(component.getExpiryStatus(iso)).toBe('warning');
      expect(component.expiringCount).toBe(1);
      expect(component.filteredRows.map(r => r.id)).toEqual(['today']);
    });
  });

  describe('activeFilterCount', () => {
    it('counts the active location and expiry filters', async () => {
      await setup();
      expect(component.activeFilterCount).toBe(0);
      component.locationFilter = 'fridge';
      expect(component.activeFilterCount).toBe(1);
      component.expiringFilter = 'week';
      expect(component.activeFilterCount).toBe(2);
    });
  });

  describe('add', () => {
    it('refreshes after a successful add', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(true) });
      const refreshSpy = vi.spyOn(component, 'refresh');

      component.add();

      expect(dialogSpy.open).toHaveBeenCalledWith(expect.anything(), { data: null });
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('scanAndAdd', () => {
    it('does nothing further when the scanner returns no code', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(null) });

      component.scanAndAdd();

      expect(dialogSpy.open).toHaveBeenCalledTimes(1);
    });

    it('opens the edit dialog pre-filled with the scanned barcode', async () => {
      await setup();
      dialogSpy.open
        .mockReturnValueOnce({ afterClosed: () => of('0123456789012') })
        .mockReturnValueOnce({ afterClosed: () => of(true) });
      const refreshSpy = vi.spyOn(component, 'refresh');

      component.scanAndAdd();

      expect(dialogSpy.open).toHaveBeenCalledTimes(2);
      expect(dialogSpy.open).toHaveBeenNthCalledWith(2, expect.anything(), { data: { barcode: '0123456789012' } });
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('onOcrFile', () => {
    function fileEvent(file: File | undefined) {
      return { target: { files: file ? [file] : [], value: '' } } as unknown as Event;
    }

    it('does nothing when no file was chosen', async () => {
      await setup();
      await component.onOcrFile(fileEvent(undefined));
      expect(ocrSpy.extractExpiry).not.toHaveBeenCalled();
    });

    it('opens the edit dialog pre-filled with the extracted expiry date', async () => {
      await setup();
      ocrSpy.extractExpiry.mockResolvedValue('2026-05-01');
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(true) });
      const refreshSpy = vi.spyOn(component, 'refresh');
      const file = new File(['x'], 'receipt.png');

      await component.onOcrFile(fileEvent(file));

      expect(snackbarSpy.info).toHaveBeenCalledWith('Extracting expiry date…');
      expect(dialogSpy.open).toHaveBeenCalledWith(expect.anything(), { data: { expiry: '2026-05-01' } });
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('warns and still opens the dialog when no date is found', async () => {
      await setup();
      ocrSpy.extractExpiry.mockResolvedValue(null);
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(false) });
      const file = new File(['x'], 'receipt.png');

      await component.onOcrFile(fileEvent(file));

      expect(snackbarSpy.warning).toHaveBeenCalledWith('No date found — enter it manually');
      expect(dialogSpy.open).toHaveBeenCalledWith(expect.anything(), { data: { expiry: '' } });
    });

    it('routes OCR failures through the error handler', async () => {
      await setup();
      ocrSpy.extractExpiry.mockRejectedValue(new Error('ocr failed'));
      const file = new File(['x'], 'receipt.png');

      await component.onOcrFile(fileEvent(file));

      expect(errorHandlerSpy.handle).toHaveBeenCalledWith(expect.any(Error), 'OCR failed');
    });
  });

  describe('edit', () => {
    it('opens the edit dialog with the given row and refreshes on success', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(true) });
      const refreshSpy = vi.spyOn(component, 'refresh');
      const row = { id: 'i1' } as any;

      component.edit(row);

      expect(dialogSpy.open).toHaveBeenCalledWith(expect.anything(), { data: row });
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('shared household items', () => {
    it('does not open the editor or delete an item owned by another member', async () => {
      await setup();
      dbSpy.canModify.mockReturnValue(false);
      dialogSpy.open.mockClear();

      component.edit({ id: 'i1', userId: 'u2' } as any);
      component.remove({ id: 'i1', userId: 'u2' } as any);

      expect(dialogSpy.open).not.toHaveBeenCalled();
      expect(dbSpy.softDelete).not.toHaveBeenCalled();
      expect(snackbarSpy.info).toHaveBeenCalledWith(expect.stringContaining('only they can change it'));
    });
  });

  describe('remove', () => {
    it('does nothing when the confirm dialog is cancelled', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(false) });

      component.remove({ id: 'i1' } as any);

      expect(dbSpy.softDelete).not.toHaveBeenCalled();
    });

    it('deletes the item and refreshes on confirmation', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(true) });
      const refreshSpy = vi.spyOn(component, 'refresh');

      component.remove({ id: 'i1' } as any);

      expect(dbSpy.softDelete).toHaveBeenCalledWith('inventory', 'i1');
      expect(dataEventsSpy.emit).toHaveBeenCalledWith('inventory', 'delete', 'i1');
      expect(snackbarSpy.success).toHaveBeenCalledWith('Inventory item deleted successfully');
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('reports an error when deletion fails', async () => {
      await setup();
      dialogSpy.open.mockReturnValue({ afterClosed: () => of(true) });
      dbSpy.softDelete.mockImplementation(() => { throw new Error('delete failed'); });

      component.remove({ id: 'i1' } as any);

      expect(errorHandlerSpy.handle).toHaveBeenCalledWith(expect.any(Error), 'Failed to delete inventory item');
    });
  });
});
