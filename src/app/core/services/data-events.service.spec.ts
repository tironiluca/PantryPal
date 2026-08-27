import { DataEventsService } from './data-events.service';

describe('DataEventsService', () => {
  it('emits events only to subscribers for matching tables', () => {
    const service = new DataEventsService();
    const ingredients = vi.fn();
    const inventory = vi.fn();
    service.on('ingredients').subscribe(ingredients);
    service.on('inventory').subscribe(inventory);

    service.emit('ingredients', 'update', 'ingredient-1');

    expect(ingredients).toHaveBeenCalledWith({
      table: 'ingredients',
      operation: 'update',
      id: 'ingredient-1',
    });
    expect(inventory).not.toHaveBeenCalled();
  });

  it('supports subscriptions to multiple tables', () => {
    const service = new DataEventsService();
    const emitted = vi.fn();
    service.on('ingredients', 'recipes').subscribe(emitted);

    service.emit('recipes', 'delete', 'recipe-1');

    expect(emitted).toHaveBeenCalledWith({
      table: 'recipes',
      operation: 'delete',
      id: 'recipe-1',
    });
  });
});
