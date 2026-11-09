import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { ConflictData, SyncConflictDialog } from './sync-conflict.dialog';

describe('SyncConflictDialog', () => {
  let fixture: ComponentFixture<SyncConflictDialog>;
  let component: SyncConflictDialog;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };

  async function setup(data: ConflictData) {
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SyncConflictDialog, MatIconTestingModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SyncConflictDialog);
    component = fixture.componentInstance;
  }

  describe('getEntityName', () => {
    it('maps known tables to a friendly name', async () => {
      await setup({ table: 'inventory', local: {}, remote: {} });
      expect(component.getEntityName()).toBe('inventory item');
    });

    it('falls back to "item" for an unknown table', async () => {
      await setup({ table: 'nutrition_goals', local: {}, remote: {} });
      expect(component.getEntityName()).toBe('item');
    });
  });

  describe('getDisplayFields', () => {
    it('excludes bookkeeping fields and maps known labels', async () => {
      await setup({ table: 'inventory', local: {}, remote: {} });
      const fields = component.getDisplayFields({
        id: 'i1', userId: 'u1', syncedAt: 'x', version: 1, isDeleted: 0, createdAt: 'x', updatedAt: 'x',
        quantity: 5, unit: 'kg',
      });

      expect(fields).toEqual([
        { key: 'quantity', label: 'Quantity', value: '5' },
        { key: 'unit', label: 'Unit', value: 'kg' },
      ]);
    });

    it('falls back to a formatted label for unknown fields', async () => {
      await setup({ table: 'inventory', local: {}, remote: {} });
      const fields = component.getDisplayFields({ someCustomField: 'value' });
      expect(fields).toEqual([{ key: 'someCustomField', label: 'Some Custom Field', value: 'value' }]);
    });
  });

  describe('formatLabel', () => {
    it('splits camelCase into words and capitalizes the first letter', async () => {
      await setup({ table: 'inventory', local: {}, remote: {} });
      expect(component.formatLabel('minRestock')).toBe('Min Restock');
    });
  });

  describe('formatValue', () => {
    beforeEach(async () => {
      await setup({ table: 'inventory', local: {}, remote: {} });
    });

    it('shows a dash for null or undefined', () => {
      expect(component.formatValue(null)).toBe('-');
      expect(component.formatValue(undefined)).toBe('-');
    });

    it('formats booleans as Yes/No', () => {
      expect(component.formatValue(true)).toBe('Yes');
      expect(component.formatValue(false)).toBe('No');
    });

    it('stringifies numbers', () => {
      expect(component.formatValue(42)).toBe('42');
    });

    it('formats an ISO date string with formatDate', () => {
      const spy = vi.spyOn(component, 'formatDate').mockReturnValue('formatted-date');
      expect(component.formatValue('2026-01-01T00:00:00.000Z')).toBe('formatted-date');
      expect(spy).toHaveBeenCalledWith('2026-01-01T00:00:00.000Z');
    });

    it('truncates long strings to 50 characters with an ellipsis', () => {
      const longValue = 'a'.repeat(60);
      expect(component.formatValue(longValue)).toBe('a'.repeat(50) + '...');
    });

    it('leaves short strings untouched', () => {
      expect(component.formatValue('short')).toBe('short');
    });

    it('stringifies any other value type', () => {
      expect(component.formatValue(['a', 'b'])).toBe('a,b');
    });
  });

  describe('formatDate', () => {
    beforeEach(async () => {
      await setup({ table: 'inventory', local: {}, remote: {} });
    });

    it('returns a dash for a missing value', () => {
      expect(component.formatDate(null)).toBe('-');
      expect(component.formatDate(undefined)).toBe('-');
    });

    it('returns a locale-formatted string for a valid date', () => {
      const result = component.formatDate('2026-01-01T00:00:00.000Z');
      expect(result).toBe(new Date('2026-01-01T00:00:00.000Z').toLocaleString());
    });
  });

  describe('isFieldChanged', () => {
    it('is true when local and remote differ', async () => {
      await setup({ table: 'inventory', local: { quantity: 1 }, remote: { quantity: 2 } });
      expect(component.isFieldChanged('quantity')).toBe(true);
    });

    it('is false when local and remote match', async () => {
      await setup({ table: 'inventory', local: { quantity: 1 }, remote: { quantity: 1 } });
      expect(component.isFieldChanged('quantity')).toBe(false);
    });
  });

  describe('resolution actions', () => {
    beforeEach(async () => {
      await setup({ table: 'inventory', local: {}, remote: {} });
    });

    it('closes with the chosen resolution', () => {
      component.onResolve('keep-local');
      expect(dialogRefSpy.close).toHaveBeenCalledWith('keep-local');
    });

    it('closes with null on cancel', () => {
      component.onCancel();
      expect(dialogRefSpy.close).toHaveBeenCalledWith(null);
    });
  });
});
