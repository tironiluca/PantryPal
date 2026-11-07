import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SkeletonComponent } from './skeleton.component';

describe('SkeletonComponent', () => {
  let fixture: ComponentFixture<SkeletonComponent>;
  let component: SkeletonComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SkeletonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SkeletonComponent);
    component = fixture.componentInstance;
  });

  it('defaults to six placeholder items', () => {
    expect(component.items.length).toBe(6);
  });

  it('renders a card per item once the default count is applied', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.list-card').length).toBe(6);
  });

  it('renders the requested number of cards when count is overridden', () => {
    component.count = 3;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.list-card').length).toBe(3);
    expect(component.items.length).toBe(3);
  });

  it('renders nothing when count is zero', () => {
    component.count = 0;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.list-card').length).toBe(0);
  });
});
