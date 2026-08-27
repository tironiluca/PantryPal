import { KeyboardService } from './keyboard.service';

describe('KeyboardService', () => {
  let service: KeyboardService;

  beforeEach(() => {
    service = new KeyboardService();
  });

  function press(key: string, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, ...options });
    document.dispatchEvent(event);
    return event;
  }

  it('emits addNew only for Ctrl+N outside text fields', () => {
    const emitted = vi.fn();
    service.addNew$.subscribe(emitted);

    press('n', { ctrlKey: true });
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    press('n', { ctrlKey: true });

    expect(emitted).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it('emits focusSearch for Ctrl+F and slash outside text fields', () => {
    const emitted = vi.fn();
    service.focusSearch$.subscribe(emitted);

    press('f', { ctrlKey: true });
    press('/');

    expect(emitted).toHaveBeenCalledTimes(2);
  });

  it('does not focus search for slash while typing and emits Escape', () => {
    const search = vi.fn();
    const escape = vi.fn();
    service.focusSearch$.subscribe(search);
    service.escape$.subscribe(escape);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    press('/');
    press('Escape');

    expect(search).not.toHaveBeenCalled();
    expect(escape).toHaveBeenCalledTimes(1);
    input.remove();
  });
});
