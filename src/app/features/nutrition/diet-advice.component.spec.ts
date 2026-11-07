import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { DietAdviceComponent } from './diet-advice.component';
import { DietAdviceService } from '../../core/services/diet-advice.service';
import { NutritionService } from '../../core/services/nutrition.service';

describe('DietAdviceComponent', () => {
  let fixture: ComponentFixture<DietAdviceComponent>;
  let component: DietAdviceComponent;
  let adviceSpy: { generateAdvice: ReturnType<typeof vi.fn> };
  let nutritionSpy: { getGoals: ReturnType<typeof vi.fn>; getDailyNutrition: ReturnType<typeof vi.fn> };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [
        DietAdviceComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: DietAdviceService, useValue: adviceSpy },
        { provide: NutritionService, useValue: nutritionSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DietAdviceComponent);
    component = fixture.componentInstance;
  }

  it('shows a prompt to set goals when none exist', async () => {
    nutritionSpy = { getGoals: vi.fn().mockReturnValue(null), getDailyNutrition: vi.fn() };
    adviceSpy = { generateAdvice: vi.fn() };
    await setup();
    fixture.detectChanges();

    expect(component.hasGoals()).toBe(false);
    expect(component.advice()).toBeNull();
    expect(nutritionSpy.getDailyNutrition).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.no-goals')).toBeTruthy();
  });

  it('generates advice from today\'s summary when goals exist', async () => {
    const goals = { dailyKcalGoal: 2000, proteinGoal: 100, carbsGoal: 250, fatGoal: 70 };
    const summary = { totalKcal: 1500 };
    const advice = {
      remainingKcal: 500,
      remainingProtein: 20,
      remainingCarbs: 50,
      remainingFat: 10,
      suggestedRecipes: [
        { recipeId: 'r1', recipeName: 'Omelette', energyKcal: 300, proteinG: 20, carbsG: 2, fatG: 15, fitScore: 80, pantryPercent: 100 },
      ],
      insights: ['Great protein intake today'],
      mealTypeRecommendation: 'dinner' as const,
    };
    nutritionSpy = { getGoals: vi.fn().mockReturnValue(goals), getDailyNutrition: vi.fn().mockReturnValue(summary) };
    adviceSpy = { generateAdvice: vi.fn().mockReturnValue(advice) };
    await setup();
    fixture.detectChanges();

    expect(component.hasGoals()).toBe(true);
    expect(nutritionSpy.getDailyNutrition).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(adviceSpy.generateAdvice).toHaveBeenCalledWith(summary, goals);
    expect(component.advice()).toEqual(advice);
    expect(fixture.nativeElement.textContent).toContain('Omelette');
    expect(fixture.nativeElement.textContent).toContain('Great protein intake today');
  });

  describe('getFitClass', () => {
    beforeEach(async () => {
      nutritionSpy = { getGoals: vi.fn().mockReturnValue(null), getDailyNutrition: vi.fn() };
      adviceSpy = { generateAdvice: vi.fn() };
      await setup();
    });

    it('returns fit-high for a score of 70 or above', () => {
      expect(component.getFitClass(70)).toBe('fit-high');
      expect(component.getFitClass(95)).toBe('fit-high');
    });

    it('returns fit-mid for a score between 40 and 69', () => {
      expect(component.getFitClass(40)).toBe('fit-mid');
      expect(component.getFitClass(69)).toBe('fit-mid');
    });

    it('returns fit-low for a score below 40', () => {
      expect(component.getFitClass(0)).toBe('fit-low');
      expect(component.getFitClass(39)).toBe('fit-low');
    });
  });
});
