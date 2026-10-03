import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageWardrobeRepository } from '../LocalStorageWardrobeRepository';
import { WardrobeItem } from '../../types';

describe('LocalStorageWardrobeRepository', () => {
  let repo: LocalStorageWardrobeRepository;

  const mockItem: WardrobeItem = {
    id: 'test-1',
    name: 'White Linen Shirt',
    photo: null,
    category: 'Tops',
    subcategory: 'shirt',
    colors: ['white'],
    seasons: ['summer'],
    occasions: ['office', 'college'],
    formality: 3,
    status: 'clean',
    favorite: false,
    note: 'Great for summer',
    timesWorn: 1,
  };

  beforeEach(async () => {
    repo = new LocalStorageWardrobeRepository();
    await repo.clear();
  });

  it('starts with an empty item list', async () => {
    const items = await repo.getItems();
    expect(items).toEqual([]);
  });

  it('adds and retrieves wardrobe items', async () => {
    await repo.addItem(mockItem);
    const items = await repo.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('White Linen Shirt');
  });

  it('retrieves an item by id', async () => {
    await repo.addItem(mockItem);
    const item = await repo.getItem('test-1');
    expect(item).not.toBeNull();
    expect(item?.id).toBe('test-1');
  });

  it('updates an item patch correctly', async () => {
    await repo.addItem(mockItem);
    await repo.updateItem('test-1', { favorite: true, status: 'in_laundry' });
    const item = await repo.getItem('test-1');
    expect(item?.favorite).toBe(true);
    expect(item?.status).toBe('in_laundry');
  });

  it('deletes an item correctly', async () => {
    await repo.addItem(mockItem);
    await repo.deleteItem('test-1');
    const items = await repo.getItems();
    expect(items).toHaveLength(0);
  });

  it('saves and deletes saved outfits', async () => {
    const outfit = {
      template: 'Western',
      slots: { top: [mockItem] },
      score: 5,
      why: 'Crisp classic look',
    };
    const saved = await repo.saveOutfit(outfit, 'Office Classic');
    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('Office Classic');

    const list = await repo.getSavedOutfits();
    expect(list).toHaveLength(1);

    await repo.deleteSavedOutfit(saved.id);
    const emptyList = await repo.getSavedOutfits();
    expect(emptyList).toHaveLength(0);
  });
});
