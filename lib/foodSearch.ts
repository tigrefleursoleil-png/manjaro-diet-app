export interface FoodItem {
  name: string;
  barcode?: string;
  calories_per100g: number;
  protein_per100g: number;
  fat_per100g: number;
  carbs_per100g: number;
}

export async function searchFoodByBarcode(barcode: string): Promise<FoodItem | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const n = p.nutriments ?? {};
    return {
      name: p.product_name_ja || p.product_name || p.product_name_en || '不明',
      barcode,
      calories_per100g: n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0,
      protein_per100g: n.proteins_100g ?? n.proteins ?? 0,
      fat_per100g: n.fat_100g ?? n.fat ?? 0,
      carbs_per100g: n.carbohydrates_100g ?? n.carbohydrates ?? 0,
    };
  } catch {
    return null;
  }
}

export async function searchFoodByName(query: string): Promise<FoodItem[]> {
  if (!query.trim()) return [];
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.products) return [];
    return (data.products as any[])
      .filter((p) => p.product_name || p.product_name_ja)
      .slice(0, 10)
      .map((p) => {
        const n = p.nutriments ?? {};
        return {
          name: p.product_name_ja || p.product_name || '不明',
          barcode: p.code,
          calories_per100g: n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0,
          protein_per100g: n.proteins_100g ?? n.proteins ?? 0,
          fat_per100g: n.fat_100g ?? n.fat ?? 0,
          carbs_per100g: n.carbohydrates_100g ?? n.carbohydrates ?? 0,
        };
      });
  } catch {
    return [];
  }
}
