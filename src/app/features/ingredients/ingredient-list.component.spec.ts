import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { IngredientListComponent } from './ingredient-list.component';
import { DbService } from '../../core/services/db.service';
import { ProductsService } from '../../core/services/products.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { DataEventsService } from '../../core/services/data-events.service';
import { KeyboardService } from '../../core/services/keyboard.service';

describe('IngredientListComponent', () => {
  let fixture: ComponentFixture<IngredientListComponent>;
  let component: IngredientListComponent;
  let dialogSpy: { open: ReturnType<typeof vi.fn> };
  let productsSpy: { byBarcode: ReturnType<typeof vi.fn> };
  let errorHandlerSpy: { handleWithMessage: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogSpy = { open: vi.fn() };
    productsSpy = { byBarcode: vi.fn() };
    errorHandlerSpy = { handleWithMessage: vi.fn() };
    dialogSpy.open
      .mockReturnValueOnce({ afterClosed: () => of('0123456789012') })
      .mockReturnValueOnce({ afterClosed: () => of(false) });

    await TestBed.configureTestingModule({
      imports: [
        IngredientListComponent,
        MatIconTestingModule,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        { provide: ProductsService, useValue: productsSpy },
        { provide: ErrorHandlerService, useValue: errorHandlerSpy },
        { provide: DbService, useValue: { queryByUser: vi.fn(() => []), query: vi.fn(() => []) } },
        { provide: DataEventsService, useValue: { on: vi.fn(() => of()) } },
        {
          provide: KeyboardService,
          useValue: { addNew$: of(), focusSearch$: of(), escape$: of() },
        },
      ],
    })
      .overrideProvider(MatDialog, { useValue: dialogSpy })
      .compileComponents();

    fixture = TestBed.createComponent(IngredientListComponent);
    component = fixture.componentInstance;
  });

  it('reports failed barcode lookups and opens the fallback editor', () => {
    const lookupError = new Error('service unavailable');
    productsSpy.byBarcode.mockReturnValue(throwError(() => lookupError));

    component.scanAndAdd();

    expect(errorHandlerSpy.handleWithMessage).toHaveBeenCalledWith(
      lookupError,
      'Could not look up product',
      'Product lookup',
    );
    expect(dialogSpy.open).toHaveBeenCalledTimes(2);
  });
});