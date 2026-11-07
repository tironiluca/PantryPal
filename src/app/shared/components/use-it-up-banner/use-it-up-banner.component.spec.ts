import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { UseItUpBannerComponent } from './use-it-up-banner.component';
import { DietAdviceService } from '../../../core/services/diet-advice.service';

describe('UseItUpBannerComponent', () => {
  let fixture: ComponentFixture<UseItUpBannerComponent>;
  let component: UseItUpBannerComponent;
  let dietAdviceSpy: { getUseItUpSuggestions: ReturnType<typeof vi.fn> };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [
        UseItUpBannerComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [provideRouter([]), { provide: DietAdviceService, useValue: dietAdviceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(UseItUpBannerComponent);
    component = fixture.componentInstance;
  }

  it('shows a banner with expiring items and matched recipes', async () => {
    dietAdviceSpy = {
      getUseItUpSuggestions: vi.fn().mockReturnValue({
        expiringItems: [{ id: 'i1', name: 'Milk', expiry: '2026-01-01', daysLeft: 1 }],
        matchedRecipes: [{ recipeId: 'r1', recipeName: 'Pancakes', matchCount: 1 }],
      }),
    };
    await setup();
    fixture.detectChanges();

    expect(component.suggestion()).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Milk');
    expect(fixture.nativeElement.textContent).toContain('Pancakes');
  });

  it('stays hidden when there are no expiring items', async () => {
    dietAdviceSpy = {
      getUseItUpSuggestions: vi.fn().mockReturnValue({ expiringItems: [], matchedRecipes: [] }),
    };
    await setup();
    fixture.detectChanges();

    expect(component.suggestion()).toBeNull();
    expect(fixture.nativeElement.querySelector('.use-it-up-banner')).toBeNull();
  });

  it('silently skips when the lookup throws', async () => {
    dietAdviceSpy = { getUseItUpSuggestions: vi.fn().mockImplementation(() => { throw new Error('db not ready'); }) };
    await setup();
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component.suggestion()).toBeNull();
  });

  it('dismisses the banner and hides it', async () => {
    dietAdviceSpy = {
      getUseItUpSuggestions: vi.fn().mockReturnValue({
        expiringItems: [{ id: 'i1', name: 'Milk', expiry: '2026-01-01', daysLeft: -1 }],
        matchedRecipes: [],
      }),
    };
    await setup();
    fixture.detectChanges();

    component.dismiss();
    fixture.detectChanges();

    expect(component.dismissed()).toBe(true);
    expect(fixture.nativeElement.querySelector('.use-it-up-banner')).toBeNull();
  });

  it('marks an expired item distinctly from one still within the window', async () => {
    dietAdviceSpy = {
      getUseItUpSuggestions: vi.fn().mockReturnValue({
        expiringItems: [{ id: 'i1', name: 'Yogurt', expiry: '2020-01-01', daysLeft: -2 }],
        matchedRecipes: [],
      }),
    };
    await setup();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.expiry-expired')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.expiry-warning')).toBeNull();
  });
});
