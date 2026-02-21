import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';

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

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private auth = inject(AuthService);
  private snackbar = inject(SnackbarService);
  private supabase = this.auth.getSupabaseClient();

  household = signal<Household | null>(null);
  members = signal<HouseholdMember[]>([]);
  loading = signal(false);

  async init(): Promise<void> {
    await this.loadHousehold();
  }

  async loadHousehold(): Promise<void> {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return;

    this.loading.set(true);
    try {
      // Find household the user belongs to
      const { data: memberRow } = await this.supabase
        .from('household_members')
        .select('household_id, role, joined_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (!memberRow) {
        this.household.set(null);
        this.members.set([]);
        return;
      }

      const { data: hhData } = await this.supabase
        .from('households')
        .select('*')
        .eq('id', memberRow.household_id)
        .maybeSingle();

      if (hhData) {
        this.household.set({
          id: hhData.id,
          name: hhData.name,
          ownerId: hhData.owner_id,
          createdAt: hhData.created_at,
        });
        await this.loadMembers(hhData.id);
      }
    } catch (err) {
      console.error('Failed to load household:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async createHousehold(name: string): Promise<void> {
    const userId = this.auth.getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: hhErr } = await this.supabase.from('households').insert({
      id,
      name,
      owner_id: userId,
      created_at: now,
      updated_at: now,
    });
    if (hhErr) throw hhErr;

    const { error: memErr } = await this.supabase.from('household_members').insert({
      household_id: id,
      user_id: userId,
      role: 'owner',
      joined_at: now,
    });
    if (memErr) throw memErr;

    await this.loadHousehold();
    this.snackbar.success('Household created!');
  }

  async inviteMember(email: string): Promise<void> {
    const hh = this.household();
    if (!hh) throw new Error('No household');

    const now = new Date().toISOString();
    const { error } = await this.supabase.from('household_invitations').insert({
      id: crypto.randomUUID(),
      household_id: hh.id,
      invited_email: email,
      invited_at: now,
      status: 'pending',
    });
    if (error) throw error;
    this.snackbar.success(`Invitation sent to ${email}`);
  }

  async acceptInvitation(invitationId: string): Promise<void> {
    const userId = this.auth.getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    const { data: inv } = await this.supabase
      .from('household_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!inv) throw new Error('Invitation not found or already used');

    const now = new Date().toISOString();
    const { error: memErr } = await this.supabase.from('household_members').insert({
      household_id: inv.household_id,
      user_id: userId,
      role: 'member',
      joined_at: now,
    });
    if (memErr) throw memErr;

    await this.supabase.from('household_invitations').update({ status: 'accepted' }).eq('id', invitationId);
    await this.loadHousehold();
    this.snackbar.success('Joined household!');
  }

  async leaveHousehold(): Promise<void> {
    const userId = this.auth.getCurrentUserId();
    const hh = this.household();
    if (!userId || !hh) return;

    const { error } = await this.supabase
      .from('household_members')
      .delete()
      .eq('household_id', hh.id)
      .eq('user_id', userId);

    if (error) throw error;

    this.household.set(null);
    this.members.set([]);
    this.snackbar.success('You left the household');
  }

  async removeMember(memberId: string): Promise<void> {
    const hh = this.household();
    if (!hh) return;

    const { error } = await this.supabase
      .from('household_members')
      .delete()
      .eq('household_id', hh.id)
      .eq('user_id', memberId);

    if (error) throw error;
    await this.loadMembers(hh.id);
    this.snackbar.success('Member removed');
  }

  /** Get all Supabase user IDs in the same household (including self) */
  async getHouseholdUserIds(): Promise<string[]> {
    const hh = this.household();
    if (!hh) {
      const userId = this.auth.getCurrentUserId();
      return userId ? [userId] : [];
    }

    const { data } = await this.supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', hh.id);

    return (data ?? []).map((r: any) => r.user_id);
  }

  private async loadMembers(householdId: string): Promise<void> {
    const { data } = await this.supabase
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('household_id', householdId);

    this.members.set(
      (data ?? []).map((r: any) => ({
        userId: r.user_id,
        email: r.user_id, // email not available without auth.admin; shown as userId fallback
        role: r.role,
        joinedAt: r.joined_at,
      }))
    );
  }
}
