import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { VoiceCommandService, ParsedCommand } from './voice-command.service';
import { DbService } from './db.service';
import { SnackbarService } from './snackbar.service';

describe('VoiceCommandService', () => {
  let service: VoiceCommandService;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let snackbar: {
    success: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    router = { navigate: vi.fn(async () => true) };
    snackbar = {
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        VoiceCommandService,
        { provide: Router, useValue: router },
        { provide: DbService, useValue: {} },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    service = TestBed.inject(VoiceCommandService);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['go to recipes', { action: 'navigate', target: 'recipes', confidence: 0.9 }],
    ['open meal plan', { action: 'navigate', target: 'meal-plan', confidence: 0.9 }],
    ['add ingredient', { action: 'add', target: 'ingredient', confidence: 0.85 }],
    ['create recipe', { action: 'add', target: 'recipe', confidence: 0.85 }],
    [
      'search for milk',
      { action: 'search', target: 'inventory', params: { query: 'milk' }, confidence: 0.8 },
    ],
    [
      'find recipe pasta',
      { action: 'search', target: 'recipes', params: { query: 'recipe pasta' }, confidence: 0.8 },
    ],
    ['display ingredients', { action: 'show', target: 'ingredients', confidence: 0.85 }],
    ['help', { action: 'help', confidence: 0.9 }],
  ])('parses %s', (transcript, expected) => {
    expect(service.parseCommand(transcript)).toEqual(expected);
  });

  it('returns null for an unsupported transcript', () => {
    expect(service.parseCommand('tell me a joke')).toBeNull();
  });

  it('executes navigation and reports success', async () => {
    const command: ParsedCommand = { action: 'navigate', target: 'inventory', confidence: 0.9 };

    await expect(service.executeCommand(command)).resolves.toBe(true);

    expect(router.navigate).toHaveBeenCalledWith(['/home/inventory']);
    expect(snackbar.success).toHaveBeenCalledWith('Navigated to inventory');
  });

  it('executes search after navigation and rejects an empty query', async () => {
    await expect(
      service.executeCommand({
        action: 'search',
        target: 'recipes',
        params: { query: 'pasta' },
        confidence: 0.8,
      })
    ).resolves.toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/home/recipes']);
    expect(snackbar.success).toHaveBeenCalledWith('Searching for "pasta" in recipes');

    await expect(
      service.executeCommand({
        action: 'search',
        target: 'recipes',
        params: {},
        confidence: 0.3,
      })
    ).resolves.toBe(false);
    expect(snackbar.warning).toHaveBeenCalledWith('No search query provided');
  });

  it('reports unknown commands and catches execution errors', async () => {
    await expect(service.executeCommand({ action: 'unknown', confidence: 0 })).resolves.toBe(false);
    expect(snackbar.warning).toHaveBeenCalledWith('Unknown command: unknown');

    router.navigate.mockRejectedValueOnce(new Error('navigation failed'));
    await expect(
      service.executeCommand({
        action: 'navigate',
        target: 'home',
        confidence: 0.9,
      })
    ).resolves.toBe(false);
    expect(snackbar.error).toHaveBeenCalledWith('Failed to execute voice command');
  });
});
