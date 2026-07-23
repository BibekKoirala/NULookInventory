"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "../lib/firebase";
import { sampleItems, sampleLocations, type InventoryItem, type InventoryLocation } from "../lib/inventory";

const emptyItemForm = {
  itemNumber: "",
  name: "",
  category: "",
  description: "",
  colors: "",
  sizes: "",
  stock: "",
  image: "",
};

export default function AssignPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [userName, setUserName] = useState("");
  const [items, setItems] = useState<InventoryItem[]>(sampleItems);
  const [locations, setLocations] = useState<InventoryLocation[]>(sampleLocations);
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageFileName(null);
      setImageDataUrl(null);
      return;
    }

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && typeof reader.result === "string") {
        setImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setIsReady(true);
    if (!firebaseAuth || !firebaseDb) return;

    const db = firebaseDb;
    let unsubscribeItems = () => {};
    let unsubscribeLocations = () => {};

    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      const authenticated = Boolean(user);
      setIsAuth(authenticated);
      setUserName(user?.displayName || "Warehouse associate");
      if (!authenticated) {
        setItems(sampleItems);
        setLocations(sampleLocations);
        unsubscribeItems();
        unsubscribeLocations();
        return;
      }

      unsubscribeItems = onSnapshot(collection(db, "inventory-items"), (snapshot) => {
        const data = snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<InventoryItem, "id">) }));
        if (data.length) setItems(data);
      });

      unsubscribeLocations = onSnapshot(collection(db, "inventory-locations"), (snapshot) => {
        const data = snapshot.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as Omit<InventoryLocation, "id">) }));
        if (data.length) setLocations(data);
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeItems();
      unsubscribeLocations();
    };
  }, []);

  const unassignedItems = useMemo(() => items.filter((item) => !item.locations?.length), [items]);

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase();
    return unassignedItems.filter((item) => `${item.itemNumber} ${item.name} ${item.category}`.toLowerCase().includes(term));
  }, [unassignedItems, search]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedItemId) || filteredItems[0] || null,
    [filteredItems, selectedItemId],
  );

  const currentLocation = useMemo(
    () => (currentLocationId ? locations.find((location) => location.id === currentLocationId) ?? null : null),
    [currentLocationId, locations],
  );

  const breadcrumb = useMemo(() => {
    const chain: InventoryLocation[] = [];
    let cursor = currentLocation;
    while (cursor) {
      chain.unshift(cursor);
      cursor = locations.find((location) => location.id === cursor?.parentId) ?? null;
    }
    return chain;
  }, [currentLocation, locations]);

  const childLocations = useMemo(() => {
    const parentId = currentLocation?.id ?? null;
    return locations.filter((location) => location.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));
  }, [currentLocation, locations]);

  const handleCreateItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseDb) return;

    const payload: InventoryItem = {
      id: crypto.randomUUID(),
      itemNumber: itemForm.itemNumber.trim(),
      name: itemForm.name.trim(),
      category: itemForm.category.trim(),
      description: itemForm.description.trim(),
      colors: itemForm.colors
        .split(",")
        .map((entry) => ({ id: crypto.randomUUID(), name: entry.trim() }))
        .filter((entry) => entry.name),
      sizes: itemForm.sizes
        .split(",")
        .map((entry) => ({ id: crypto.randomUUID(), name: entry.trim() }))
        .filter((entry) => entry.name),
      locations: currentLocation ? [currentLocation.id] : [],
      stock: Number(itemForm.stock) || 0,
      image: imageDataUrl || itemForm.image.trim() || undefined,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    await setDoc(doc(firebaseDb, "inventory-items", payload.id), payload);
    setItemForm(emptyItemForm);
    setImageFileName(null);
    setImageDataUrl(null);
    setShowCreateForm(false);
    setSelectedItemId(payload.id);
  };

  const toggleLocationAssignment = async (locationId: string) => {
    if (!selectedItem || !firebaseDb) return;
    const current = selectedItem.locations.includes(locationId);
    const nextLocations = current
      ? selectedItem.locations.filter((entry) => entry !== locationId)
      : [...selectedItem.locations, locationId];
    await setDoc(doc(firebaseDb, "inventory-items", selectedItem.id), { ...selectedItem, locations: nextLocations });
  };

  const handleDeleteItem = () => {
    if (!selectedItem) return;
    setConfirmDelete({ id: selectedItem.id, name: selectedItem.name });
  };

  const confirmDeleteItem = async () => {
    if (!selectedItem || !firebaseDb || !confirmDelete || confirmDelete.id !== selectedItem.id) return;
    await deleteDoc(doc(firebaseDb, "inventory-items", selectedItem.id));
    setSelectedItemId(null);
    setConfirmDelete(null);
  };

  if (!isReady) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#f5f3ff_60%,_#ffffff)] p-6 text-slate-800">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Loading assignment workspace…</h1>
          <p className="text-sm text-slate-600">Preparing the item and location lists.</p>
        </div>
      </main>
    );
  }

  if (!isAuth) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#f5f3ff_60%,_#ffffff)] p-6 text-slate-800">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Please sign in to assign items</h1>
          <p className="text-sm text-slate-600">Sign in first to add items to single or multiple locations.</p>
          <Link href="/" className="w-fit rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white">Go to home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#f5f3ff_60%,_#ffffff)] p-6 text-slate-800">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-pink-100 bg-white/80 p-6 shadow-lg shadow-pink-100 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-500">Assign</p>
              <h1 className="text-2xl font-semibold text-slate-900">Assign items to locations</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">{userName}</span>
              <button onClick={() => signOut(firebaseAuth!)} className="rounded-full border border-slate-300 px-4 py-2 text-sm">Sign out</button>
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-3">
          <Link href="/" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Home</Link>
          <Link href="/lookup" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Lookup</Link>
          <Link href="/locations" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Locations</Link>
          <Link href="/assign" className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white">Assign</Link>
        </nav>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Unassigned items</h2>
                <p className="text-sm text-slate-500">Only items with no locations are shown here.</p>
              </div>
              <button onClick={() => setShowCreateForm((current) => !current)} className="rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white">
                {showCreateForm ? "Cancel" : "Create item"}
              </button>
            </div>

            {showCreateForm ? (
              <form onSubmit={handleCreateItem} className="mt-4 space-y-3">
                <input required value={itemForm.itemNumber} onChange={(event) => setItemForm({ ...itemForm, itemNumber: event.target.value })} placeholder="Item number" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                <input required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} placeholder="Item name" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                <input value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value })} placeholder="Category" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                <input value={itemForm.stock} onChange={(event) => setItemForm({ ...itemForm, stock: event.target.value })} type="number" placeholder="Stock quantity" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                <input value={itemForm.colors} onChange={(event) => setItemForm({ ...itemForm, colors: event.target.value })} placeholder="Colors (comma separated)" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                <input value={itemForm.sizes} onChange={(event) => setItemForm({ ...itemForm, sizes: event.target.value })} placeholder="Sizes (comma separated)" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                <label className="block text-sm text-slate-700">
                  Item image (optional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm file:rounded-full file:border-0 file:bg-pink-600 file:px-4 file:py-2 file:text-white file:font-semibold"
                  />
                </label>
                <input
                  value={itemForm.image}
                  onChange={(event) => setItemForm({ ...itemForm, image: event.target.value })}
                  placeholder="Image URL (optional)"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                />
                {(imageDataUrl || itemForm.image) ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Image preview</p>
                    <img src={imageDataUrl || itemForm.image} alt="Item preview" className="mt-2 h-32 w-full rounded-3xl object-cover" />
                    {imageFileName ? <p className="mt-2 text-xs text-slate-500">Selected file: {imageFileName}</p> : null}
                  </div>
                ) : null}
                <textarea value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} placeholder="Description" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" rows={3} />
                <button className="w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Save item</button>
              </form>
            ) : null}

            <div className="mt-4 space-y-3">
              {unassignedItems.length ? (
                unassignedItems.map((item) => (
                  <button key={item.id} onClick={() => setSelectedItemId(item.id)} className={`w-full rounded-2xl border p-3 text-left ${selectedItem?.id === item.id ? "border-pink-400 bg-pink-50" : "border-slate-200"}`}>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">{item.itemNumber}</p>
                  </button>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No unassigned items found. Create one above to assign it to a location.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Location tree</h2>
                <p className="text-sm text-slate-500">Navigate locations and assign the selected item below.</p>
              </div>
              <button onClick={() => setCurrentLocationId(null)} className="rounded-full border border-slate-300 px-4 py-2 text-sm">Root</button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              {breadcrumb.length ? (
                breadcrumb.map((location, index) => (
                  <button key={location.id} onClick={() => setCurrentLocationId(location.id)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                    {location.name}
                  </button>
                ))
              ) : (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Root</span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {childLocations.length ? (
                childLocations.map((location) => (
                  <button key={location.id} onClick={() => setCurrentLocationId(location.id)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-50">
                    <span>{location.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{location.type}</span>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No child locations in this folder.</div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Assign item here</p>
              <p className="mt-1 text-sm text-slate-600">Selected location: {currentLocation ? currentLocation.name : "Root"}</p>
              <p className="mt-1 text-sm text-slate-600">Selected item: {selectedItem ? selectedItem.name : "None"}</p>
              <button
                disabled={!selectedItem || !currentLocation}
                onClick={() => currentLocation && selectedItem && toggleLocationAssignment(currentLocation.id)}
                className="mt-4 w-full rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {selectedItem?.locations?.includes(currentLocation?.id ?? "") ? "Remove from this location" : "Assign to this location"}
              </button>
              {selectedItem ? (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  {selectedItem.image ? (
                    <img src={selectedItem.image} alt={selectedItem.name} className="mb-4 h-32 w-full rounded-3xl object-cover" />
                  ) : null}
                  <button
                    onClick={handleDeleteItem}
                    className="mt-3 w-full rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Delete item
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {confirmDelete ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-900">Confirm delete</h2>
              <p className="mt-3 text-sm text-slate-600">Are you sure you want to delete <span className="font-semibold text-slate-900">{confirmDelete.name}</span>? This action cannot be undone.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={confirmDeleteItem} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Yes, delete</button>
                <button onClick={() => setConfirmDelete(null)} className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
