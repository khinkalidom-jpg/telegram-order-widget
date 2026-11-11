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

export const ui = {
 brand:'BLOOM', subtitle:'FLOWER ATELIER', intro:'Thoughtfully chosen bouquets, a little closer.',
 demo:'Demo store — no payment or delivery', shop:'Shop bouquets', cart:'Cart', help:'Help',home:'Home',again:'Shop again',
 prev:'Previous',next:'Next',add:'+',sub:'−',remove:'Remove',per:'per bouquet',review:'Review order',confirm:'Confirm demo order',
 empty:'Your cart is empty',sold:'Unavailable',photo:'Photography pending',total:'Total',thanks:'Thank you',order:'Demo order #',
 helpText:'Choose a bouquet, adjust quantities and review your cart. This demonstration takes no payment and arranges no delivery.',
 loading:'Updating…',retry:'Please try again.',photoCaption:'',
 shortDescription:'BLOOM demo flower shop. Tap Start to explore bouquets. No payment or delivery.',
 description:'Welcome to BLOOM, a demo flower shop. Tap Start, browse ready-made bouquets and place a demonstration order. No payment or delivery.',
 commands:[{command:'start',description:'Home'},{command:'catalog',description:'Shop bouquets'},{command:'cart',description:'My cart'},{command:'help',description:'Help'}]
};
export const adminText={denied:'Administrator access is not configured for this user.',menu:'Bouquet studio',add:'Add bouquet',cancel:'Cancel',publish:'Publish',name:'Send the bouquet name (1–48 characters).',description:'Send a short description (1–120 characters).',price:'Send the price in GEL, for example 120.00 (1–100000).',photo:'Send a photograph as a Telegram photo message. Use only photos you have permission to use.',preview:'Review this bouquet before publishing.',saved:'Bouquet saved.',cancelled:'Draft cancelled.',invalid:'Invalid value. Please try again.',edit:'Send a new value.',hide:'Hide',show:'Make available',editName:'Name',editDescription:'Description',editPrice:'Price',editPhoto:'Photo'};

export const storeText = {
  "e0": "Screen is too large.",
  "e1": "Invalid bouquet.",
  "e2": "This cart belongs to another customer.",
  "e3": "A bouquet is unavailable. Remove it from your cart.",
  "e4": "Invalid widget request.",
  "e5": "Unknown widget.",
  "e6": "Invalid action.",
  "e7": "Start a new order first.",
  "e8": "Unknown bouquet.",
  "e9": "This bouquet is unavailable.",
  "e10": "Quantity must be 0–20.",
  "e11": "A cart can contain up to 20 different bouquets.",
  "e12": "Your cart is empty.",
  "e13": "Finish this order first.",
  "e14": "Unknown action."
};
