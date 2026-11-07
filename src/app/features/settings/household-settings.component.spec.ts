import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { signal } from '@angular/core';
import { HouseholdSettingsComponent } from './household-settings.component';
import { HouseholdService } from '../../core/services/household.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';

describe('HouseholdSettingsComponent', () => {
  let fixture: ComponentFixture<HouseholdSettingsComponent>;
  let component: HouseholdSettingsComponent;
  let householdSpy: {
    household: ReturnType<typeof signal>;
    members: ReturnType<typeof signal>;
    loading: ReturnType<typeof signal>;
    loadHousehold: ReturnType<typeof vi.fn>;
    createHousehold: ReturnType<typeof vi.fn>;
    inviteMember: ReturnType<typeof vi.fn>;
    leaveHousehold: ReturnType<typeof vi.fn>;
  };
  let errorHandlerSpy: { handle: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    householdSpy = {
      household: signal(null),
      members: signal([]),
      loading: signal(false),
      loadHousehold: vi.fn(),
      createHousehold: vi.fn(),
      inviteMember: vi.fn(),
      leaveHousehold: vi.fn(),
    };
    errorHandlerSpy = { handle: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        HouseholdSettingsComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: HouseholdService, useValue: householdSpy },
        { provide: ErrorHandlerService, useValue: errorHandlerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HouseholdSettingsComponent);
    component = fixture.componentInstance;
  });

  it('loads the household on init', () => {
    fixture.detectChanges();
    expect(householdSpy.loadHousehold).toHaveBeenCalled();
  });

  it('shows the create-household card when no household exists', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('createHousehold');
  });

  it('shows the household card with members when one exists', () => {
    householdSpy.household.set({ id: 'h1', name: 'The Smiths', ownerId: 'u1', createdAt: '2026-01-01' });
    householdSpy.members.set([{ userId: 'u1', email: 'a@b.com', role: 'owner', joinedAt: '2026-01-01' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('The Smiths');
    expect(fixture.nativeElement.querySelectorAll('mat-list-item').length).toBe(1);
  });

  it('shows a spinner while loading', () => {
    householdSpy.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-spinner')).toBeTruthy();
  });

  describe('createHousehold', () => {
    it('does nothing when the name is blank', async () => {
      component.householdName = '   ';
      await component.createHousehold();
      expect(householdSpy.createHousehold).not.toHaveBeenCalled();
    });

    it('trims and creates the household, then clears the field', async () => {
      component.householdName = '  My House  ';
      await component.createHousehold();
      expect(householdSpy.createHousehold).toHaveBeenCalledWith('My House');
      expect(component.householdName).toBe('');
    });

    it('routes creation failures through the error handler', async () => {
      householdSpy.createHousehold.mockRejectedValueOnce(new Error('boom'));
      component.householdName = 'My House';
      await component.createHousehold();
      expect(errorHandlerSpy.handle).toHaveBeenCalledWith(expect.any(Error), 'Failed to create household');
    });
  });

  describe('invite', () => {
    it('does nothing when the email is blank', async () => {
      component.inviteEmail = '  ';
      await component.invite();
      expect(householdSpy.inviteMember).not.toHaveBeenCalled();
    });

    it('rejects an invalid email without calling the service', async () => {
      component.inviteEmail = 'not-an-email';
      await component.invite();
      expect(householdSpy.inviteMember).not.toHaveBeenCalled();
      expect(errorHandlerSpy.handle).toHaveBeenCalledWith(expect.any(Error), 'Please enter a valid email address');
    });

    it('invites a valid email and clears the field', async () => {
      component.inviteEmail = 'member@example.com';
      await component.invite();
      expect(householdSpy.inviteMember).toHaveBeenCalledWith('member@example.com');
      expect(component.inviteEmail).toBe('');
    });

    it('routes invite failures through the error handler', async () => {
      householdSpy.inviteMember.mockRejectedValueOnce(new Error('boom'));
      component.inviteEmail = 'member@example.com';
      await component.invite();
      expect(errorHandlerSpy.handle).toHaveBeenCalledWith(expect.any(Error), 'Failed to send invitation');
    });
  });

  describe('leaveHousehold', () => {
    it('delegates to the household service', async () => {
      await component.leaveHousehold();
      expect(householdSpy.leaveHousehold).toHaveBeenCalled();
    });

    it('routes leave failures through the error handler', async () => {
      householdSpy.leaveHousehold.mockRejectedValueOnce(new Error('boom'));
      await component.leaveHousehold();
      expect(errorHandlerSpy.handle).toHaveBeenCalledWith(expect.any(Error), 'Failed to leave household');
    });
  });
});
