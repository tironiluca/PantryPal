import { Component, inject, Inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoModule } from '@jsverse/transloco';
import { NutritionService } from '../../core/services/nutrition.service';

@Component({
  selector: 'pp-nutrition-goals-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
    TranslocoModule,
  ],
  templateUrl: './nutrition-goals.dialog.html',
  styleUrls: ['./nutrition-goals.dialog.scss'],
})
export class NutritionGoalsDialog {
  private dialogRef = inject(MatDialogRef<NutritionGoalsDialog>);
  private nutritionService = inject(NutritionService);
  goals: any;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { goals: any; isEdit: boolean }) {
    this.goals = { ...data.goals };
  }

  onPresetChange(type: string): void {
    if (type !== 'custom') {
      const preset = this.nutritionService.getPresetGoals(type);
      Object.assign(this.goals, preset);
    }
  }

  save() {
    this.dialogRef.close(this.goals);
  }
}
