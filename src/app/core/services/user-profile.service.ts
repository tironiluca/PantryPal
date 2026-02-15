import { Injectable, inject } from '@angular/core';
import { AuthService, UserProfile } from './auth.service';
import { SnackbarService } from './snackbar.service';
import { ErrorHandlerService } from './error-handler.service';

@Injectable({
  providedIn: 'root',
})
export class UserProfileService {
  private auth = inject(AuthService);
  private snackbar = inject(SnackbarService);
  private errorHandler = inject(ErrorHandlerService);

  private supabase = this.auth.getSupabaseClient();

  /**
   * Get user profile from database
   */
  async getProfile(userId?: string): Promise<UserProfile | null> {
    try {
      const id = userId || this.auth.getCurrentUserId();

      if (!id) {
        return null;
      }

      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        preferences: data.preferences,
        createdAt: data.created_at,
        lastSyncAt: data.last_sync_at,
      };
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to load profile');
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<boolean> {
    try {
      const userId = this.auth.getCurrentUserId();

      if (!userId) {
        throw new Error('Not authenticated');
      }

      const payload: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.displayName !== undefined) {
        payload.display_name = updates.displayName;
      }

      if (updates.avatarUrl !== undefined) {
        payload.avatar_url = updates.avatarUrl;
      }

      if (updates.preferences !== undefined) {
        payload.preferences = updates.preferences;
      }

      const { error } = await this.supabase
        .from('users')
        .update(payload)
        .eq('id', userId);

      if (error) {
        throw error;
      }

      this.snackbar.success('Profile updated successfully');
      return true;
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to update profile');
      return false;
    }
  }

  /**
   * Upload avatar image
   */
  async uploadAvatar(file: File): Promise<string | null> {
    try {
      const userId = this.auth.getCurrentUserId();

      if (!userId) {
        throw new Error('Not authenticated');
      }

      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        throw new Error('Image must be smaller than 2MB');
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await this.supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update user profile with new avatar URL
      await this.updateProfile({ avatarUrl: publicUrl });

      return publicUrl;
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to upload avatar');
      return null;
    }
  }

  /**
   * Delete avatar image
   */
  async deleteAvatar(): Promise<boolean> {
    try {
      const userId = this.auth.getCurrentUserId();

      if (!userId) {
        throw new Error('Not authenticated');
      }

      const profile = await this.getProfile();

      if (!profile?.avatarUrl) {
        return true; // No avatar to delete
      }

      // Extract file path from URL
      const url = new URL(profile.avatarUrl);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(-2).join('/'); // avatars/filename.jpg

      // Delete from storage
      const { error } = await this.supabase.storage
        .from('avatars')
        .remove([filePath]);

      if (error) {
        // Ignore "not found" errors
        if (!error.message.includes('not found')) {
          throw error;
        }
      }

      // Update profile to remove avatar URL
      await this.updateProfile({ avatarUrl: undefined });

      this.snackbar.success('Avatar removed');
      return true;
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to delete avatar');
      return false;
    }
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(): Promise<void> {
    try {
      const userId = this.auth.getCurrentUserId();

      if (!userId) {
        return;
      }

      await this.supabase
        .from('users')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Failed to update last sync:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Delete user account and all associated data
   */
  async deleteAccount(): Promise<boolean> {
    try {
      const userId = this.auth.getCurrentUserId();

      if (!userId) {
        throw new Error('Not authenticated');
      }

      // Delete user profile (cascade will delete all related data)
      const { error } = await this.supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        throw error;
      }

      // Sign out
      await this.auth.signOut();

      this.snackbar.success('Account deleted successfully');
      return true;
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to delete account');
      return false;
    }
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<any> {
    const profile = await this.getProfile();
    return profile?.preferences || {};
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: any): Promise<boolean> {
    return this.updateProfile({ preferences });
  }
}
