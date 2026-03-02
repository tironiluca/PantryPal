import { Component, Input } from '@angular/core';

@Component({
  selector: 'pp-skeleton',
  standalone: true,
  templateUrl: './skeleton.component.html',
})
export class SkeletonComponent {
  @Input() count = 6;
  get items() {
    return Array(this.count);
  }
}
