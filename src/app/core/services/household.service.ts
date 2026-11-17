import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';
import { DbService } from './db.service';

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface HouseholdMember {
  userId: string;
  email: string;
  displayName?: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface HouseholdInvitation {
  id: string;
  householdId: string;
  householdName: string;
  invitedAt: string;
}

/** Shown when a Supabase database function from migration 004 is not deployed yet. */
export const HOUSEHOLD_MIGRATION_MISSING_MESSAGE =
  'This feature needs a database update. Ask the app administrator to apply migration 004.';

/**
 * Turn a Supabase/PostgREST error into an Error with a message fit for the user.
 * Calls to database functions that do not exist yet must fail visibly, never silently.
 */
export function toUserError(error: { message?: string; code?: string } | null | undefined): Error {
  const message = error?.message ?? 'Unknown error';
  if (error?.code === 'PGRST202' || /could not find the function/i.test(message)) {
    return new Error(HOUSEHOLD_MIGRATION_MISSING_MESSAGE);
  }
  return new Error(message);
}

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private auth = inject(AuthService);
  private snackbar = inject(SnackbarService);
  private db = inject(DbService);
  private supabase = this.auth.getSupabaseClient();

  household = signal<Household | null>(null);
  members = signal<HouseholdMember[]>([]);
  /** Pending invitations addressed to the signed-in user's email. */
  invitations = signal<HouseholdInvitation[]>([]);
  loading = signal(false);
  /** Last load failure, shown instead of silently presenting "no household". */
  loadError = signal<string | null>(null);

  async init(): Promise<void> {
    await this.loadHousehold();
  }

  private async rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.supabase.rpc(fn, args);
    if (error) throw toUserError(error);
    return data as T;
  }

  async loadHousehold(): Promise<void> {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return;

    this.loading.set(true);
    this.loadError.set(null);
    try {
      // Find household the user belongs to
      const { data: memberRow, error: memberError } = await this.supabase
        .from('household_members')
        .select('household_id, role, joined_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (memberError) throw toUserError(memberError);

      if (!memberRow) {
        this.household.set(null);
        this.members.set([]);
        this.db.setHouseholdMembers([]);
        await this.loadInvitations();
        return;
      }

      const { data: hhData, error: hhError } = await this.supabase
        .from('households')
        .select('*')
        .eq('id', memberRow.household_id)
        .maybeSingle();
      if (hhError) throw toUserError(hhError);

      if (hhData) {
        this.household.set({
          id: hhData.id,
          name: hhData.name,
          ownerId: hhData.owner_id,
          createdAt: hhData.created_at,
        });
        this.invitations.set([]);
        await this.loadMembers();
      }
    } catch (err) {
      console.error('Failed to load household:', err);
      this.loadError.set(err instanceof Error ? err.message : 'Failed to load household');
    } finally {
      this.loading.set(false);
    }
  }

  async loadInvitations(): Promise<void> {
    const rows = await this.rpc<any[]>('my_pending_invitations');
    this.invitations.set(
      (Array.isArray(rows) ? rows : []).map((r) => ({
        id: r.id,
        householdId: r.household_id,
        householdName: r.household_name,
        invitedAt: r.invited_at,
      }))
    );
  }

  async createHousehold(name: string): Promise<void> {
    if (!this.auth.getCurrentUserId()) throw new Error('Not authenticated');

    await this.rpc('create_household', { p_name: name });
    await this.loadHousehold();
    this.snackbar.success('Household created!');
  }

  async inviteMember(email: string): Promise<void> {
    if (!this.household()) throw new Error('No household');

    await this.rpc('invite_household_member', { p_email: email });
    // No email is sent yet; the invitee sees the invitation in Settings after signing in.
    this.snackbar.success(
      `Invitation created for ${email}. They can accept it in Settings → Household after signing in with that email.`
    );
  }

  async acceptInvitation(invitationId: string): Promise<void> {
    if (!this.auth.getCurrentUserId()) throw new Error('Not authenticated');

    await this.rpc('accept_household_invitation', { p_invitation_id: invitationId });
    await this.loadHousehold();
    this.snackbar.success('Joined household!');
  }

  async declineInvitation(invitationId: string): Promise<void> {
    await this.rpc('decline_household_invitation', { p_invitation_id: invitationId });
    this.invitations.update((list) => list.filter((i) => i.id !== invitationId));
    this.snackbar.info('Invitation declined');
  }

  async leaveHousehold(): Promise<void> {
    if (!this.auth.getCurrentUserId() || !this.household()) return;

    // An owner who leaves hands ownership to the longest-standing member (server side).
    await this.rpc('leave_household');

    this.household.set(null);
    this.members.set([]);
    this.db.setHouseholdMembers([]);
    this.snackbar.success('You left the household');
  }

  async removeMember(memberId: string): Promise<void> {
    const hh = this.household();
    if (!hh) return;

    const currentUserId = this.auth.getCurrentUserId();
    // Only the owner can remove others; any member can remove themselves
    if (hh.ownerId !== currentUserId && memberId !== currentUserId) {
      throw new Error('Only the household owner can remove other members');
    }

    await this.rpc('remove_household_member', { p_user_id: memberId });
    await this.loadMembers();
    this.snackbar.success('Member removed');
  }

  /** Get all Supabase user IDs in the same household (including self) */
  async getHouseholdUserIds(): Promise<string[]> {
    const userId = this.auth.getCurrentUserId();
    const hh = this.household();
    if (!hh) {
      return userId ? [userId] : [];
    }

    const { data, error } = await this.supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', hh.id);

    if (error) {
      // Keep syncing the user's own data rather than failing the whole sync.
      console.error('Failed to read household members:', error);
      return userId ? [userId] : [];
    }

    return (data ?? []).map((r: any) => r.user_id);
  }

  private async loadMembers(): Promise<void> {
    const rows = await this.rpc<any[]>('household_member_details');
    // Lets local reads include members' synced rows (read-only) and refreshes cursors on change.
    this.db.setHouseholdMembers((Array.isArray(rows) ? rows : []).map((r) => r.user_id));
    this.members.set(
      (Array.isArray(rows) ? rows : []).map((r) => ({
        userId: r.user_id,
        email: r.email ?? r.user_id,
        displayName: r.display_name ?? undefined,
        role: r.role,
        joinedAt: r.joined_at,
      }))
    );
  }
}
