import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AuthService, UserProfile } from '../../../core/services/auth.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { SnackbarService } from '../../../core/services/snackbar.service';

@Component({
  selector: 'pp-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private profileService = inject(UserProfileService);
  private router = inject(Router);
  private snackbar = inject(SnackbarService);
  private dialog = inject(MatDialog);

  profile = signal<UserProfile | null>(null);
  loading = signal(true);
  saving = signal(false);

  // Editable fields
  displayName = '';
  email = '';
  avatarUrl = '';

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    this.loading.set(true);

    try {
      const profile = await this.profileService.getProfile();

      if (profile) {
        this.profile.set(profile);
        this.displayName = profile.displayName || '';
        this.email = profile.email;
        this.avatarUrl = profile.avatarUrl || '';
      }
    } finally {
      this.loading.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    this.saving.set(true);

    try {
      const success = await this.profileService.updateProfile({
        displayName: this.displayName,
      });

      if (success) {
        await this.loadProfile();
      }
    } finally {
      this.saving.set(false);
    }
  }

  async onAvatarFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    this.saving.set(true);

    try {
      const avatarUrl = await this.profileService.uploadAvatar(file);

      if (avatarUrl) {
        this.avatarUrl = avatarUrl;
        await this.loadProfile();
      }
    } finally {
      this.saving.set(false);
    }
  }

  async removeAvatar(): Promise<void> {
    const confirmed = confirm('Are you sure you want to remove your avatar?');

    if (!confirmed) {
      return;
    }

    this.saving.set(true);

    try {
      const success = await this.profileService.deleteAvatar();

      if (success) {
        this.avatarUrl = '';
        await this.loadProfile();
      }
    } finally {
      this.saving.set(false);
    }
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }

  async deleteAccount(): Promise<void> {
    const confirmed = confirm(
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.'
    );

    if (!confirmed) {
      return;
    }

    const doubleConfirm = prompt('Type "DELETE" to confirm account deletion:');

    if (doubleConfirm !== 'DELETE') {
      this.snackbar.error('Account deletion cancelled');
      return;
    }

    this.saving.set(true);

    try {
      const success = await this.profileService.deleteAccount();

      if (success) {
        await this.router.navigate(['/auth/login']);
      }
    } finally {
      this.saving.set(false);
    }
  }

  getInitials(): string {
    if (this.displayName) {
      return this.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }

    return this.email
      .split('@')[0]
      .slice(0, 2)
      .toUpperCase();
  }
}
