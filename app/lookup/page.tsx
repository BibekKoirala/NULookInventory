"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "../lib/firebase";
import { sampleItems, sampleLocations, type InventoryItem, type InventoryLocation } from "../lib/inventory";

export default function LookupPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [userName, setUserName] = useState("");
  const [items, setItems] = useState<InventoryItem[]>(sampleItems);
  const [locations, setLocations] = useState<InventoryLocation[]>(sampleLocations);
  const [search, setSearch] = useState("");
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

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase();
    return items.filter((item) => `${item.itemNumber} ${item.name} ${item.category} ${item.description}`.toLowerCase().includes(term));
  }, [items, search]);

  const getLocationPath = (locationId: string): string[] => {
    const location = locations.find((entry) => entry.id === locationId);
    if (!location) return [];

    const parentPath = location.parentId ? getLocationPath(location.parentId) : [];
    return [...parentPath, location.name];
  };

  const getLocationPaths = (locationIds: string[]) =>
    locationIds
      ?.map((locationId) => getLocationPath(locationId))
      .filter((path) => path.length)
      .map((path) => path.join(" > "));

  if (!isReady) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#f5f3ff_60%,_#ffffff)] p-6 text-slate-800">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Loading inventory…</h1>
          <p className="text-sm text-slate-600">Preparing the latest catalog and location data.</p>
        </div>
      </main>
    );
  }

  if (!isAuth) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#f5f3ff_60%,_#ffffff)] p-6 text-slate-800">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Please sign in to access inventory</h1>
          <p className="text-sm text-slate-600">Use the Google sign-in button from the home page to continue.</p>
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
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-500">Lookup</p>
              <h1 className="text-2xl font-semibold text-slate-900">Search inventory by item</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">{userName}</span>
              <button onClick={() => signOut(firebaseAuth!)} className="rounded-full border border-slate-300 px-4 py-2 text-sm">Sign out</button>
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-3">
          <Link href="/" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Home</Link>
          <Link href="/lookup" className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white">Lookup</Link>
          <Link href="/locations" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Locations</Link>
          <Link href="/assign" className="rounded-full border border-slate-300 px-4 py-2 text-sm">Assign</Link>
        </nav>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <input value={search ?? ""} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item number, name, or category" className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.itemNumber}</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">{item.stock} in stock</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{item.description}</p>
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Locations</p>
                  <div className="mt-1 space-y-1 text-sm text-slate-700">
                    {getLocationPaths(item?.locations ?? []).length ? (
                      getLocationPaths(item?.locations ?? []).map((path) => <p key={path}>{path}</p>)
                    ) : (
                      <p>Not assigned</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
