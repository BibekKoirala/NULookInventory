export type SizeOption = { id: string; name: string };
export type ColorOption = { id: string; name: string };
export type InventoryLocation = {
  id: string;
  name: string;
  type: string;
  note?: string;
  parentId?: string | null;
  children?: string[];
};
export type InventoryItem = {
  id: string;
  itemNumber: string;
  name: string;
  category: string;
  description: string;
  colors: ColorOption[];
  sizes: SizeOption[];
  locations: string[];
  stock: number;
  image?: string;
  createdAt: string;
};

export const sampleLocations: InventoryLocation[] = [
  { id: "loc-1", name: "Downtown Flagship", type: "Main Floor", note: "High-demand styles", parentId: null, children: ["loc-3"] },
  { id: "loc-2", name: "Warehouse West", type: "Backstock", note: "Bulk replenishment", parentId: null, children: [] },
  { id: "loc-3", name: "Second Floor Rack", type: "Zone", note: "Accessories", parentId: "loc-1", children: [] },
];

export const sampleItems: InventoryItem[] = [
  {
    id: "item-1",
    itemNumber: "WF-1001",
    name: "Aurora Wrap Dress",
    category: "Dresses",
    description: "Soft satin midi dress with draped neckline.",
    colors: [{ id: "c1", name: "Rose" }, { id: "c2", name: "Midnight" }],
    sizes: [{ id: "s1", name: "S" }, { id: "s2", name: "M" }, { id: "s3", name: "L" }],
    locations: ["loc-1", "loc-2"],
    stock: 14,
    createdAt: "2026-07-15",
  },
  {
    id: "item-2",
    itemNumber: "WF-1002",
    name: "Luna Tailored Blazer",
    category: "Outerwear",
    description: "Structured blazer with sculpted shoulders.",
    colors: [{ id: "c3", name: "Camel" }, { id: "c4", name: "Black" }],
    sizes: [{ id: "s1", name: "S" }, { id: "s2", name: "M" }, { id: "s4", name: "XL" }],
    locations: ["loc-2"],
    stock: 8,
    createdAt: "2026-07-18",
  },
];
