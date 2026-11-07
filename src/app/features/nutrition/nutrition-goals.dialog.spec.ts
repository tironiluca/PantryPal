import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { NutritionGoalsDialog } from './nutrition-goals.dialog';
import { NutritionService } from '../../core/services/nutrition.service';

describe('NutritionGoalsDialog', () => {
  let fixture: ComponentFixture<NutritionGoalsDialog>;
  let component: NutritionGoalsDialog;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let nutritionSpy: { getPresetGoals: ReturnType<typeof vi.fn> };
  const initialGoals = { dailyKcalGoal: 2000, proteinGoal: 100, carbsGoal: 250, fatGoal: 65, goalType: 'custom' };

  async function setup(data: { goals: any; isEdit: boolean }) {
    dialogRefSpy = { close: vi.fn() };
    nutritionSpy = { getPresetGoals: vi.fn().mockReturnValue({ dailyKcalGoal: 1500, proteinGoal: 100, carbsGoal: 150, fatGoal: 50, goalType: 'weight_loss' }) };

    await TestBed.configureTestingModule({
      imports: [
        NutritionGoalsDialog,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: NutritionService, useValue: nutritionSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NutritionGoalsDialog);
    component = fixture.componentInstance;
  }

  it('clones the provided goals so the dialog does not mutate the caller data', async () => {
    await setup({ goals: initialGoals, isEdit: true });
    expect(component.goals).toEqual(initialGoals);
    expect(component.goals).not.toBe(initialGoals);
  });

  it('applies a preset onto the working goals when a non-custom type is chosen', async () => {
    await setup({ goals: initialGoals, isEdit: false });
    component.onPresetChange('weight_loss');
    expect(nutritionSpy.getPresetGoals).toHaveBeenCalledWith('weight_loss');
    expect(component.goals.dailyKcalGoal).toBe(1500);
    expect(component.goals.goalType).toBe('weight_loss');
  });

  it('leaves custom goals untouched when the custom type is chosen', async () => {
    await setup({ goals: initialGoals, isEdit: false });
    component.onPresetChange('custom');
    expect(nutritionSpy.getPresetGoals).not.toHaveBeenCalled();
    expect(component.goals).toEqual(initialGoals);
  });

  it('closes the dialog with the edited goals on save', async () => {
    await setup({ goals: initialGoals, isEdit: true });
    component.goals.dailyKcalGoal = 2200;
    component.save();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(component.goals);
    expect(dialogRefSpy.close).toHaveBeenCalledWith(expect.objectContaining({ dailyKcalGoal: 2200 }));
  });
});
