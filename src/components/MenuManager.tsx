"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/ImageUpload";
import type { MenuCategory, MenuItem } from "@/lib/types";

export default function MenuManager({
  restaurantId,
  initialCategories,
  initialItems,
}: {
  restaurantId: string;
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
}) {
  const supabase = createClient();
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [newCat, setNewCat] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addCategory() {
    if (!newCat.trim()) return;
    const { data, error } = await supabase
      .from("menu_categories")
      .insert({ restaurant_id: restaurantId, name: newCat.trim(), sort_order: categories.length })
      .select("*")
      .single<MenuCategory>();
    if (error) return setError(error.message);
    if (data) setCategories([...categories, data]);
    setNewCat("");
  }

  async function removeCategory(id: string) {
    await supabase.from("menu_categories").delete().eq("id", id);
    setCategories(categories.filter((c) => c.id !== id));
    setItems(items.filter((i) => i.category_id !== id));
  }

  async function addItem(categoryId: string | null) {
    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        restaurant_id: restaurantId,
        category_id: categoryId,
        name: "New item",
        price: null,
        sort_order: items.length,
      })
      .select("*")
      .single<MenuItem>();
    if (error) return setError(error.message);
    if (data) setItems([...items, data]);
  }

  async function updateItem(id: string, patch: Partial<MenuItem>) {
    setItems((its) => its.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await supabase.from("menu_items").update(patch).eq("id", id);
  }

  async function removeItem(id: string) {
    await supabase.from("menu_items").delete().eq("id", id);
    setItems(items.filter((i) => i.id !== id));
  }

  const uncategorised = items.filter((i) => !i.category_id);

  return (
    <div className="mt-6 space-y-6">
      {error && <p className="text-sm text-risk">{error}</p>}

      <div className="flex gap-2">
        <input
          className="field flex-1"
          placeholder="New category (e.g. Coffee)"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
        />
        <button className="btn-brand px-4" onClick={addCategory}>
          Add
        </button>
      </div>

      {categories.map((cat) => (
        <section key={cat.id} className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{cat.name}</h2>
            <button className="text-xs text-risk" onClick={() => removeCategory(cat.id)}>
              Delete category
            </button>
          </div>
          <ItemList
            items={items.filter((i) => i.category_id === cat.id)}
            onUpdate={updateItem}
            onRemove={removeItem}
          />
          <button className="btn-ghost mt-3 w-full" onClick={() => addItem(cat.id)}>
            + Add item
          </button>
        </section>
      ))}

      <section className="card">
        <h2 className="mb-3 font-bold">Uncategorised</h2>
        <ItemList items={uncategorised} onUpdate={updateItem} onRemove={removeItem} />
        <button className="btn-ghost mt-3 w-full" onClick={() => addItem(null)}>
          + Add item
        </button>
      </section>

      <p className="text-center text-xs text-ink-2">
        Changes save automatically. Photos upload to Supabase Storage.
      </p>
    </div>
  );
}

function ItemList({
  items,
  onUpdate,
  onRemove,
}: {
  items: MenuItem[];
  onUpdate: (id: string, patch: Partial<MenuItem>) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return <p className="text-sm text-ink-2">No items yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.id} className="rounded-2xl border-2 border-line p-3">
          <div className="flex gap-2">
            <input
              className="field flex-1"
              value={it.name}
              onChange={(e) => onUpdate(it.id, { name: e.target.value })}
            />
            <input
              type="number"
              className="field w-24"
              placeholder="₹"
              value={it.price ?? ""}
              onChange={(e) => onUpdate(it.id, { price: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
          <input
            className="field mt-2"
            placeholder="Description (optional)"
            value={it.description ?? ""}
            onChange={(e) => onUpdate(it.id, { description: e.target.value })}
          />
          <div className="mt-2">
            <ImageUpload
              label="Photo"
              value={it.image_url}
              onChange={(url) => onUpdate(it.id, { image_url: url || null })}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={it.is_available}
                onChange={(e) => onUpdate(it.id, { is_available: e.target.checked })}
              />
              Available
            </label>
            <button className="text-xs text-risk" onClick={() => onRemove(it.id)}>
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
