// Va en: apps/web/src/hooks/use-cart.ts
import { create } from 'zustand';

export interface CartLine {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  taxRate: number;
  quantity: number;
  discount: number;
}

interface CartState {
  lines: CartLine[];
  addProduct: (p: Omit<CartLine, 'quantity' | 'discount'>, qty?: number) => void;
  setQuantity: (productId: string, qty: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
  totals: () => { subtotal: number; tax: number; discount: number; grandTotal: number };
}

export const useCart = create<CartState>((set, get) => ({
  lines: [],

  addProduct: (p, qty = 1) => set((s) => {
    const existe = s.lines.find((l) => l.productId === p.productId);
    if (existe) {
      return { lines: s.lines.map((l) =>
        l.productId === p.productId ? { ...l, quantity: l.quantity + qty } : l) };
    }
    return { lines: [...s.lines, { ...p, quantity: qty, discount: 0 }] };
  }),

  setQuantity: (productId, qty) => set((s) => ({
    lines: qty <= 0
      ? s.lines.filter((l) => l.productId !== productId)
      : s.lines.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l)),
  })),

  removeLine: (productId) => set((s) => ({
    lines: s.lines.filter((l) => l.productId !== productId),
  })),

  clear: () => set({ lines: [] }),

  totals: () => {
    let subtotal = 0, tax = 0, discount = 0;
    for (const l of get().lines) {
      const neto = l.quantity * l.unitPrice - l.discount;
      subtotal += neto;
      discount += l.discount;
      tax += Math.round(neto * l.taxRate * 100) / 100;
    }
    return { subtotal, tax, discount, grandTotal: subtotal + tax };
  },
}));
