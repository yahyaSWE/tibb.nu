"use client";

import { useSyncExternalStore } from "react";
import type { ShopCartLine } from "@/lib/shop-types";
import {
  MAX_CART_ITEMS,
  MAX_CART_QUANTITY,
  normalizeCart,
  readCart,
} from "./cart-data";

const STORAGE_KEY = "tibb-shop-cart-v1";
type CartSnapshot = {
  lines: ShopCartLine[];
  ready: boolean;
  persistenceError: boolean;
};
const empty: CartSnapshot = {
  lines: [],
  ready: false,
  persistenceError: false,
};
let snapshot = empty;
const subscribers = new Set<() => void>();
function emit(next: CartSnapshot) {
  if (
    next.ready === snapshot.ready &&
    next.persistenceError === snapshot.persistenceError &&
    JSON.stringify(next.lines) === JSON.stringify(snapshot.lines)
  )
    return;
  snapshot = next;
  for (const subscriber of subscribers) subscriber();
}
function readStorage() {
  try {
    emit({
      lines: readCart(window.localStorage.getItem(STORAGE_KEY)),
      ready: true,
      persistenceError: false,
    });
  } catch {
    emit({ ...snapshot, ready: true, persistenceError: true });
  }
}
function storageChanged(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) readStorage();
}
function subscribe(subscriber: () => void) {
  subscribers.add(subscriber);
  if (subscribers.size === 1) {
    window.addEventListener("storage", storageChanged);
    // A failed write can leave older data readable. Keep the newer in-memory
    // cart across client navigation until an explicit storage event arrives.
    if (!snapshot.ready || !snapshot.persistenceError) readStorage();
  }
  return () => {
    subscribers.delete(subscriber);
    if (!subscribers.size)
      window.removeEventListener("storage", storageChanged);
  };
}
function write(lines: ShopCartLine[]) {
  const normalized = normalizeCart(lines);
  let persistenceError = false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    persistenceError = true;
  }
  emit({ lines: normalized, ready: true, persistenceError });
}

export function useShopCart() {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => empty,
  );
  return {
    ...state,
    addMany(items: { productId: number; quantity: number; stock: number }[]): string | null {
      const next = snapshot.lines.map(line => ({ ...line }));
      for (const item of items) {
        const current = next.find(line => line.productId === item.productId);
        const total = (current?.quantity ?? 0) + item.quantity;
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || total > Math.min(item.stock, MAX_CART_QUANTITY))
          return "Antalet i paketet och varukorgen får tillsammans vara högst 99 tillfällen per tjänst. Kontrollera varukorgen.";
        if (current) current.quantity = total; else next.push({ productId: item.productId, quantity: total });
      }
      if (next.length > MAX_CART_ITEMS) return "Varukorgen kan innehålla högst 20 olika tjänster och produkter.";
      write(next); return null;
    },
    add(productId: number, quantity: number, stock: number): string | null {
      const current = snapshot.lines.find(
        (line) => line.productId === productId,
      );
      if (!current && snapshot.lines.length >= MAX_CART_ITEMS)
        return "Varukorgen kan innehålla högst 20 olika produkter.";
      const total = (current?.quantity ?? 0) + quantity;
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        total > Math.min(stock, MAX_CART_QUANTITY)
      )
        return `Du kan lägga till högst ${Math.min(stock, MAX_CART_QUANTITY)} av denna produkt totalt. Kontrollera varukorgen.`;
      write(
        current
          ? snapshot.lines.map((line) =>
              line.productId === productId
                ? { productId, quantity: total }
                : line,
            )
          : [...snapshot.lines, { productId, quantity }],
      );
      return null;
    },
    setQuantity(productId: number, quantity: number) {
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_CART_QUANTITY
      )
        return;
      write(
        snapshot.lines.map((line) =>
          line.productId === productId ? { productId, quantity } : line,
        ),
      );
    },
    remove(productId: number) {
      write(snapshot.lines.filter((line) => line.productId !== productId));
    },
    clear() {
      write([]);
    },
  };
}
