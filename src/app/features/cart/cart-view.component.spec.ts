import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { CartViewComponent } from './cart-view.component';
import { DbService } from '../../core/services/db.service';
import { DataEventsService } from '../../core/services/data-events.service';

describe('CartViewComponent', () => {
  let fixture: ComponentFixture<CartViewComponent>;
  let component: CartViewComponent;
  let dbSpy: { queryByUser: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dbSpy = { queryByUser: vi.fn() };
    dbSpy.queryByUser.mockImplementation((table: string) => table === 'ingredients'
      ? [{ id: 'flour', name: 'Flour' }, { id: 'milk', name: 'Milk' }]
      : [
          { ingredientId: 'flour', quantity: 500, unit: 'g', minRestock: 1, expiry: null },
          { ingredientId: 'flour', quantity: 0.25, unit: 'kg', minRestock: 1, expiry: null },
          { ingredientId: 'flour', quantity: 1, unit: 'l', minRestock: 2, expiry: null },
          { ingredientId: 'milk', quantity: 1, unit: 'l', minRestock: 2, expiry: '2020-01-01' },
        ]);

    await TestBed.configureTestingModule({
      imports: [
        CartViewComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [
        { provide: DbService, useValue: dbSpy },
        { provide: DataEventsService, useValue: { on: vi.fn(() => of()) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CartViewComponent);
    component = fixture.componentInstance;
    component.loadItems();
  });

  it('aggregates compatible units and reports the shortage in the target unit', () => {
    expect(component.items()).toContainEqual({
      ingredientId: 'flour',
      ingredientName: 'Flour',
      suggestedQty: 250,
      unit: 'g',
      reason: 'min-restock',
    });
  });

  it('keeps incompatible unit families as separate cart entries', () => {
    expect(component.items()).toContainEqual({
      ingredientId: 'flour',
      ingredientName: 'Flour',
      suggestedQty: 1,
      unit: 'l',
      reason: 'min-restock',
    });
  });

  it('adds an expired replacement without merging it into stock shortage', () => {
    expect(component.items()).toContainEqual({
      ingredientId: 'milk',
      ingredientName: 'Milk',
      suggestedQty: 1,
      unit: 'l',
      reason: 'expired-replacement',
    });
  });
});