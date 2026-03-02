import { Component, inject, OnInit, signal } from '@angular/core';

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
  templateUrl: './household-settings.component.html',
  styleUrls: ['./household-settings.component.scss'],
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
