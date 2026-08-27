import { TestBed } from '@angular/core/testing';
import { UnitConverterService } from './unit-converter.service';

describe('UnitConverterService', () => {
  let service: UnitConverterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UnitConverterService);
  });

  describe('convert', () => {
    it('converts within the weight family (kg -> g)', () => {
      expect(service.convert(1, 'kg', 'g')).toBe(1000);
    });

    it('converts within the volume family (l -> ml)', () => {
      expect(service.convert(1.5, 'l', 'ml')).toBe(1500);
    });

    it('converts pounds to grams using the correct factor', () => {
      expect(service.convert(1, 'lb', 'g')).toBeCloseTo(453.592, 3);
    });

    it('returns null when converting across incompatible unit types', () => {
      expect(service.convert(1, 'kg', 'ml')).toBeNull();
    });

    it('returns null for an unknown unit', () => {
      expect(service.convert(1, 'kg', 'banana' as any)).toBeNull();
    });

    it('round-trips through the base unit without drift for same-unit conversion', () => {
      expect(service.convert(42, 'g', 'g')).toBe(42);
    });
  });

  describe('isEnough', () => {
    it('returns true when available (after conversion) meets the need', () => {
      expect(service.isEnough(1, 'kg', 500, 'g')).toBe(true);
    });

    it('returns false when available (after conversion) falls short', () => {
      expect(service.isEnough(0.4, 'kg', 500, 'g')).toBe(false);
    });

    it('returns false for incompatible units instead of throwing', () => {
      expect(service.isEnough(5, 'l', 100, 'g')).toBe(false);
    });
  });

  describe('displayQuantity', () => {
    it('keeps small gram quantities as-is', () => {
      expect(service.displayQuantity(250, 'g')).toBe('250 g');
    });

    it('promotes large gram quantities to kg', () => {
      expect(service.displayQuantity(1500, 'g')).toBe('1.50 kg');
    });

    it('promotes large ml quantities to l', () => {
      expect(service.displayQuantity(2000, 'ml')).toBe('2.00 l');
    });

    it('rounds to two decimal places for non-convertible units', () => {
      expect(service.displayQuantity(3.14159, 'pcs')).toBe('3.14 pcs');
    });
  });

  describe('calculateShortage', () => {
    it('reports zero shortage when enough is available', () => {
      expect(service.calculateShortage(1, 'kg', 500, 'g')).toEqual({ shortage: 0, unit: 'g' });
    });

    it('reports the missing amount in the needed unit', () => {
      expect(service.calculateShortage(200, 'g', 1, 'kg')).toEqual({ shortage: 0.8, unit: 'kg' });
    });

    it('returns null for incompatible units', () => {
      expect(service.calculateShortage(1, 'pcs', 1, 'kg')).toBeNull();
    });
  });

  describe('getUnitsByType / getUnitType / areUnitsCompatible', () => {
    it('lists all weight units', () => {
      expect(service.getUnitsByType('weight').sort()).toEqual(['g', 'kg', 'lb', 'oz'].sort());
    });

    it('resolves the type of a known unit', () => {
      expect(service.getUnitType('tbsp')).toBe('volume');
    });

    it('returns null for an unknown unit type', () => {
      expect(service.getUnitType('banana' as any)).toBeNull();
    });

    it('treats same-family units as compatible', () => {
      expect(service.areUnitsCompatible('g', 'kg')).toBe(true);
    });

    it('treats cross-family units as incompatible', () => {
      expect(service.areUnitsCompatible('g', 'ml')).toBe(false);
    });
  });

  describe('sumQuantities', () => {
    it('sums mixed-unit quantities into the target unit', () => {
      const total = service.sumQuantities(
        [
          { quantity: 500, unit: 'g' },
          { quantity: 0.5, unit: 'kg' },
        ],
        'g'
      );
      expect(total).toBe(1000);
    });

    it('returns null if any item cannot be converted', () => {
      const total = service.sumQuantities(
        [
          { quantity: 500, unit: 'g' },
          { quantity: 1, unit: 'l' },
        ],
        'g'
      );
      expect(total).toBeNull();
    });
  });
});
