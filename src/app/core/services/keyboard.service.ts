import { Injectable } from '@angular/core';
import { fromEvent, Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

/**
 * Global keyboard shortcut service.
 *
 * Shortcuts:
 *  Ctrl+N  — trigger "add new item" action
 *  Ctrl+F  — focus the search input (always)
 *  /       — focus the search input (only when not already typing in an input)
 *  Escape  — clear search / filters
 */
@Injectable({ providedIn: 'root' })
export class KeyboardService {
  private keydown$ = fromEvent<KeyboardEvent>(document, 'keydown');

  /** Emits when Ctrl+N is pressed and the focus is not inside a text field. */
  readonly addNew$: Observable<void> = this.keydown$.pipe(
    filter(e => e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'n'),
    filter(() => !this.isTextFieldFocused()),
    tap(e => e.preventDefault()),
    map(() => void 0),
  );

  /**
   * Emits when Ctrl+F is pressed (always) or "/" is pressed outside a text
   * field. Both are intended to move focus to a search input.
   */
  readonly focusSearch$: Observable<void> = this.keydown$.pipe(
    filter(e =>
      (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'f') ||
      (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '/' && !this.isTextFieldFocused())
    ),
    tap(e => e.preventDefault()),
    map(() => void 0),
  );

  /** Emits on every Escape keypress. */
  readonly escape$: Observable<void> = this.keydown$.pipe(
    filter(e => e.key === 'Escape'),
    map(() => void 0),
  );

  private isTextFieldFocused(): boolean {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }
}
