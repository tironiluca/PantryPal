import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoModule } from '@jsverse/transloco';
import { HouseholdService } from '../../core/services/household.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';

@Component({
  standalone: true,
  selector: 'pp-household-settings',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
    TranslocoModule,
  ],
  template: `
    <div class="household-container" *transloco="let t">
      @if (householdService.loading()) {
        <div class="loading"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (householdService.household(); as hh) {
        <!-- Current household -->
        <mat-card>
          <mat-card-header>
            <mat-icon mat-card-avatar>group</mat-icon>
            <mat-card-title>{{ hh.name }}</mat-card-title>
            <mat-card-subtitle>{{ t('settings.familySharing') }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <h4>{{ t('settings.members') }}</h4>
            <mat-list>
              @for (member of householdService.members(); track member.userId) {
                <mat-list-item>
                  <mat-icon matListItemIcon>person</mat-icon>
                  <span matListItemTitle>{{ member.userId }}</span>
                  <mat-chip matListItemMeta [color]="member.role === 'owner' ? 'primary' : 'default'" highlighted>
                    {{ member.role === 'owner' ? t('settings.owner') : t('settings.member') }}
                  </mat-chip>
                </mat-list-item>
              }
            </mat-list>

            <mat-divider></mat-divider>

            <!-- Invite member -->
            <div class="invite-row">
              <mat-form-field appearance="outline" class="invite-field">
                <mat-label>{{ t('settings.memberEmail') }}</mat-label>
                <input matInput type="email" [(ngModel)]="inviteEmail" (keyup.enter)="invite()" />
                <mat-icon matSuffix>mail</mat-icon>
              </mat-form-field>
              <button mat-raised-button color="accent" (click)="invite()" [disabled]="!inviteEmail">
                <mat-icon>person_add</mat-icon>
                {{ t('settings.inviteMember') }}
              </button>
            </div>
          </mat-card-content>
          <mat-card-actions>
            <button mat-stroked-button color="warn" (click)="leaveHousehold()">
              <mat-icon>exit_to_app</mat-icon>
              {{ t('settings.leaveHousehold') }}
            </button>
          </mat-card-actions>
        </mat-card>
      } @else {
        <!-- No household -->
        <mat-card>
          <mat-card-header>
            <mat-card-title>
              <mat-icon>group_add</mat-icon>
              {{ t('settings.familySharing') }}
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="description">Share your pantry with family members by creating a household.</p>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ t('settings.householdName') }}</mat-label>
              <input matInput [(ngModel)]="householdName" (keyup.enter)="createHousehold()" />
            </mat-form-field>
          </mat-card-content>
          <mat-card-actions>
            <button mat-raised-button color="primary" (click)="createHousehold()" [disabled]="!householdName">
              <mat-icon>group_add</mat-icon>
              {{ t('settings.createHousehold') }}
            </button>
          </mat-card-actions>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .household-container { display: flex; flex-direction: column; gap: var(--spacing-md); }
    .loading { display: flex; justify-content: center; padding: var(--spacing-xl); }
    .full-width { width: 100%; }
    mat-card-title { display: flex; align-items: center; gap: 8px; }
    mat-card-content { padding: var(--spacing-md); }
    h4 { margin: 0 0 var(--spacing-sm); font-size: 13px; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; }
    mat-divider { margin: var(--spacing-md) 0; }
    .invite-row {
      display: flex;
      gap: var(--spacing-sm);
      align-items: center;
      margin-top: var(--spacing-sm);
    }
    .invite-field { flex: 1; }
    .description { color: var(--text-secondary); font-size: 14px; margin-bottom: var(--spacing-md); }
  `]
})
export class HouseholdSettingsComponent implements OnInit {
  householdService = inject(HouseholdService);
  private errorHandler = inject(ErrorHandlerService);

  householdName = '';
  inviteEmail = '';

  ngOnInit(): void {
    this.householdService.loadHousehold();
  }

  async createHousehold(): Promise<void> {
    if (!this.householdName.trim()) return;
    try {
      await this.householdService.createHousehold(this.householdName.trim());
      this.householdName = '';
    } catch (err) {
      this.errorHandler.handle(err, 'Failed to create household');
    }
  }

  async invite(): Promise<void> {
    const email = this.inviteEmail.trim();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.errorHandler.handle(new Error('Invalid email'), 'Please enter a valid email address');
      return;
    }
    try {
      await this.householdService.inviteMember(email);
      this.inviteEmail = '';
    } catch (err) {
      this.errorHandler.handle(err, 'Failed to send invitation');
    }
  }

  async leaveHousehold(): Promise<void> {
    try {
      await this.householdService.leaveHousehold();
    } catch (err) {
      this.errorHandler.handle(err, 'Failed to leave household');
    }
  }
}
