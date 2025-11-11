import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { DbService } from '../../core/services/db.service';
import { Ingredient } from '../../core/models/ingredient.model';

@Component({
  standalone: true,
  selector: 'pp-ingredient-edit',
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
  <h2 mat-dialog-title>{{model?.id ? 'Edit' : 'Add'}} Ingredient</h2>
  <div mat-dialog-content class="form">
    <mat-form-field appearance="outline"><mat-label>Name</mat-label>
      <input matInput [(ngModel)]="model.name">
    </mat-form-field>
    <mat-form-field appearance="outline"><mat-label>Category ID</mat-label>
      <input matInput [(ngModel)]="model.categoryId">
    </mat-form-field>
    <mat-form-field appearance="outline"><mat-label>Default Shelf Life (days)</mat-label>
      <input matInput type="number" [(ngModel)]="model.defaultShelfLifeDays">
    </mat-form-field>
    <mat-form-field appearance="outline"><mat-label>Notify Start (days before)</mat-label>
      <input matInput type="number" [(ngModel)]="model.notifyStartDays">
    </mat-form-field>
    <mat-form-field appearance="outline"><mat-label>Notify Repeat (days)</mat-label>
      <input matInput type="number" [(ngModel)]="model.notifyRepeatDays">
    </mat-form-field>
  </div>
  <div mat-dialog-actions>
    <button mat-button (click)="close()">Cancel</button>
    <button mat-flat-button color="primary" (click)="save()">Save</button>
  </div>
  `,
  styles: [`.form{display:grid;gap:12px;min-width:280px}`]
})
export class IngredientEditDialog {
  private db = inject(DbService);
  model: any = { id:'', name:'', categoryId:'', defaultShelfLifeDays: null, notifyStartDays: 3, notifyRepeatDays: 1 };
  constructor(@Inject(MAT_DIALOG_DATA) public data: Ingredient | null, private ref: MatDialogRef<IngredientEditDialog>) {
    if (data) this.model = { ...data };
  }
  save(){
    if (!this.model.id) {
      this.model.id = `ing-${crypto.randomUUID()}`;
      this.db.exec('INSERT INTO ingredients (id, name, categoryId, defaultShelfLifeDays, notifyStartDays, notifyRepeatDays) VALUES (?,?,?,?,?,?)',
        [this.model.id, this.model.name, this.model.categoryId || null, this.model.defaultShelfLifeDays ?? null, this.model.notifyStartDays ?? null, this.model.notifyRepeatDays ?? null]);
    } else {
      this.db.exec('UPDATE ingredients SET name=?, categoryId=?, defaultShelfLifeDays=?, notifyStartDays=?, notifyRepeatDays=? WHERE id=?',
        [this.model.name, this.model.categoryId || null, this.model.defaultShelfLifeDays ?? null, this.model.notifyStartDays ?? null, this.model.notifyRepeatDays ?? null, this.model.id]);
    }
    this.ref.close(true);
  }
  close(){ this.ref.close(false); }
}
