import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { RecipeImportService } from './recipe-import.service';
import { IngredientMatchingService } from './ingredient-matching.service';

describe('RecipeImportService', () => {
  let service: RecipeImportService;
  let http: { get: ReturnType<typeof vi.fn> };
  let matcher: { extractQuantityAndUnit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    http = { get: vi.fn() };
    matcher = {
      extractQuantityAndUnit: vi.fn((original: string) => ({
        quantity: 1,
        unit: 'pcs',
        ingredient: original,
      })),
    };
    TestBed.configureTestingModule({
      providers: [
        RecipeImportService,
        { provide: HttpClient, useValue: http },
        { provide: IngredientMatchingService, useValue: matcher },
      ],
    });
    service = TestBed.inject(RecipeImportService);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['https://example.com/recipe', true],
    ['http://localhost/recipe', false],
    ['https://127.0.0.1/recipe', false],
    ['https://192.168.1.10/recipe', false],
    ['not-a-url', false],
  ])('validates %s as %s', (url, expected) => {
    expect(service.isValidUrl(url)).toBe(expected);
  });

  it('rejects private URLs without making an HTTP request', async () => {
    await expect(service.importFromUrl('http://localhost/private')).rejects.toThrow(
      'Failed to import recipe'
    );
    expect(http.get).not.toHaveBeenCalled();
  });

  it('imports a Schema.org recipe from the first successful proxy', async () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Recipe',
      name: 'Tomato Soup',
      recipeIngredient: ['2 tomatoes', '1 l water'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Cook everything.' }],
      recipeYield: '4 servings',
      prepTime: 'PT15M',
      cookTime: 'PT30M',
    })}</script>`;
    http.get
      .mockReturnValueOnce(throwError(() => new Error('proxy unavailable')))
      .mockReturnValueOnce(of(html));

    const recipe = await service.importFromUrl('https://example.com/soup');

    expect(recipe.name).toBe('Tomato Soup');
    expect(recipe.ingredients).toEqual(['2 tomatoes', '1 l water']);
    expect(recipe.instructions).toBe('1. Cook everything.');
    expect(recipe.servings).toBe(4);
    expect(recipe.prepTime).toBe(15);
    expect(recipe.cookTime).toBe(30);
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('maps imported ingredient quantities through the matching service', () => {
    const result = service.parseIngredientsWithQuantities(['2 tomatoes', 'salt to taste']);

    expect(matcher.extractQuantityAndUnit).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { original: '2 tomatoes', quantity: 1, unit: 'pcs', ingredientName: '2 tomatoes' },
      { original: 'salt to taste', quantity: 1, unit: 'pcs', ingredientName: 'salt to taste' },
    ]);
  });
});
