import { Component, Inject, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { DbService } from '../../core/services/db.service';

@Component({
  standalone: true,
  selector: 'pp-recipe-edit',
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
  <h2 mat-dialog-title>{{model?.id ? 'Edit' : 'Add'}} Recipe</h2>
  <div mat-dialog-content class="form">
    <mat-form-field appearance="outline"><mat-label>Name</mat-label>
      <input matInput [(ngModel)]="model.name">
    </mat-form-field>
    <mat-form-field appearance="outline"><mat-label>Steps (one per line)</mat-label>
      <textarea matInput rows="4" [(ngModel)]="stepsText"></textarea>
    </mat-form-field>
    <mat-form-field appearance="outline"><mat-label>Ingredients (ingredientId:qty:unit per line)</mat-label>
      <textarea matInput rows="4" [(ngModel)]="ingsText"></textarea>
    </mat-form-field>
  </div>
  <div mat-dialog-actions>
    <button mat-button (click)="close()">Cancel</button>
    <button mat-flat-button color="primary" (click)="save()">Save</button>
  </div>
  `,
  styles: [`.form{display:grid;gap:12px;min-width:320px}`]
})
export class RecipeEditDialog {
  private db = inject(DbService);
  model: any = { id: '', name: '' };
  stepsText = '';
  ingsText = '';

  constructor(@Inject(MAT_DIALOG_DATA) public data: any, private ref: MatDialogRef<RecipeEditDialog>) {
    if (data) {
      this.model = { ...data };
      const steps = this.db.query<any>('SELECT steps FROM recipes WHERE id = ?', [data.id])[0]?.steps || '[]';
      this.stepsText = JSON.parse(steps).join('\n');
      const ingRows = this.db.query<any>('SELECT ingredientId, quantity, unit FROM recipe_ingredients WHERE recipeId = ?', [data.id]);
      this.ingsText = ingRows.map((r:any)=>`${r.ingredientId}:${r.quantity}:${r.unit}`).join('\n');
    }
  }

  save() {
    if (!this.model.id) {
      this.model.id = `rec-${crypto.randomUUID()}`;
      this.db.exec('INSERT INTO recipes (id, name, steps) VALUES (?,?,?)', [this.model.id, this.model.name, JSON.stringify(this.stepsText.split('\n').filter(Boolean))]);
    } else {
      this.db.exec('UPDATE recipes SET name=?, steps=? WHERE id=?', [this.model.name, JSON.stringify(this.stepsText.split('\n').filter(Boolean)), this.model.id]);
      this.db.exec('DELETE FROM recipe_ingredients WHERE recipeId = ?', [this.model.id]);
    }
    const lines = this.ingsText.split('\n').map(l=>l.trim()).filter(Boolean);
    for (const l of lines) {
      const [ingredientId, q, u] = l.split(':');
      this.db.exec('INSERT INTO recipe_ingredients (recipeId, ingredientId, quantity, unit) VALUES (?,?,?,?)', [this.model.id, ingredientId, Number(q||1), u||'pcs']);
    }
    this.ref.close(true);
  }
  close(){ this.ref.close(false); }
}
