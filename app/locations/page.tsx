"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "../lib/firebase";
import { sampleItems, sampleLocations, type InventoryItem, type InventoryLocation } from "../lib/inventory";

type LocationFormState = {
  name: string;
  type: string;
  note: string;
};

type ItemFormState = {
  itemNumber: string;
  name: string;
  category: string;
  description: string;
  colors: string;
  sizes: string;
  stock: string;
};

type ModalType = "location" | "item" | null;

const emptyLocationForm: LocationFormState = {
  name: "",
  type: "",
  note: "",
};

const emptyItemForm: ItemFormState = {
  itemNumber: "",
  name: "",
  category: "",
  description: "",
  colors: "",
  sizes: "",
  stock: "",
};

export default function LocationsPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [userName, setUserName] = useState("");
  const [items, setItems] = useState<InventoryItem[]>(sampleItems);
  const [locations, setLocations] = useState<InventoryLocation[]>(sampleLocations);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState(emptyLocationForm);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "location"; id: string; name: string } | null>(null);
  const [isReady, setIsReady] = useState(false);

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

  const getLocationDescendantIds = (locationId: string): string[] => {
    const children = locations.filter((location) => location.parentId === locationId).map((location) => location.id);
    return [locationId, ...children.flatMap((childId) => getLocationDescendantIds(childId))];
  };

  const itemsAtLocation = (locationId: string) => {
    const descendantIds = getLocationDescendantIds(locationId);
    return items.filter((item) => item.locations?.some((assignedLocationId) => descendantIds.includes(assignedLocationId)));
  };

  const handleCreateLocation = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseDb) return;

    const payload: InventoryLocation = {
      id: crypto.randomUUID(),
      name: locationForm.name.trim(),
      type: locationForm.type.trim(),
      note: locationForm.note.trim(),
      parentId: currentLocation?.id ?? null,
      children: [],
    };

    await setDoc(doc(firebaseDb, "inventory-locations", payload.id), payload);

    if (currentLocation?.id) {
      await setDoc(doc(firebaseDb, "inventory-locations", currentLocation.id), {
        ...currentLocation,
        children: [...(currentLocation.children || []), payload.id],
      });
    }

    setLocationForm(emptyLocationForm);
    setActiveModal(null);
  };

  const handleCreateItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseDb || !currentLocation) return;

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
      locations: [currentLocation.id],
      stock: Number(itemForm.stock) || 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    await setDoc(doc(firebaseDb, "inventory-items", payload.id), payload);
    setItemForm(emptyItemForm);
    setActiveModal(null);
  };

  const handleDeleteLocation = (locationId: string) => {
    const target = locations.find((location) => location.id === locationId);
    if (!target) return;
    setConfirmDelete({ type: "location", id: locationId, name: target.name });
  };

  const confirmDeleteLocation = async () => {
    if (!confirmDelete || !firebaseDb || confirmDelete.type !== "location") return;
    const locationId = confirmDelete.id;
    const target = locations.find((location) => location.id === locationId);
    if (!target) {
      setConfirmDelete(null);
      return;
    }

    const descendantIds = getLocationDescendantIds(locationId);
    const parentId = target?.parentId ?? null;

    if (parentId) {
      const parent = locations.find((location) => location.id === parentId);
      if (parent) {
        await setDoc(doc(firebaseDb, "inventory-locations", parent.id), {
          ...parent,
          children: (parent.children || []).filter((childId) => childId !== locationId),
        });
      }
    }

    const itemsToUpdate = items.filter((item) => item.locations?.some((assignedLocationId) => descendantIds.includes(assignedLocationId)));
    for (const item of itemsToUpdate) {
      const nextLocations = item.locations.filter((assignedLocationId) => !descendantIds.includes(assignedLocationId));
      await setDoc(doc(firebaseDb, "inventory-items", item.id), { ...item, locations: nextLocations });
    }

    for (const id of descendantIds) {
      await deleteDoc(doc(firebaseDb, "inventory-locations", id));
    }

    if (currentLocationId && descendantIds.includes(currentLocationId)) {
      setCurrentLocationId(parentId);
    }
  };

  if (!isReady) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#f5f3ff_60%,_#ffffff)] p-6 text-slate-800">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Loading location explorer…</h1>
          <p className="text-sm text-slate-600">Checking your Firebase session and hierarchy data.</p>
        </div>
      </main>
    );
  }

  if (!isAuth) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#f5f3ff_60%,_#ffffff)] p-6 text-slate-800">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Please sign in to view locations</h1>
          <p className="text-sm text-slate-600">Sign in first to view the hierarchy and manage locations.</p>
          <Link href="/" className="w-fit rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white">Go to home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#f5f3ff_60%,_#ffffff)] p-6 text-slate-800">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-pink-100 bg-white/80 p-6 shadow-lg shadow-pink-100 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-500">Locations</p>
              <h1 className="text-2xl font-semibold text-slate-900">Folder-style location explorer</h1>
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
          <Link href="/locations" className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white">Locations</Link>
          <Link href="/assign" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Assign</Link>
        </nav>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setCurrentLocationId(null)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium">Root</button>
              {breadcrumb.map((location, index) => (
                <div key={location.id} className="flex items-center gap-2">
                  <span className="text-slate-400">/</span>
                  <button onClick={() => setCurrentLocationId(location.id)} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700">
                    {location.name}
                  </button>
                  {index < breadcrumb.length - 1 ? <span className="text-slate-400">▶</span> : null}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setActiveModal("location")} className="rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white">Add new location</button>
              <button onClick={() => setActiveModal("item")} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Add new item</button>
              {currentLocation ? (
                <button onClick={() => handleDeleteLocation(currentLocation.id)} className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600">Delete location</button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {childLocations.length ? (
                  childLocations.map((location) => (
                    <tr key={location.id} className="border-t border-slate-200 bg-white">
                      <td className="px-4 py-3">
                        <button onClick={() => setCurrentLocationId(location.id)} className="font-semibold text-slate-900 hover:text-pink-600">
                          {location.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{location.type}</td>
                      <td className="px-4 py-3 text-slate-600">{itemsAtLocation(location.id).length}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeleteLocation(location.id)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">Delete</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No sub-locations in this folder.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Items in this location</h2>
              <span className="rounded-full bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-700">
                {itemsAtLocation(currentLocation?.id ?? "").length} total
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {itemsAtLocation(currentLocation?.id ?? "").length ? (
                itemsAtLocation(currentLocation?.id ?? "").map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    {item.name} <span className="text-slate-500">({item.itemNumber})</span>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">No items assigned to this location yet.</p>
              )}
            </div>
          </div>
        </div>

        {activeModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">{activeModal === "location" ? "Add new location" : "Add new item"}</h2>
                <button onClick={() => setActiveModal(null)} className="rounded-full border border-slate-300 px-3 py-1 text-sm">Close</button>
              </div>

              {activeModal === "location" ? (
                <form onSubmit={handleCreateLocation} className="mt-4 space-y-3">
                  <input required value={locationForm.name} onChange={(event) => setLocationForm({ ...locationForm, name: event.target.value })} placeholder="Location name" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                  <input required value={locationForm.type} onChange={(event) => setLocationForm({ ...locationForm, type: event.target.value })} placeholder="Location type" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                  <textarea value={locationForm.note} onChange={(event) => setLocationForm({ ...locationForm, note: event.target.value })} placeholder="Notes" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" rows={3} />
                  <button className="w-full rounded-full bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white">Save location</button>
                </form>
              ) : (
                <form onSubmit={handleCreateItem} className="mt-4 space-y-3">
                  <input required value={itemForm.itemNumber} onChange={(event) => setItemForm({ ...itemForm, itemNumber: event.target.value })} placeholder="Item number" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                  <input required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} placeholder="Item name" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                  <input value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value })} placeholder="Category" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                  <input value={itemForm.stock} onChange={(event) => setItemForm({ ...itemForm, stock: event.target.value })} type="number" placeholder="Stock quantity" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                  <input value={itemForm.colors} onChange={(event) => setItemForm({ ...itemForm, colors: event.target.value })} placeholder="Colors (comma separated)" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                  <input value={itemForm.sizes} onChange={(event) => setItemForm({ ...itemForm, sizes: event.target.value })} placeholder="Sizes (comma separated)" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                  <textarea value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} placeholder="Description" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" rows={3} />
                  <button className="w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Save item</button>
                </form>
              )}
            </div>
          </div>
        ) : null}
        {confirmDelete ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-900">Confirm delete</h2>
              <p className="mt-3 text-sm text-slate-600">Are you sure you want to delete <span className="font-semibold text-slate-900">{confirmDelete.name}</span> and all nested child locations? This cannot be undone.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={confirmDeleteLocation} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Yes, delete</button>
                <button onClick={() => setConfirmDelete(null)} className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
