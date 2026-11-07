import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { NutritionReportsComponent } from './nutrition-reports.component';
import { NutritionService, WeeklyNutritionReport } from '../../core/services/nutrition.service';

function makeReport(overrides: Partial<WeeklyNutritionReport> = {}): WeeklyNutritionReport {
  return {
    startDate: '2026-01-05',
    endDate: '2026-01-11',
    dailySummaries: [],
    avgKcal: 0,
    avgProtein: 0,
    avgCarbs: 0,
    avgFat: 0,
    daysTracked: 0,
    goalAdherencePercent: 0,
    ...overrides,
  };
}

describe('NutritionReportsComponent', () => {
  let fixture: ComponentFixture<NutritionReportsComponent>;
  let component: NutritionReportsComponent;
  let nutritionSpy: { getWeeklySummary: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    nutritionSpy = { getWeeklySummary: vi.fn().mockReturnValue(makeReport()) };

    await TestBed.configureTestingModule({
      imports: [
        NutritionReportsComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [{ provide: NutritionService, useValue: nutritionSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(NutritionReportsComponent);
    component = fixture.componentInstance;
  });

  it('loads a report for the current week on construction', () => {
    expect(nutritionSpy.getWeeklySummary).toHaveBeenCalledTimes(1);
    expect(component.period()).toBe('thisWeek');
    expect(component.report()).toEqual(makeReport());
  });

  it('reloads for last week with a start date seven days earlier', () => {
    nutritionSpy.getWeeklySummary.mockClear();
    component.setPeriod('lastWeek');

    expect(component.period()).toBe('lastWeek');
    expect(nutritionSpy.getWeeklySummary).toHaveBeenCalledTimes(1);
    const [thisWeekStart] = nutritionSpy.getWeeklySummary.mock.calls[0];

    nutritionSpy.getWeeklySummary.mockClear();
    component.setPeriod('thisWeek');
    const [lastWeekStart] = nutritionSpy.getWeeklySummary.mock.calls[0];

    const diffDays = (Date.parse(lastWeekStart) - Date.parse(thisWeekStart)) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });

  it('starts the week on Monday regardless of the current day', () => {
    const call = nutritionSpy.getWeeklySummary.mock.calls[0][0];
    const weekday = new Date(`${call}T00:00:00`).getDay();
    expect(weekday).toBe(1);
  });

  describe('getBarHeight', () => {
    it('scales a value relative to the highest daily total', () => {
      const report = makeReport({ dailySummaries: [{ totalKcal: 1000 } as any, { totalKcal: 2000 } as any] });
      expect(component.getBarHeight(1000, report)).toBe(50);
      expect(component.getBarHeight(2000, report)).toBe(100);
    });

    it('avoids division by zero when every day is empty', () => {
      const report = makeReport({ dailySummaries: [{ totalKcal: 0 } as any] });
      expect(component.getBarHeight(0, report)).toBe(0);
    });
  });
});
