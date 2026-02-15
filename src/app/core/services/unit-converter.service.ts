import { Injectable } from '@angular/core';

export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'pcs' | 'oz' | 'lb' | 'cup' | 'tbsp' | 'tsp';

type UnitConversion = {
  type: 'weight' | 'volume' | 'count';
  toBase: number; // Conversion factor to base unit (g for weight, ml for volume)
};

@Injectable({ providedIn: 'root' })
export class UnitConverterService {
  // Conversion factors to base units (g for weight, ml for volume)
  private readonly conversions: Record<Unit, UnitConversion> = {
    // Weight (base: grams)
    'g': { type: 'weight', toBase: 1 },
    'kg': { type: 'weight', toBase: 1000 },
    'oz': { type: 'weight', toBase: 28.3495 },
    'lb': { type: 'weight', toBase: 453.592 },

    // Volume (base: milliliters)
    'ml': { type: 'volume', toBase: 1 },
    'l': { type: 'volume', toBase: 1000 },
    'cup': { type: 'volume', toBase: 236.588 },
    'tbsp': { type: 'volume', toBase: 14.7868 },
    'tsp': { type: 'volume', toBase: 4.92892 },

    // Count
    'pcs': { type: 'count', toBase: 1 },
  };

  /**
   * Convert quantity from one unit to another
   * @param quantity The quantity to convert
   * @param fromUnit The source unit
   * @param toUnit The target unit
   * @returns The converted quantity, or null if units are incompatible
   */
  convert(quantity: number, fromUnit: Unit, toUnit: Unit): number | null {
    const from = this.conversions[fromUnit];
    const to = this.conversions[toUnit];

    if (!from || !to) {
      console.warn(`Unknown unit: ${!from ? fromUnit : toUnit}`);
      return null;
    }

    if (from.type !== to.type) {
      console.warn(`Cannot convert ${from.type} to ${to.type}`);
      return null; // Can't convert weight to volume
    }

    // Convert to base unit, then to target unit
    const baseQuantity = quantity * from.toBase;
    return baseQuantity / to.toBase;
  }

  /**
   * Check if available quantity is enough to meet needed quantity
   * (accounting for unit conversion)
   * @param available Available quantity
   * @param availableUnit Unit of available quantity
   * @param needed Needed quantity
   * @param neededUnit Unit of needed quantity
   * @returns True if available >= needed (after conversion)
   */
  isEnough(
    available: number,
    availableUnit: Unit,
    needed: number,
    neededUnit: Unit
  ): boolean {
    const converted = this.convert(available, availableUnit, neededUnit);
    if (converted === null) return false; // Incompatible units
    return converted >= needed;
  }

  /**
   * Get display string with automatic unit selection for better readability
   * @param quantity The quantity to display
   * @param unit The unit
   * @returns Formatted string (e.g., "1.5 kg" instead of "1500 g")
   */
  displayQuantity(quantity: number, unit: Unit): string {
    // Auto-convert to better units for display
    if (unit === 'g' && quantity >= 1000) {
      return `${(quantity / 1000).toFixed(2)} kg`;
    }
    if (unit === 'ml' && quantity >= 1000) {
      return `${(quantity / 1000).toFixed(2)} l`;
    }

    // Round to 2 decimal places
    return `${Number(quantity.toFixed(2))} ${unit}`;
  }

  /**
   * Calculate shortage (how much more is needed)
   * @param available Available quantity
   * @param availableUnit Unit of available quantity
   * @param needed Needed quantity
   * @param neededUnit Unit of needed quantity
   * @returns Shortage amount and unit, or null if incompatible units
   */
  calculateShortage(
    available: number,
    availableUnit: Unit,
    needed: number,
    neededUnit: Unit
  ): { shortage: number; unit: Unit } | null {
    const availableInNeededUnit = this.convert(available, availableUnit, neededUnit);
    if (availableInNeededUnit === null) {
      return null; // Incompatible units
    }

    const shortage = Math.max(0, needed - availableInNeededUnit);
    return { shortage, unit: neededUnit };
  }

  /**
   * Get all supported units by type
   */
  getUnitsByType(type: 'weight' | 'volume' | 'count'): Unit[] {
    return Object.entries(this.conversions)
      .filter(([_, conv]) => conv.type === type)
      .map(([unit, _]) => unit as Unit);
  }

  /**
   * Get the type of a unit
   */
  getUnitType(unit: Unit): 'weight' | 'volume' | 'count' | null {
    return this.conversions[unit]?.type || null;
  }

  /**
   * Check if two units are compatible (same type)
   */
  areUnitsCompatible(unit1: Unit, unit2: Unit): boolean {
    const type1 = this.getUnitType(unit1);
    const type2 = this.getUnitType(unit2);
    return type1 !== null && type1 === type2;
  }

  /**
   * Sum quantities of the same ingredient with different units
   * @param items Array of {quantity, unit} objects
   * @param targetUnit Unit to sum into
   * @returns Total quantity in target unit, or null if any conversion fails
   */
  sumQuantities(
    items: Array<{ quantity: number; unit: Unit }>,
    targetUnit: Unit
  ): number | null {
    let total = 0;

    for (const item of items) {
      const converted = this.convert(item.quantity, item.unit, targetUnit);
      if (converted === null) return null;
      total += converted;
    }

    return total;
  }
}
