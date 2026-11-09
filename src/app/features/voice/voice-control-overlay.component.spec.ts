import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { VoiceControlOverlayComponent } from './voice-control-overlay.component';
import { VoiceService, VoiceTranscript } from '../../core/services/voice.service';
import { VoiceCommandService, ParsedCommand } from '../../core/services/voice-command.service';
import { SnackbarService } from '../../core/services/snackbar.service';

describe('VoiceControlOverlayComponent', () => {
  let fixture: ComponentFixture<VoiceControlOverlayComponent>;
  let component: VoiceControlOverlayComponent;
  let transcript$: Subject<VoiceTranscript>;
  let error$: Subject<string>;
  let voiceSpy: {
    listening: ReturnType<typeof signal>;
    transcript$: Subject<VoiceTranscript>;
    error$: Subject<string>;
    stopListening: ReturnType<typeof vi.fn>;
    logCommand: ReturnType<typeof vi.fn>;
  };
  let commandSpy: { parseCommand: ReturnType<typeof vi.fn>; executeCommand: ReturnType<typeof vi.fn>; getSupportedCommands: ReturnType<typeof vi.fn> };
  let snackbarSpy: { warning: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    transcript$ = new Subject<VoiceTranscript>();
    error$ = new Subject<string>();
    voiceSpy = { listening: signal(true), transcript$, error$, stopListening: vi.fn(), logCommand: vi.fn() };
    commandSpy = {
      parseCommand: vi.fn(),
      executeCommand: vi.fn().mockResolvedValue(true),
      getSupportedCommands: vi.fn().mockReturnValue([{ pattern: 'Navigate', description: 'Go to a page', examples: ['Go to recipes'] }]),
    };
    snackbarSpy = { warning: vi.fn(), error: vi.fn(), info: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [VoiceControlOverlayComponent, MatIconTestingModule],
      providers: [
        { provide: VoiceService, useValue: voiceSpy },
        { provide: VoiceCommandService, useValue: commandSpy },
        { provide: SnackbarService, useValue: snackbarSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VoiceControlOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows nothing while not listening', () => {
    voiceSpy.listening.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.voice-overlay')).toBeNull();
  });

  it('shows the overlay while listening', () => {
    expect(fixture.nativeElement.querySelector('.voice-overlay')).toBeTruthy();
  });

  it('updates the transcript and marks processing for an interim result', () => {
    transcript$.next({ transcript: 'go to recipes', isFinal: false });

    expect(component.currentTranscript()).toBe('go to recipes');
    expect(component.isFinalTranscript()).toBe(false);
    expect(component.isProcessing()).toBe(true);
  });

  it('parses and executes a recognized final command, then logs success', async () => {
    const command: ParsedCommand = { action: 'navigate', target: 'recipes' };
    commandSpy.parseCommand.mockReturnValue(command);
    commandSpy.executeCommand.mockResolvedValue(true);

    transcript$.next({ transcript: 'go to recipes', isFinal: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(commandSpy.parseCommand).toHaveBeenCalledWith('go to recipes');
    expect(commandSpy.executeCommand).toHaveBeenCalledWith(command);
    expect(component.lastCommand()).toEqual(command);
    expect(voiceSpy.logCommand).toHaveBeenCalledWith('go to recipes', 'navigate', true);
    expect(component.isProcessing()).toBe(false);
  });

  it('stops listening shortly after a command executes successfully', async () => {
    vi.useFakeTimers();
    const command: ParsedCommand = { action: 'navigate', target: 'recipes' };
    commandSpy.parseCommand.mockReturnValue(command);
    commandSpy.executeCommand.mockResolvedValue(true);

    transcript$.next({ transcript: 'go to recipes', isFinal: true });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1500);

    expect(voiceSpy.stopListening).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not stop listening when the command failed to execute', async () => {
    vi.useFakeTimers();
    const command: ParsedCommand = { action: 'navigate', target: 'recipes' };
    commandSpy.parseCommand.mockReturnValue(command);
    commandSpy.executeCommand.mockResolvedValue(false);

    transcript$.next({ transcript: 'go to recipes', isFinal: true });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1500);

    expect(voiceSpy.stopListening).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('warns and logs failure when the transcript cannot be parsed', async () => {
    commandSpy.parseCommand.mockReturnValue(null);

    transcript$.next({ transcript: 'gibberish', isFinal: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(snackbarSpy.warning).toHaveBeenCalledWith('Could not understand command. Try again.');
    expect(voiceSpy.logCommand).toHaveBeenCalledWith('gibberish', null, false);
    expect(component.lastCommand()).toBeNull();
  });

  it('shows an error snackbar when processing throws', async () => {
    commandSpy.parseCommand.mockImplementation(() => { throw new Error('boom'); });

    transcript$.next({ transcript: 'go to recipes', isFinal: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(snackbarSpy.error).toHaveBeenCalledWith('Failed to process voice command');
    expect(component.isProcessing()).toBe(false);
  });

  it('shows a voice-recognition error from the error stream', () => {
    error$.next('network unavailable');
    expect(snackbarSpy.error).toHaveBeenCalledWith('Voice recognition error: network unavailable');
  });

  describe('stopListening', () => {
    it('stops the service and clears transcript/command state', () => {
      component.currentTranscript.set('something');
      component.lastCommand.set({ action: 'navigate' });

      component.stopListening();

      expect(voiceSpy.stopListening).toHaveBeenCalled();
      expect(component.currentTranscript()).toBe('');
      expect(component.lastCommand()).toBeNull();
    });
  });

  describe('onOverlayClick', () => {
    it('stops listening', () => {
      component.onOverlayClick();
      expect(voiceSpy.stopListening).toHaveBeenCalled();
    });
  });

  describe('showHelp', () => {
    it('logs the supported commands and informs the user', () => {
      component.showHelp();
      expect(commandSpy.getSupportedCommands).toHaveBeenCalled();
      expect(snackbarSpy.info).toHaveBeenCalledWith('Voice commands list logged to console');
    });
  });

  describe('getCommandIcon', () => {
    it('maps known actions to icons and falls back to mic', () => {
      expect(component.getCommandIcon('navigate')).toBe('navigation');
      expect(component.getCommandIcon('add')).toBe('add_circle');
      expect(component.getCommandIcon('search')).toBe('search');
      expect(component.getCommandIcon('show')).toBe('visibility');
      expect(component.getCommandIcon('help')).toBe('help');
      expect(component.getCommandIcon('unknown')).toBe('mic');
    });
  });

  describe('getCommandLabel', () => {
    it('combines action and target, replacing dashes with spaces', () => {
      expect(component.getCommandLabel({ action: 'navigate', target: 'meal-plan' })).toBe('navigate meal plan');
    });

    it('falls back to just the action when there is no target', () => {
      expect(component.getCommandLabel({ action: 'help' })).toBe('help');
    });
  });
});
