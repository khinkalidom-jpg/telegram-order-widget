export const shop = {
  name: 'BLOOM', subtitle: 'Flower Delivery',
  notice: 'Demo store — no payment or delivery.',
  intro: 'Welcome to BLOOM — Flower Delivery. Explore our demo collection below.',
  checkout: 'Place demo order',
  products: [
    { id: 'r', name: 'Red Roses', price: 12000, color: '#ac4054' },
    { id: 't', name: 'Pink Tulips', price: 8500, color: '#d07c9c' },
    { id: 'w', name: 'White Roses', price: 11000, color: '#d7cbb0' },
    { id: 'b', name: 'Premium Bouquet', price: 18000, color: '#9a6a97' },
  ],
};
export const money = n => `${Math.floor(n / 100)}${n % 100 ? '.' + String(n % 100).padStart(2, '0') : ''} ₾`;
