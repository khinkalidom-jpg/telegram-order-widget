import { shop } from './config.js';
export function parseCart(payload) {
  if (typeof payload !== 'string' || Buffer.byteLength(payload) > 64) throw new Error('Invalid payload size.');
  let cart;
  try { cart = JSON.parse(payload); } catch { throw new Error('Invalid cart.'); }
  if (!Array.isArray(cart) || !cart.length || cart.length > shop.products.length) throw new Error('Select at least one flower.');
  const seen = new Set();
  const items = cart.map(row => {
    if (!Array.isArray(row) || row.length !== 2) throw new Error('Invalid item.');
    const [id, quantity] = row;
    const p = shop.products.find(p => p.id === id);
    if (!p || seen.has(id)) throw new Error('Unknown or duplicate product.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Quantity must be 1–20.');
    seen.add(id);
    return { id, name: p.name, quantity, price: p.price };
  });
  return { items, total: items.reduce((sum, p) => sum + p.price * p.quantity, 0) };
}
