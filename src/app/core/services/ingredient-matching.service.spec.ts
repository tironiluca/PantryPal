import { TestBed } from '@angular/core/testing';
import { IngredientMatchingService } from './ingredient-matching.service';
import { DbService } from './db.service';

describe('IngredientMatchingService', () => {
  let service: IngredientMatchingService;
  let dbSpy: {
    queryByUser: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
    getCurrentUserId: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    dbSpy = {
      queryByUser: vi.fn().mockReturnValue([]),
      exec: vi.fn(),
      getCurrentUserId: vi.fn().mockReturnValue('user-1'),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: DbService, useValue: dbSpy }],
    });
    service = TestBed.inject(IngredientMatchingService);
  });

  describe('findMatches', () => {
    it('returns an empty array when there are no ingredients to compare against', () => {
      dbSpy.queryByUser.mockReturnValue([]);
      expect(service.findMatches('Tomato')).toEqual([]);
    });

    it('ranks an exact (case/whitespace-insensitive) match first with score 100', () => {
      dbSpy.queryByUser.mockReturnValue([
        { id: 'i1', name: 'Chicken Breast' },
        { id: 'i2', name: '  tomato  ' },
      ]);

      const matches = service.findMatches('Tomato');

      expect(matches[0]).toMatchObject({ ingredientId: 'i2', score: 100, isExactMatch: true });
    });

    it('strips descriptors and quantities before comparing names', () => {
      dbSpy.queryByUser.mockReturnValue([{ id: 'i1', name: 'onion' }]);

      const matches = service.findMatches('2 cups diced onion');

      expect(matches[0]).toMatchObject({ ingredientId: 'i1', isExactMatch: true });
    });

    it('limits the number of returned matches', () => {
      dbSpy.queryByUser.mockReturnValue(
        Array.from({ length: 10 }, (_, i) => ({ id: `i${i}`, name: `ingredient-${i}` }))
      );

      expect(service.findMatches('ingredient-0', 3)).toHaveLength(3);
    });
  });

  describe('mapIngredients', () => {
    it('flags low-confidence matches as needing review', () => {
      dbSpy.queryByUser.mockReturnValue([{ id: 'i1', name: 'Zucchini' }]);

      const [result] = service.mapIngredients(['Completely Unrelated Item']);

      expect(result.needsReview).toBe(true);
    });

    it('does not flag a confident match as needing review', () => {
      dbSpy.queryByUser.mockReturnValue([{ id: 'i1', name: 'Zucchini' }]);

      const [result] = service.mapIngredients(['Zucchini']);

      expect(result.bestMatch?.ingredientId).toBe('i1');
      expect(result.needsReview).toBe(false);
    });

    it('flags as needing review when there are no ingredients at all', () => {
      dbSpy.queryByUser.mockReturnValue([]);

      const [result] = service.mapIngredients(['Anything']);

      expect(result.bestMatch).toBeNull();
      expect(result.needsReview).toBe(true);
    });
  });

  describe('extractQuantityAndUnit', () => {
    it('parses a decimal quantity with a unit', () => {
      expect(service.extractQuantityAndUnit('1.5 cups flour')).toEqual({
        quantity: 1.5,
        unit: 'cup',
        ingredient: 'flour',
      });
    });

    it('parses a fractional quantity', () => {
      const result = service.extractQuantityAndUnit('1/2 cup milk');
      expect(result.quantity).toBe(0.5);
      expect(result.unit).toBe('cup');
      expect(result.ingredient).toBe('milk');
    });

    it('parses a range by taking the lower bound', () => {
      const result = service.extractQuantityAndUnit('2-3 tbsp olive oil');
      expect(result.quantity).toBe(2);
      expect(result.unit).toBe('tbsp');
      expect(result.ingredient).toBe('olive oil');
    });

    it('falls back to 1 piece when no quantity/unit is present', () => {
      expect(service.extractQuantityAndUnit('salt to taste')).toEqual({
        quantity: 1,
        unit: 'piece',
        ingredient: 'salt to taste',
      });
    });
  });

  describe('parseIngredientList', () => {
    it('splits a newline-separated list', () => {
      expect(service.parseIngredientList('flour\nsugar\neggs')).toEqual([
        'flour',
        'sugar',
        'eggs',
      ]);
    });

    it('splits a comma-separated single line', () => {
      expect(service.parseIngredientList('flour, sugar, eggs')).toEqual([
        'flour',
        'sugar',
        'eggs',
      ]);
    });

    it('ignores blank lines', () => {
      expect(service.parseIngredientList('flour\n\nsugar\n')).toEqual(['flour', 'sugar']);
    });
  });

  describe('createIngredientFromImport', () => {
    it('capitalizes the name and inserts it via db.exec', () => {
      const id = service.createIngredientFromImport('red bell pepper', 'cat-1');

      expect(id).toMatch(/^ing-/);
      expect(dbSpy.exec).toHaveBeenCalledTimes(1);
      const [sql, params] = dbSpy.exec.mock.calls[0];
      expect(sql).toContain('INSERT INTO ingredients');
      expect(params[1]).toBe('Red Bell Pepper');
      expect(params[2]).toBe('cat-1');
    });
  });
});
