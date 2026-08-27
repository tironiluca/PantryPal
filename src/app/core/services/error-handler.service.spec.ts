import { TestBed } from '@angular/core/testing';
import { ErrorHandlerService } from './error-handler.service';
import { SnackbarService } from './snackbar.service';

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;
  let snackbar: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    snackbar = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [ErrorHandlerService, { provide: SnackbarService, useValue: snackbar }],
    });
    service = TestBed.inject(ErrorHandlerService);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['plain text', 'plain text'],
    [{ error: { message: 'HTTP failed' } }, 'HTTP failed'],
    [{ message: 'Request failed' }, 'Request failed'],
    [{ statusText: 'Unavailable' }, 'Unavailable'],
    [{}, 'An unexpected error occurred. Please try again.'],
  ])('extracts a user-facing message from %o', (error, message) => {
    service.handle(error);

    expect(snackbar.error).toHaveBeenCalledWith(message);
  });

  it('uses a custom message while logging the original error', () => {
    const error = new Error('secret technical detail');

    service.handleWithMessage(error, 'Could not save', 'Save');

    expect(snackbar.error).toHaveBeenCalledWith('Could not save');
    expect(console.error).toHaveBeenCalledWith('[Save]', error);
  });
});
