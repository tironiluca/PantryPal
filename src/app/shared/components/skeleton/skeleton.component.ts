import { Component, Input } from '@angular/core';

@Component({
  selector: 'pp-skeleton',
  standalone: true,
  template: `
    <div class="list-card-grid">
      @for (_ of items; track $index) {
        <div class="list-card" style="pointer-events: none;">
          <div class="skeleton-shimmer" style="height: 20px; width: 60%; margin-bottom: 8px;"></div>
          <div class="skeleton-shimmer" style="height: 14px; width: 40%; margin-bottom: 6px;"></div>
          <div class="skeleton-shimmer" style="height: 14px; width: 80%; margin-bottom: 12px;"></div>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <div class="skeleton-shimmer" style="height: 28px; width: 28px; border-radius: 50%;"></div>
            <div class="skeleton-shimmer" style="height: 28px; width: 28px; border-radius: 50%;"></div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SkeletonComponent {
  @Input() count = 6;
  get items() {
    return Array(this.count);
  }
}
