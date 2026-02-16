import { Injectable, inject } from '@angular/core';
import { DbService } from './db.service';
import * as levenshtein from 'fast-levenshtein';

export interface IngredientMatch {
  ingredientId: string;
  name: string;
  score: number; // 0-100, higher is better
  isExactMatch: boolean;
}

export interface IngredientMappingResult {
  original: string;
  matches: IngredientMatch[];
  bestMatch: IngredientMatch | null;
  needsReview: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class IngredientMatchingService {
  private db = inject(DbService);

  // Threshold for automatic matching (70% similarity)
  private readonly AUTO_MATCH_THRESHOLD = 70;

  /**
   * Find matching ingredients for an imported ingredient name
   */
  findMatches(ingredientName: string, limit: number = 5): IngredientMatch[] {
    const normalized = this.normalizeIngredientName(ingredientName);
    const allIngredients = this.db.queryByUser<{ id: string; name: string }>('ingredients');

    if (allIngredients.length === 0) {
      return [];
    }

    // Calculate similarity scores
    const matches = allIngredients.map(ingredient => {
      const normalizedDbName = this.normalizeIngredientName(ingredient.name);
      const score = this.calculateSimilarity(normalized, normalizedDbName);
      const isExactMatch = normalized === normalizedDbName;

      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        score,
        isExactMatch,
      };
    });

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    // Return top matches
    return matches.slice(0, limit);
  }

  /**
   * Map multiple ingredient names to existing ingredients
   */
  mapIngredients(ingredientNames: string[]): IngredientMappingResult[] {
    return ingredientNames.map(name => {
      const matches = this.findMatches(name);
      const bestMatch = matches.length > 0 ? matches[0] : null;
      const needsReview = !bestMatch || bestMatch.score < this.AUTO_MATCH_THRESHOLD;

      return {
        original: name,
        matches,
        bestMatch,
        needsReview,
      };
    });
  }

  /**
   * Create a new ingredient from an imported name
   */
  createIngredientFromImport(name: string, categoryId?: string): string {
    const normalized = this.capitalizeWords(name.trim());
    const id = `ing-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date().toISOString();

    this.db.exec(
      `INSERT INTO ingredients (id, name, categoryId, userId, version, isDeleted, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        normalized,
        categoryId || null,
        this.db.getCurrentUserId(),
        1,
        0,
        now,
        now,
      ]
    );

    return id;
  }

  /**
   * Normalize ingredient name for comparison
   */
  private normalizeIngredientName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      // Remove common descriptors
      .replace(/\b(fresh|frozen|dried|canned|chopped|diced|minced|sliced)\b/gi, '')
      // Remove quantities and units
      .replace(/\d+(\.\d+)?\s*(cup|tablespoon|teaspoon|tbsp|tsp|oz|lb|g|kg|ml|l)s?\b/gi, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate similarity score between two strings (0-100)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 100;
    if (!str1 || !str2) return 0;

    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 100;

    const distance = levenshtein.get(str1, str2);
    const similarity = ((maxLength - distance) / maxLength) * 100;

    // Boost score for substring matches
    if (str1.includes(str2) || str2.includes(str1)) {
      return Math.min(100, similarity + 20);
    }

    // Boost score for word matches
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word)).length;
    const wordBoost = (commonWords / Math.max(words1.length, words2.length)) * 20;

    return Math.min(100, similarity + wordBoost);
  }

  /**
   * Capitalize first letter of each word
   */
  private capitalizeWords(str: string): string {
    return str.replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Extract quantity and unit from ingredient text
   */
  extractQuantityAndUnit(ingredientText: string): {
    quantity: number;
    unit: string;
    ingredient: string;
  } {
    const text = ingredientText.trim();

    // Common patterns: "2 cups flour", "1/2 cup milk", "3.5 oz chicken"
    const patterns = [
      // Fraction: "1/2 cup"
      /^(\d+\/\d+)\s+(cup|tablespoon|teaspoon|tbsp|tsp|oz|lb|g|kg|ml|l)s?\s+(.+)/i,
      // Decimal: "1.5 cups"
      /^(\d+\.?\d*)\s+(cup|tablespoon|teaspoon|tbsp|tsp|oz|lb|g|kg|ml|l)s?\s+(.+)/i,
      // Range: "2-3 cups"
      /^(\d+)-\d+\s+(cup|tablespoon|teaspoon|tbsp|tsp|oz|lb|g|kg|ml|l)s?\s+(.+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let quantity = 1;
        const unit = match[2].toLowerCase();
        const ingredient = match[3].trim();

        // Parse quantity
        if (match[1].includes('/')) {
          const [num, denom] = match[1].split('/').map(Number);
          quantity = num / denom;
        } else {
          quantity = parseFloat(match[1]);
        }

        return { quantity, unit, ingredient };
      }
    }

    // No quantity/unit found, assume 1 piece
    return {
      quantity: 1,
      unit: 'piece',
      ingredient: text,
    };
  }

  /**
   * Parse ingredient list text (one per line or comma-separated)
   */
  parseIngredientList(text: string): string[] {
    // Split by newlines or semicolons
    const lines = text.split(/[\n;]+/).map(line => line.trim()).filter(line => line.length > 0);

    // Further split by commas if no newlines were found
    if (lines.length === 1 && lines[0].includes(',')) {
      return lines[0].split(',').map(item => item.trim()).filter(item => item.length > 0);
    }

    return lines;
  }
}
