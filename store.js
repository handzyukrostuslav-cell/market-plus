// Спільний модуль даних та хмарної синхронізації для магазину Marker Plus
const MarkerStore = (() => {
  const KEYS = {
    PRODUCTS: 'markerplus_products_v2',
    CATEGORIES: 'markerplus_categories_v2',
    ORDERS: 'markerplus_orders_v2',
    ORDER_COUNTER: 'markerplus_order_counter_v2',
    SETTINGS: 'markerplus_settings_v2'
  };

  const LEGACY_KEYS = {
    PRODUCTS: 'markerplus_products_v1',
    ORDERS: 'markerplus_orders_v1',
    ORDER_COUNTER: 'markerplus_order_counter_v1',
    SETTINGS: 'markerplus_settings_v1'
  };

  const ALCOHOL_CATEGORY = 'Алкоголь та тютюнові вироби';

  const DEFAULT_SETTINGS = {
    firebaseUrl: 'https://marker-plus-default-rtdb.europe-west1.firebasedatabase.app',
    cardNumber: 'Вкажіть номер картки в адмін-панелі',
    cardHolder: 'Marker Plus • с. Гвізд, вул. Синяка, буд. 19А',
    adminPassword: 'marketplus3845fff',
    loyaltyThreshold: 5,
    loyaltyDiscount: 5,
    hideEmptyCategories: false
  };

  const INITIAL_CATEGORIES = [
    { name: 'Хліб та випічка', hidden: false },
    { name: 'Молочні продукти', hidden: false },
    { name: 'Ковбаси та сири', hidden: false },
    { name: 'Бакалія та крупи', hidden: false },
    { name: 'Напої', hidden: false },
    { name: 'Солодощі та снеки', hidden: false },
    { name: 'Овочі та фрукти', hidden: false },
    { name: 'Побутова хімія', hidden: false },
    { name: ALCOHOL_CATEGORY, hidden: false }
  ];

  const INITIAL_PRODUCTS = [
    { id: 'p1', sku: '101', name: 'Хліб білий нарізний', category: 'Хліб та випічка', price: 28, unit: 'шт', icon: '🍞', image: '', inStock: true },
    { id: 'p2', sku: '102', name: 'Батон домашній', category: 'Хліб та випічка', price: 26, unit: 'шт', icon: '🥖', image: '', inStock: true },
    { id: 'p3', sku: '103', name: 'Молоко 2.5% пастеризоване', category: 'Молочні продукти', price: 44, unit: '900 мл', icon: '🥛', image: '', inStock: true },
    { id: 'p4', sku: '104', name: 'Сметана 20%', category: 'Молочні продукти', price: 48, unit: '400 г', icon: '🥛', image: '', inStock: true },
    { id: 'p5', sku: '105', name: 'Сир твердий Голландський', category: 'Ковбаси та сири', price: 320, unit: '1 кг', icon: '🧀', image: '', inStock: true },
    { id: 'p6', sku: '106', name: 'Крупа гречана ядриця', category: 'Бакалія та крупи', price: 42, unit: '1 кг', icon: '🌾', image: '', inStock: true },
    { id: 'p7', sku: '107', name: 'Олія соняшникова рафінована', category: 'Бакалія та крупи', price: 68, unit: '850 мл', icon: '🌻', image: '', inStock: true },
    { id: 'p8', sku: '108', name: 'Цукор білий кристалічний', category: 'Бакалія та крупи', price: 34, unit: '1 кг', icon: '🍚', image: '', inStock: true },
    { id: 'p9', sku: '109', name: 'Яйця курячі столові С1', category: 'Молочні продукти', price: 62, unit: '10 шт', icon: '🥚', image: '', inStock: true },
    { id: 'p10', sku: '110', name: 'Вода мінеральна негазована', category: 'Напої', price: 22, unit: '1.5 л', icon: '🧃', image: '', inStock: true },
    { id: 'p11', sku: '111', name: 'Чай чорний листовий', category: 'Солодощі та снеки', price: 58, unit: '100 г', icon: '🍫', image: '', inStock: true },
    { id: 'p12', sku: '112', name: 'Засіб для миття посуду', category: 'Побутова хімія', price: 54, unit: '500 мл', icon: '🧴', image: '', inStock: true }
  ];

  let lastOrdersMap = new Map();
  let syncInProgress = false;
  let syncState = {
    status: 'local', // 'local' | 'connected' | 'error'
    lastSyncAt: null,
    lastError: ''
  };

  function normalizeFirebaseUrl(rawUrl) {
    const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return 'https://' + trimmed;
  }

  function getFirebaseBaseUrl() {
    const settings = getSettings();
    return normalizeFirebaseUrl(settings.firebaseUrl || DEFAULT_SETTINGS.firebaseUrl);
  }

  function notifyUpdated(detail = {}) {
    try {
      window.dispatchEvent(
        new CustomEvent('markerstore:updated', {
          detail: { ...detail, syncState: { ...syncState } }
        })
      );
    } catch {
      // Ігноруємо у середовищах без CustomEvent
    }
  }

  function migrateFromV1() {
    try {
      const legacyOrdersRaw = localStorage.getItem(LEGACY_KEYS.ORDERS);
      if (legacyOrdersRaw) {
        const legacyOrders = JSON.parse(legacyOrdersRaw);
        if (Array.isArray(legacyOrders) && legacyOrders.length > 0) {
          let currentOrders = [];
          try {
            currentOrders = JSON.parse(localStorage.getItem(KEYS.ORDERS)) || [];
          } catch {
            currentOrders = [];
          }
          const existingIds = new Set(currentOrders.map((o) => o.id));
          let added = false;

          legacyOrders.forEach((oldOrd) => {
            if (oldOrd && oldOrd.id && !existingIds.has(oldOrd.id)) {
              const normalizedItems = (oldOrd.items || []).map((i) => ({
                ...i,
                originalQty: i.originalQty || i.qty,
                packed: Boolean(i.packed),
                status: i.status || 'active',
                replacement: i.replacement || null
              }));
              const normalizedOrder = recalculateOrderTotals({
                ...oldOrd,
                phoneNormalized: oldOrd.phoneNormalized || normalizePhone(oldOrd.phone),
                items: normalizedItems,
                discountPercent: Number(oldOrd.discountPercent || 0),
                originalTotal: Number(oldOrd.originalTotal || oldOrd.total || 0),
                clientArriving: oldOrd.clientArriving || '',
                clientArrivingAt: oldOrd.clientArrivingAt || '',
                addedNote: oldOrd.addedNote || '',
                timestamp: oldOrd.timestamp || Date.now()
              });
              currentOrders.push(normalizedOrder);
              existingIds.add(oldOrd.id);
              added = true;
            }
          });

          if (added) {
            currentOrders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            localStorage.setItem(KEYS.ORDERS, JSON.stringify(currentOrders));
          }
          localStorage.removeItem(LEGACY_KEYS.ORDERS);
        }
      }

      if (!localStorage.getItem(KEYS.PRODUCTS) && localStorage.getItem(LEGACY_KEYS.PRODUCTS)) {
        localStorage.setItem(KEYS.PRODUCTS, localStorage.getItem(LEGACY_KEYS.PRODUCTS));
      }

      if (!localStorage.getItem(KEYS.SETTINGS) && localStorage.getItem(LEGACY_KEYS.SETTINGS)) {
        const oldSet = JSON.parse(localStorage.getItem(LEGACY_KEYS.SETTINGS)) || {};
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...DEFAULT_SETTINGS, ...oldSet }));
      }

      if (!localStorage.getItem(KEYS.ORDER_COUNTER) && localStorage.getItem(LEGACY_KEYS.ORDER_COUNTER)) {
        localStorage.setItem(KEYS.ORDER_COUNTER, localStorage.getItem(LEGACY_KEYS.ORDER_COUNTER));
      }
    } catch {
      // Ігноруємо помилки парсингу застарілих даних
    }
  }

  function init() {
    migrateFromV1();

    if (!localStorage.getItem(KEYS.PRODUCTS)) {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    }
    if (!localStorage.getItem(KEYS.CATEGORIES)) {
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
    }
    if (!localStorage.getItem(KEYS.ORDERS)) {
      localStorage.setItem(KEYS.ORDERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(KEYS.SETTINGS)) {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }

    if (lastOrdersMap.size === 0) {
      try {
        const existing = JSON.parse(localStorage.getItem(KEYS.ORDERS)) || [];
        if (Array.isArray(existing)) {
          existing.forEach((o) => {
            if (o && o.id) lastOrdersMap.set(o.id, JSON.stringify(o));
          });
        }
      } catch {
        // Ігноруємо
      }
    }
  }

  function getProducts() {
    init();
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.PRODUCTS));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async function cloudPut(path, payload) {
    const baseUrl = getFirebaseBaseUrl();
    if (!baseUrl) return false;
    try {
      const res = await fetch(`${baseUrl}/markerplus/${path}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      syncState = { status: 'connected', lastSyncAt: new Date(), lastError: '' };
      notifyUpdated({ source: 'push' });
      return true;
    } catch (err) {
      syncState = { status: 'error', lastSyncAt: syncState.lastSyncAt, lastError: err.message || 'Помилка мережі' };
      notifyUpdated({ source: 'error' });
      return false;
    }
  }

  function saveProducts(products) {
    try {
      localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products));
      cloudPut('products', products);
    } catch {
      alert('Пам’ять браузера переповнена. Використовуйте менші фото або посилання URL.');
    }
  }

  function getCategories() {
    init();
    let cats = [];
    try {
      cats = JSON.parse(localStorage.getItem(KEYS.CATEGORIES)) || [];
    } catch {
      cats = [...INITIAL_CATEGORIES];
    }

    const products = getProducts();
    const existingNames = new Set(cats.map((c) => c.name));
    let changed = false;

    products.forEach((p) => {
      if (p.category && !existingNames.has(p.category)) {
        cats.push({ name: p.category, hidden: false });
        existingNames.add(p.category);
        changed = true;
      }
    });

    if (!existingNames.has(ALCOHOL_CATEGORY)) {
      cats.push({ name: ALCOHOL_CATEGORY, hidden: false });
      changed = true;
    }

    if (changed) {
      saveCategories(cats);
    }

    return cats;
  }

  function saveCategories(categories) {
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
    cloudPut('categories', categories);
  }

  function getOrders() {
    init();
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.ORDERS));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveOrders(orders) {
    try {
      localStorage.setItem(KEYS.ORDERS, JSON.stringify(orders));

      const nextMap = new Map();
      orders.forEach((o) => {
        if (!o || !o.id) return;
        const serialized = JSON.stringify(o);
        nextMap.set(o.id, serialized);
        if (lastOrdersMap.get(o.id) !== serialized) {
          cloudPut(`orders/${encodeURIComponent(o.id)}`, o);
        }
      });
      lastOrdersMap = nextMap;
    } catch {
      alert('Не вдалося зберегти замовлення: пам’ять браузера переповнена.');
    }
  }

  function getSettings() {
    init();
    try {
      const stored = JSON.parse(localStorage.getItem(KEYS.SETTINGS)) || {};
      const merged = { ...DEFAULT_SETTINGS, ...stored };
      if (!merged.firebaseUrl && DEFAULT_SETTINGS.firebaseUrl) {
        merged.firebaseUrl = DEFAULT_SETTINGS.firebaseUrl;
      }
      return merged;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  function saveSettings(settings) {
    const merged = { ...getSettings(), ...settings };
    if (merged.firebaseUrl) {
      merged.firebaseUrl = normalizeFirebaseUrl(merged.firebaseUrl);
    }
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(merged));

    if (merged.firebaseUrl) {
      cloudPut('settings', merged);
    } else {
      syncState = { status: 'local', lastSyncAt: null, lastError: '' };
      notifyUpdated({ source: 'settings' });
    }
  }

  async function syncFromCloud() {
    const baseUrl = getFirebaseBaseUrl();
    if (!baseUrl) {
      syncState = { status: 'local', lastSyncAt: null, lastError: '' };
      return false;
    }
    if (syncInProgress) return false;
    syncInProgress = true;

    try {
      const res = await fetch(`${baseUrl}/markerplus.json`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      let changed = false;

      if (data && typeof data === 'object') {
        if (Array.isArray(data.products)) {
          const prevProd = localStorage.getItem(KEYS.PRODUCTS);
          const nextProd = JSON.stringify(data.products);
          if (prevProd !== nextProd) {
            localStorage.setItem(KEYS.PRODUCTS, nextProd);
            changed = true;
          }
        }

        if (Array.isArray(data.categories)) {
          const prevCats = localStorage.getItem(KEYS.CATEGORIES);
          const nextCats = JSON.stringify(data.categories);
          if (prevCats !== nextCats) {
            localStorage.setItem(KEYS.CATEGORIES, nextCats);
            changed = true;
          }
        }

        if (data.settings && typeof data.settings === 'object') {
          const currentSet = getSettings();
          const mergedSet = {
            ...DEFAULT_SETTINGS,
            ...data.settings,
            firebaseUrl: currentSet.firebaseUrl || data.settings.firebaseUrl || ''
          };
          const prevSet = localStorage.getItem(KEYS.SETTINGS);
          const nextSet = JSON.stringify(mergedSet);
          if (prevSet !== nextSet) {
            localStorage.setItem(KEYS.SETTINGS, nextSet);
            changed = true;
          }
        }

        if (data.orders !== undefined) {
          let cloudOrdersArr = [];
          if (Array.isArray(data.orders)) {
            cloudOrdersArr = data.orders.filter(Boolean);
          } else if (data.orders && typeof data.orders === 'object') {
            cloudOrdersArr = Object.values(data.orders).filter(Boolean);
          }

          cloudOrdersArr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

          const prevOrders = localStorage.getItem(KEYS.ORDERS);
          const nextOrders = JSON.stringify(cloudOrdersArr);

          const nextMap = new Map();
          cloudOrdersArr.forEach((o) => {
            if (o && o.id) nextMap.set(o.id, JSON.stringify(o));
          });
          lastOrdersMap = nextMap;

          if (prevOrders !== nextOrders) {
            localStorage.setItem(KEYS.ORDERS, nextOrders);
            changed = true;
          }
        }
      }

      syncState = { status: 'connected', lastSyncAt: new Date(), lastError: '' };
      notifyUpdated({ source: 'pull', changed });
      return true;
    } catch (err) {
      syncState = {
        status: 'error',
        lastSyncAt: syncState.lastSyncAt,
        lastError: err.message || 'Не вдалося підключитися до хмари'
      };
      notifyUpdated({ source: 'error', changed: false });
      return false;
    } finally {
      syncInProgress = false;
    }
  }

  async function pushAllToCloud() {
    const baseUrl = getFirebaseBaseUrl();
    if (!baseUrl) return false;

    const ordersObj = {};
    getOrders().forEach((o) => {
      if (o && o.id) ordersObj[o.id] = o;
    });

    const payload = {
      products: getProducts(),
      categories: getCategories(),
      orders: ordersObj,
      settings: getSettings()
    };

    try {
      const res = await fetch(`${baseUrl}/markerplus.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      syncState = { status: 'connected', lastSyncAt: new Date(), lastError: '' };
      notifyUpdated({ source: 'push_all', changed: true });
      return true;
    } catch (err) {
      syncState = {
        status: 'error',
        lastSyncAt: syncState.lastSyncAt,
        lastError: err.message || 'Помилка запису у хмару'
      };
      notifyUpdated({ source: 'error', changed: false });
      return false;
    }
  }

  function getSyncState() {
    const baseUrl = getFirebaseBaseUrl();
    if (!baseUrl) {
      return { status: 'local', lastSyncAt: null, lastError: '' };
    }
    return { ...syncState };
  }

  function normalizePhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('0')) {
      return '38' + digits;
    }
    if (digits.length === 9) {
      return '380' + digits;
    }
    return digits;
  }

  function getClientLoyalty(phone) {
    const norm = normalizePhone(phone);
    const settings = getSettings();
    const threshold = Math.max(1, Number(settings.loyaltyThreshold) || 5);
    const configuredDiscount = Math.max(0, Number(settings.loyaltyDiscount) || 0);

    if (!norm) {
      return {
        successfulOrders: 0,
        threshold,
        remaining: threshold,
        isLoyal: false,
        discountPercent: 0
      };
    }

    const orders = getOrders().filter(
      (o) => o.phoneNormalized === norm && o.status !== 'Відхилено'
    );
    const count = orders.length;
    const isLoyal = count >= threshold;

    return {
      successfulOrders: count,
      threshold,
      remaining: Math.max(0, threshold - count),
      isLoyal,
      discountPercent: isLoyal ? configuredDiscount : 0
    };
  }

  function recalculateOrderTotals(order) {
    let subtotal = 0;

    (order.items || []).forEach((item) => {
      const st = item.status || 'active';
      if (st === 'active') {
        subtotal += Number(item.price || 0) * Number(item.qty || 0);
      } else if (st === 'replaced' && item.replacement) {
        subtotal += Number(item.replacement.price || 0) * Number(item.replacement.qty || 0);
      }
    });

    subtotal = Math.round(subtotal * 100) / 100;
    const discPct = Number(order.discountPercent || 0);
    const discountAmount =
      discPct > 0 ? Math.round(((subtotal * discPct) / 100) * 100) / 100 : 0;
    const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    order.subtotal = subtotal;
    order.discountAmount = discountAmount;
    order.total = total;
    return order;
  }

  function peekNextOrderCode() {
    const orders = getOrders();
    let lastNum = parseInt(localStorage.getItem(KEYS.ORDER_COUNTER) || '0', 10);
    if (isNaN(lastNum) || lastNum < 0) lastNum = 0;

    orders.forEach((o) => {
      const n = parseInt(String(o.code).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > lastNum) lastNum = n;
    });

    return String(lastNum + 1).padStart(4, '0');
  }

  function generateNextOrderCode() {
    const code = peekNextOrderCode();
    const numeric = parseInt(code, 10);
    localStorage.setItem(KEYS.ORDER_COUNTER, String(numeric));
    return code;
  }

  function createOrder({ fullName, phone, paymentMethod, items, hasAdultItems }) {
    const orders = getOrders();
    const code = generateNextOrderCode();
    const now = new Date();
    const dateStr = now.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const loyalty = getClientLoyalty(phone);
    const preparedItems = items.map((i) => ({
      ...i,
      originalQty: i.qty,
      packed: false,
      status: 'active',
      replacement: null
    }));

    const newOrder = recalculateOrderTotals({
      id: 'ord_' + Date.now() + '_' + code,
      code,
      fullName: fullName.trim(),
      phone: phone.trim(),
      phoneNormalized: normalizePhone(phone),
      paymentMethod,
      items: preparedItems,
      discountPercent: loyalty.discountPercent,
      subtotal: 0,
      discountAmount: 0,
      total: 0,
      originalTotal: 0,
      hasAdultItems: Boolean(hasAdultItems),
      status: 'Розміщено',
      clientArriving: '',
      clientArrivingAt: '',
      addedNote: '',
      createdAt: dateStr,
      timestamp: Date.now()
    });

    newOrder.originalTotal = newOrder.total;

    orders.unshift(newOrder);
    saveOrders(orders);
    return newOrder;
  }

  function mergeItemsIntoOrder(orderId, newItems, hasAdult) {
    const orders = getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return null;

    const order = orders[idx];
    newItems.forEach((ni) => {
      const existing = order.items.find(
        (oi) => oi.id === ni.id && (oi.status || 'active') === 'active'
      );
      if (existing) {
        existing.qty = Math.round((Number(existing.qty) + Number(ni.qty)) * 1000) / 1000;
        existing.originalQty = existing.qty;
        existing.packed = false;
      } else {
        order.items.push({
          ...ni,
          originalQty: ni.qty,
          packed: false,
          status: 'active',
          replacement: null
        });
      }
    });

    if (hasAdult) order.hasAdultItems = true;
    const timeStr = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    order.addedNote = `Клієнт дозамовив позиції о ${timeStr}`;

    recalculateOrderTotals(order);
    order.originalTotal = order.total;
    orders[idx] = order;
    saveOrders(orders);
    return order;
  }

  function updateOrderStatus(orderId, newStatus) {
    const orders = getOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx !== -1) {
      orders[idx].status = newStatus;
      if (newStatus !== 'Готове до видачі') {
        orders[idx].clientArriving = '';
      }
      saveOrders(orders);
    }
  }

  function getCustomerAnalytics() {
    const orders = getOrders();
    const settings = getSettings();
    const threshold = Math.max(1, Number(settings.loyaltyThreshold) || 5);
    const map = new Map();

    orders.forEach((order) => {
      const key = order.phoneNormalized || normalizePhone(order.phone);
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          phoneKey: key,
          phoneDisplay: order.phone,
          fullName: order.fullName,
          totalOrders: 0,
          successfulOrders: 0,
          rejectedOrders: 0,
          successfulSum: 0,
          lastOrderDate: order.createdAt
        });
      }

      const entry = map.get(key);
      entry.totalOrders += 1;

      if (order.status === 'Відхилено') {
        entry.rejectedOrders += 1;
      } else {
        entry.successfulOrders += 1;
        entry.successfulSum += Number(order.total || 0);
      }
    });

    return Array.from(map.values())
      .map((c) => {
        const successRate =
          c.totalOrders > 0 ? Math.round((c.successfulOrders / c.totalOrders) * 100) : 0;
        const avgCheck =
          c.successfulOrders > 0 ? Math.round(c.successfulSum / c.successfulOrders) : 0;
        const isLoyal = c.successfulOrders >= threshold;
        return { ...c, successRate, avgCheck, isLoyal };
      })
      .sort((a, b) => b.successfulSum - a.successfulSum);
  }

  function formatPrice(val) {
    return Number(val || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 }) + ' грн';
  }

  function formatQty(val) {
    return Number(Number(val || 0).toFixed(3));
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    KEYS,
    ALCOHOL_CATEGORY,
    getProducts,
    saveProducts,
    getCategories,
    saveCategories,
    getOrders,
    saveOrders,
    getSettings,
    saveSettings,
    syncFromCloud,
    pushAllToCloud,
    getSyncState,
    normalizePhone,
    getClientLoyalty,
    recalculateOrderTotals,
    peekNextOrderCode,
    createOrder,
    mergeItemsIntoOrder,
    updateOrderStatus,
    getCustomerAnalytics,
    formatPrice,
    formatQty,
    escapeHtml
  };
})();
