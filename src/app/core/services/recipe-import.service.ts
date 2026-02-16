import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IngredientMatchingService } from './ingredient-matching.service';

export interface ImportedRecipe {
  name: string;
  ingredients: string[];
  instructions: string;
  prepTime?: number; // minutes
  cookTime?: number; // minutes
  totalTime?: number; // minutes
  servings?: number;
  description?: string;
  imageUrl?: string;
  sourceUrl: string;
  sourceName?: string;
}

export interface ParsedIngredient {
  original: string;
  quantity: number;
  unit: string;
  ingredientName: string;
}

@Injectable({
  providedIn: 'root',
})
export class RecipeImportService {
  private http = inject(HttpClient);
  private ingredientMatcher = inject(IngredientMatchingService);

  /**
   * Import recipe from URL
   * Note: This requires a CORS proxy or backend endpoint to fetch the HTML
   */
  async importFromUrl(url: string): Promise<ImportedRecipe> {
    try {
      // In a production app, you would use a backend proxy to avoid CORS issues
      // For now, we'll use a CORS proxy service
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

      const html = await firstValueFrom(this.http.get(proxyUrl, { responseType: 'text' }));

      const recipe = this.parseRecipeFromHtml(html, url);

      if (!recipe) {
        throw new Error('Could not find recipe data on this page');
      }

      return recipe;
    } catch (error) {
      console.error('Failed to import recipe:', error);
      throw new Error('Failed to import recipe. Make sure the URL is accessible and contains a valid recipe.');
    }
  }

  /**
   * Parse recipe from HTML content
   */
  private parseRecipeFromHtml(html: string, sourceUrl: string): ImportedRecipe | null {
    // Try Schema.org JSON-LD first (most common on recipe sites)
    const jsonLdRecipe = this.parseSchemaOrgJsonLd(html, sourceUrl);
    if (jsonLdRecipe) {
      return jsonLdRecipe;
    }

    // Try microdata format
    const microdataRecipe = this.parseMicrodata(html, sourceUrl);
    if (microdataRecipe) {
      return microdataRecipe;
    }

    return null;
  }

  /**
   * Parse Schema.org JSON-LD markup
   */
  private parseSchemaOrgJsonLd(html: string, sourceUrl: string): ImportedRecipe | null {
    try {
      // Extract JSON-LD script tags
      const scriptMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

      for (const match of scriptMatches) {
        try {
          const json = JSON.parse(match[1]);

          // Handle both single objects and arrays
          const recipes = Array.isArray(json) ? json : [json];

          for (const item of recipes) {
            // Check if it's a Recipe type (or graph containing Recipe)
            if (item['@type'] === 'Recipe') {
              return this.extractRecipeFromSchemaOrg(item, sourceUrl);
            } else if (item['@graph']) {
              // Some sites use @graph array
              const recipe = item['@graph'].find((node: any) => node['@type'] === 'Recipe');
              if (recipe) {
                return this.extractRecipeFromSchemaOrg(recipe, sourceUrl);
              }
            }
          }
        } catch (e) {
          // Invalid JSON in this script tag, continue to next
          continue;
        }
      }
    } catch (error) {
      console.warn('Error parsing JSON-LD:', error);
    }

    return null;
  }

  /**
   * Extract recipe data from Schema.org object
   */
  private extractRecipeFromSchemaOrg(data: any, sourceUrl: string): ImportedRecipe {
    // Parse ingredients
    const ingredients = this.parseIngredients(data.recipeIngredient || []);

    // Parse instructions
    const instructions = this.parseInstructions(data.recipeInstructions || []);

    // Parse times (convert ISO 8601 duration to minutes)
    const prepTime = this.parseDuration(data.prepTime);
    const cookTime = this.parseDuration(data.cookTime);
    const totalTime = this.parseDuration(data.totalTime);

    // Parse servings
    const servings = this.parseServings(data.recipeYield);

    // Get image URL
    const imageUrl = this.extractImageUrl(data.image);

    return {
      name: data.name || 'Untitled Recipe',
      ingredients,
      instructions,
      prepTime,
      cookTime,
      totalTime,
      servings,
      description: data.description,
      imageUrl,
      sourceUrl,
      sourceName: this.extractDomain(sourceUrl),
    };
  }

