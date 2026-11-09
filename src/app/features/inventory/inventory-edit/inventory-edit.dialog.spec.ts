import { InventoryEditDialog } from './inventory-edit.dialog';

function bare(): InventoryEditDialog & Record<string, any> {
  return Object.create(InventoryEditDialog.prototype) as InventoryEditDialog & Record<string, any>;
}

function setup(existingBarcodeRows: any[] = []) {
  const component = bare();
  component.model = {
    id: '',
    ingredientId: 'milk',
    quantity: 2,
    unit: 'pcs',
    minRestock: 1,
    expiry: '',
  };
  component.db = {
    queryByUser: vi.fn(() => existingBarcodeRows),
    createInventoryItem: vi.fn(),
    updateInventoryItemDetails: vi.fn(),
  };
  component.snackbar = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  component.transloco = { translate: (key: string) => key };
  component.errorHandler = { handle: vi.fn(), handleWithMessage: vi.fn() };
  component.dataEvents = { emit: vi.fn() };
  component.ref = { close: vi.fn() };
  return component;
}

describe('InventoryEditDialog save conflicts', () => {
  it('blocks create when the barcode is already used by another row', () => {
    const component = setup([{ id: 'inv-other' }]);
    component.model.barcode = '12345';

    component.save();

    expect(component.db.queryByUser).toHaveBeenCalledWith(
      'inventory',
      'barcode = ? AND id != ?',
      ['12345', '']
    );
    expect(component.snackbar.error).toHaveBeenCalledWith('inventory.barcodeAlreadyInUse');
    expect(component.db.createInventoryItem).not.toHaveBeenCalled();
    expect(component.ref.close).not.toHaveBeenCalled();
  });

  it('allows create with a unique barcode and emits a create event', () => {
    const component = setup([]);
    component.model.barcode = '12345';

    component.save();

    expect(component.db.createInventoryItem).toHaveBeenCalledTimes(1);
    expect(component.db.createInventoryItem).toHaveBeenCalledWith(expect.objectContaining({ barcode: '12345' }));
    expect(component.dataEvents.emit).toHaveBeenCalledWith('inventory', 'create', component.model.id);
    expect(component.snackbar.success).toHaveBeenCalledWith('inventory.itemAdded');
    expect(component.ref.close).toHaveBeenCalledWith(true);
  });

  it('blocks edit when another row already owns the barcode', () => {
    const component = setup([{ id: 'inv-other' }]);
    component.model.id = 'inv-mine';
    component.model.barcode = '99999';

    component.save();

    expect(component.db.queryByUser).toHaveBeenCalledWith(
      'inventory',
      'barcode = ? AND id != ?',
      ['99999', 'inv-mine']
    );
    expect(component.snackbar.error).toHaveBeenCalledWith('inventory.barcodeAlreadyInUse');
    expect(component.db.updateInventoryItemDetails).not.toHaveBeenCalled();
  });

  it('allows edit to keep its own existing barcode', () => {
    const component = setup([]);
    component.model.id = 'inv-mine';
    component.model.barcode = '99999';

    component.save();

    expect(component.db.updateInventoryItemDetails).toHaveBeenCalledTimes(1);
    expect(component.db.updateInventoryItemDetails).toHaveBeenCalledWith('inv-mine', expect.objectContaining({ barcode: '99999' }));
    expect(component.dataEvents.emit).toHaveBeenCalledWith('inventory', 'update', 'inv-mine');
    expect(component.snackbar.success).toHaveBeenCalledWith('inventory.itemUpdated');
    expect(component.ref.close).toHaveBeenCalledWith(true);
  });

  it('skips the barcode lookup entirely when no barcode is set', () => {
    const component = setup([]);

    component.save();

    expect(component.db.queryByUser).not.toHaveBeenCalled();
    expect(component.db.createInventoryItem).toHaveBeenCalledTimes(1);
    expect(component.ref.close).toHaveBeenCalledWith(true);
  });

  it('reports a unique-constraint failure from exec as a barcode conflict', () => {
    const component = setup([]);
    component.db.createInventoryItem = vi.fn(() => {
      throw new Error('UNIQUE constraint failed: inventory.barcode');
    });

    component.save();

    expect(component.snackbar.error).toHaveBeenCalledWith('inventory.barcodeAlreadyInUse');
    expect(component.errorHandler.handle).not.toHaveBeenCalled();
    expect(component.ref.close).not.toHaveBeenCalled();
  });

  it('routes a non-conflict save failure through the error handler', () => {
    const component = setup([]);
    const error = new Error('disk full');
    component.db.createInventoryItem = vi.fn(() => {
      throw error;
    });

    component.save();

    expect(component.errorHandler.handle).toHaveBeenCalledWith(error, 'inventory.failedSaveItem');
    expect(component.snackbar.error).not.toHaveBeenCalledWith('inventory.barcodeAlreadyInUse');
    expect(component.ref.close).not.toHaveBeenCalled();
  });

  it('rejects save when the ingredient name is blank', () => {
    const component = setup([]);
    component.model.ingredientId = '   ';

    component.save();

    expect(component.snackbar.error).toHaveBeenCalledWith('inventory.enterIngredientName');
    expect(component.db.createInventoryItem).not.toHaveBeenCalled();
  });

  it('rejects save when quantity is not positive', () => {
    const component = setup([]);
    component.model.quantity = 0;

    component.save();

    expect(component.snackbar.error).toHaveBeenCalledWith('inventory.quantityMustBePositive');
    expect(component.db.createInventoryItem).not.toHaveBeenCalled();
  });

  it('rejects save when minRestock is negative', () => {
    const component = setup([]);
    component.model.minRestock = -1;

    component.save();

    expect(component.snackbar.error).toHaveBeenCalledWith('inventory.minRestockNegative');
    expect(component.db.createInventoryItem).not.toHaveBeenCalled();
  });
});
