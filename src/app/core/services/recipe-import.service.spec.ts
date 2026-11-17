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

  it('numbers steps across HowToSection groups, plain strings and HowToStep objects', async () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Recipe',
      name: 'Layer Cake',
      recipeIngredient: ['flour'],
      recipeInstructions: [
        { '@type': 'HowToSection', name: 'Cake', itemListElement: [
          { '@type': 'HowToStep', text: 'Mix the <b>batter</b>.' },
          { '@type': 'HowToStep', text: 'Bake.' },
        ] },
        { '@type': 'HowToSection', name: 'Frosting', itemListElement: [{ '@type': 'HowToStep', text: 'Whip cream.' }] },
        'Assemble.',
        { '@type': 'HowToStep' },
      ],
    })}</script>`;
    http.get.mockReturnValueOnce(of(html));

    const recipe = await service.importFromUrl('https://example.com/cake');

    expect(recipe.instructions).toBe('1. Mix the batter.\n\n2. Bake.\n\n3. Whip cream.\n\n4. Assemble.');
  });

  describe('first-party recipe fetcher', () => {
    const recipeHtml = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'Soup', recipeIngredient: ['water'] })}</script>`;
    let invoke: ReturnType<typeof vi.fn>;

    const signedIn = (result: unknown) => {
      invoke = vi.fn().mockResolvedValue(result);
      (service as any).auth = { isAuthenticated: () => true, getSupabaseClient: () => ({ functions: { invoke } }) };
    };

    it('uses the edge function and never contacts third-party proxies when it succeeds', async () => {
      signedIn({ data: { html: recipeHtml }, error: null });

      const recipe = await service.importFromUrl('https://example.com/soup');

      expect(invoke).toHaveBeenCalledWith('recipe-proxy', { body: { url: 'https://example.com/soup' } });
      expect(recipe.name).toBe('Soup');
      expect(http.get).not.toHaveBeenCalled();
    });

    it('falls back to the proxies when the function is not deployed', async () => {
      signedIn({ data: null, error: { context: new Response('{}', { status: 404 }) } });
      http.get.mockReturnValueOnce(of(recipeHtml));

      const recipe = await service.importFromUrl('https://example.com/soup');

      expect(recipe.name).toBe('Soup');
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('falls back when the function call itself throws', async () => {
      signedIn(undefined);
      invoke.mockRejectedValue(new Error('network'));
      http.get.mockReturnValueOnce(of(recipeHtml));

      await expect(service.importFromUrl('https://example.com/soup')).resolves.toMatchObject({ name: 'Soup' });
    });

    it('does not send a URL the function refused to third-party proxies', async () => {
      signedIn({ data: null, error: { context: new Response(JSON.stringify({ error: 'Local network addresses are not supported' }), { status: 400 }) } });

      await expect(service.importFromUrl('https://intranet.example.com/a')).rejects.toThrow(
        'Failed to import recipe: Local network addresses are not supported'
      );
      expect(http.get).not.toHaveBeenCalled();
    });

    it('skips the function when signed out', async () => {
      invoke = vi.fn();
      (service as any).auth = { isAuthenticated: () => false, getSupabaseClient: () => ({ functions: { invoke } }) };
      http.get.mockReturnValueOnce(of(recipeHtml));

      await service.importFromUrl('https://example.com/soup');

      expect(invoke).not.toHaveBeenCalled();
    });
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