  /**
   * Parse microdata format (fallback)
   */
  private parseMicrodata(html: string, sourceUrl: string): ImportedRecipe | null {
    // This is a simplified parser - in production you'd use a proper HTML parser
    // For now, we'll just extract basic info using regex

    const nameMatch = html.match(/<[^>]*itemprop=["']name["'][^>]*>([^<]+)</i);
    const name = nameMatch ? nameMatch[1].trim() : 'Untitled Recipe';

    // Extract ingredients
    const ingredientMatches = html.matchAll(/<[^>]*itemprop=["']recipeIngredient["'][^>]*>([^<]+)</gi);
    const ingredients = Array.from(ingredientMatches, m => m[1].trim());

    // Extract instructions
    const instructionMatches = html.matchAll(/<[^>]*itemprop=["']recipeInstructions["'][^>]*>([\s\S]*?)<\//gi);
    const instructions = Array.from(instructionMatches, m => this.stripHtml(m[1])).join('\n\n');

    if (ingredients.length === 0) {
      return null; // Not a valid recipe
    }

    return {
      name,
      ingredients,
      instructions: instructions || 'No instructions available',
      sourceUrl,
      sourceName: this.extractDomain(sourceUrl),
    };
  }

  /**
   * Parse ingredients array
   */
  private parseIngredients(ingredients: any): string[] {
    if (Array.isArray(ingredients)) {
      return ingredients.map(ing => {
        if (typeof ing === 'string') {
          return ing.trim();
        } else if (ing.text) {
          return ing.text.trim();
        }
        return '';
      }).filter(ing => ing.length > 0);
    }

    if (typeof ingredients === 'string') {
      return [ingredients.trim()];
    }

    return [];
  }

  /**
   * Parse instructions (can be string, array of strings, or HowToStep objects)
   */
  private parseInstructions(instructions: any): string {
    if (typeof instructions === 'string') {
      return this.stripHtml(instructions);
    }

    if (Array.isArray(instructions)) {
      return instructions.map((step, index) => {
        if (typeof step === 'string') {
          return `${index + 1}. ${this.stripHtml(step)}`;
        } else if (step.text) {
          return `${index + 1}. ${this.stripHtml(step.text)}`;
        } else if (step['@type'] === 'HowToStep' && step.text) {
          return `${index + 1}. ${this.stripHtml(step.text)}`;
        }
        return '';
      }).filter(step => step.length > 0).join('\n\n');
    }

    if (instructions.text) {
      return this.stripHtml(instructions.text);
    }

    return 'No instructions available';
  }

  /**
   * Parse ISO 8601 duration to minutes
   */
  private parseDuration(duration?: string): number | undefined {
    if (!duration) return undefined;

    // ISO 8601 format: PT1H30M = 1 hour 30 minutes
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (match) {
      const hours = parseInt(match[1] || '0', 10);
      const minutes = parseInt(match[2] || '0', 10);
      return hours * 60 + minutes;
    }

    return undefined;
  }

  /**
   * Parse servings (can be number or string like "4 servings")
   */
  private parseServings(yield_?: any): number | undefined {
    if (!yield_) return undefined;

    if (typeof yield_ === 'number') {
      return yield_;
    }

    if (typeof yield_ === 'string') {
      const match = yield_.match(/\d+/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }

    if (Array.isArray(yield_) && yield_.length > 0) {
      return this.parseServings(yield_[0]);
    }

    return undefined;
  }

  /**
   * Extract image URL from various formats
   */
  private extractImageUrl(image: any): string | undefined {
    if (!image) return undefined;

    if (typeof image === 'string') {
      return image;
    }

    if (image.url) {
      return image.url;
    }

    if (Array.isArray(image) && image.length > 0) {
      return this.extractImageUrl(image[0]);
    }

    return undefined;
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Extract domain name from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return 'Unknown Source';
    }
  }

  /**
   * Parse ingredients with quantities
   */
  parseIngredientsWithQuantities(ingredients: string[]): ParsedIngredient[] {
    return ingredients.map(original => {
      const parsed = this.ingredientMatcher.extractQuantityAndUnit(original);
      return {
        original,
        quantity: parsed.quantity,
        unit: parsed.unit,
        ingredientName: parsed.ingredient,
      };
    });
  }

  /**
   * Validate URL format
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
