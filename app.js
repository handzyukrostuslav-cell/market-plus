(() => {
  const CART_KEY = 'markerplus_cart_v2';
  const FAV_KEY = 'markerplus_favorites_v2';
  const CLIENT_KEY = 'markerplus_client_profile_v2';
  const AGE_SESSION_KEY = 'markerplus_age_verified_v2';
  const ALCOHOL_CATEGORY = MarkerStore.ALCOHOL_CATEGORY;

  let selectedCategory = 'all';
  let searchQuery = '';
  let currentView = 'catalog';
  let lastClientPhone = '';
  let lastCabinetSnapshot = '';
  let bagModalSelection = new Map();

  const viewCatalog = document.getElementById('view-catalog');
  const viewCabinet = document.getElementById('view-cabinet');
  const categoriesBar = document.getElementById('categories-bar');
  const productsGrid = document.getElementById('products-grid');
  const catalogHeading = document.getElementById('catalog-heading');
  const catalogCount = document.getElementById('catalog-count');
  const catalogSearch = document.getElementById('catalog-search');
  const favoritesBadge = document.getElementById('favorites-count-badge');
  const cabinetAlertBadge = document.getElementById('cabinet-alert-badge');

  const cartDrawer = document.getElementById('cart-drawer');
  const cartBackdrop = document.getElementById('cart-backdrop');
  const headerCartCount = document.getElementById('header-cart-count');
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartBagsSection = document.getElementById('cart-bags-section');
  const cartBagsList = document.getElementById('cart-bags-list');
  const cartCheckoutSection = document.getElementById('cart-checkout-section');
  const cartDiscountRow = document.getElementById('cart-discount-row');
  const cartLoyaltyLabel = document.getElementById('cart-loyalty-label');
  const cartDiscountSum = document.getElementById('cart-discount-sum');
  const cartTotalSum = document.getElementById('cart-total-sum');

  const activeOrderMergeBox = document.getElementById('active-order-merge-box');
  const activeOrderMergeText = document.getElementById('active-order-merge-text');
  const mergeIntoActiveBtn = document.getElementById('merge-into-active-btn');

  const checkoutForm = document.getElementById('checkout-form');
  const orderFullnameInput = document.getElementById('order-fullname');
  const orderPhoneInput = document.getElementById('order-phone');
  const requisitesBox = document.getElementById('requisites-box');
  const displayCardNumber = document.getElementById('display-card-number');
  const displayCardHolder = document.getElementById('display-card-holder');
  const previewOrderCode = document.getElementById('preview-order-code');
  const previewCodeInline = document.getElementById('preview-code-inline');

  const bagPromptModal = document.getElementById('bag-prompt-modal');
  const bagModalOptionsList = document.getElementById('bag-modal-options-list');
  const bagModalTotalSum = document.getElementById('bag-modal-total-sum');

  const ageGateModal = document.getElementById('age-gate-modal');
  const successModal = document.getElementById('success-modal');
  const modalOrderCode = document.getElementById('modal-order-code');
  const modalPaymentNote = document.getElementById('modal-payment-note');
  const toastEl = document.getElementById('toast');

  const cabinetSearchForm = document.getElementById('cabinet-search-form');
  const cabinetPhoneInput = document.getElementById('cabinet-phone-input');
  const clientLoyaltyBanner = document.getElementById('client-loyalty-banner');
  const cabinetOrdersList = document.getElementById('cabinet-orders-list');

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  function getCart() {
    try {
      const data = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
  }

  function getFavorites() {
    try {
      const data = JSON.parse(localStorage.getItem(FAV_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveFavorites(favs) {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    favoritesBadge.textContent = favs.length;
  }

  function getSavedClient() {
    try {
      return JSON.parse(localStorage.getItem(CLIENT_KEY)) || { fullName: '', phone: '' };
    } catch {
      return { fullName: '', phone: '' };
    }
  }

  function saveClientProfile(fullName, phone) {
    localStorage.setItem(CLIENT_KEY, JSON.stringify({ fullName, phone }));
  }

  function isAgeVerified() {
    return sessionStorage.getItem(AGE_SESSION_KEY) === 'true';
  }

  function getQtyStep(unit) {
    const u = String(unit || '').trim().toLowerCase();
    return u === '1 кг' || u === 'кг' ? 0.5 : 1;
  }

  function updateCartBadge() {
    const cart = getCart();
    headerCartCount.textContent = cart.length;
  }

  function getStatusBadgeHtml(status) {
    if (status === 'Виконано успішно') {
      return `<span class="status-pill status-completed">✅ ${MarkerStore.escapeHtml(status)}</span>`;
    }
    if (status === 'Готове до видачі') {
      return `<span class="status-pill status-ready">🟢 ${MarkerStore.escapeHtml(status)}</span>`;
    }
    if (status === 'Відхилено') {
      return `<span class="status-pill status-rejected">🔴 ${MarkerStore.escapeHtml(status)}</span>`;
    }
    if (status === 'Очікує підтвердження клієнта') {
      return `<span class="status-pill status-approval">🟠 ${MarkerStore.escapeHtml(status)}</span>`;
    }
    if (status === 'Комплектується') {
      return `<span class="status-pill status-packing">🔵 ${MarkerStore.escapeHtml(status)}</span>`;
    }
    return `<span class="status-pill status-placed">🟡 ${MarkerStore.escapeHtml(status || 'Розміщено')}</span>`;
  }

  function switchView(view) {
    currentView = view;
    viewCatalog.classList.toggle('hidden', view !== 'catalog');
    viewCabinet.classList.toggle('hidden', view !== 'cabinet');

    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    if (view === 'cabinet') {
      const saved = getSavedClient();
      if (!cabinetPhoneInput.value && saved.phone) {
        cabinetPhoneInput.value = saved.phone;
      }
      if (cabinetPhoneInput.value.trim()) {
        lastClientPhone = cabinetPhoneInput.value.trim();
        renderCabinetOrders(lastClientPhone);
      } else {
        renderCabinetOrders('');
      }
    }
  }

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
    });
  });

  document.getElementById('nav-brand').addEventListener('click', (e) => {
    e.preventDefault();
    selectedCategory = 'all';
    searchQuery = '';
    catalogSearch.value = '';
    switchView('catalog');
    renderCategories();
    renderProducts();
  });

  document.getElementById('nav-favorites-btn').addEventListener('click', () => {
    selectedCategory = 'favorites';
    switchView('catalog');
    renderCategories();
    renderProducts();
  });

  document.getElementById('nav-alcohol-btn').addEventListener('click', () => {
    if (isAgeVerified()) {
      selectedCategory = ALCOHOL_CATEGORY;
      switchView('catalog');
      renderCategories();
      renderProducts();
    } else {
      ageGateModal.classList.remove('hidden');
    }
  });

  document.getElementById('age-confirm-yes').addEventListener('click', () => {
    sessionStorage.setItem(AGE_SESSION_KEY, 'true');
    ageGateModal.classList.add('hidden');
    selectedCategory = ALCOHOL_CATEGORY;
    switchView('catalog');
    renderCategories();
    renderProducts();
  });

  document.getElementById('age-confirm-no').addEventListener('click', () => {
    ageGateModal.classList.add('hidden');
    showToast('Доступ до розділу 18+ дозволено лише повнолітнім особам.');
  });

  function renderCategories() {
    const categories = MarkerStore.getCategories();
    const products = MarkerStore.getProducts();
    const settings = MarkerStore.getSettings();
    const favCount = getFavorites().length;

    favoritesBadge.textContent = favCount;

    const visibleCats = categories.filter((c) => {
      if (c.hidden) return false;
      if (c.name === ALCOHOL_CATEGORY) return false;
      if (settings.hideEmptyCategories) {
        const hasItems = products.some((p) => p.category === c.name);
        if (!hasItems) return false;
      }
      return true;
    });

    const chips = [
      `<button type="button" class="chip ${selectedCategory === 'all' ? 'active' : ''}" data-cat="all">Усі товари</button>`,
      `<button type="button" class="chip ${selectedCategory === 'favorites' ? 'active' : ''}" data-cat="favorites">❤️ Обране (${favCount})</button>`
    ];

    visibleCats.forEach((c) => {
      const isActive = selectedCategory === c.name ? 'active' : '';
      chips.push(
        `<button type="button" class="chip ${isActive}" data-cat="${MarkerStore.escapeHtml(c.name)}">${MarkerStore.escapeHtml(c.name)}</button>`
      );
    });

    if (selectedCategory === ALCOHOL_CATEGORY) {
      chips.push(
        `<button type="button" class="chip active" data-cat="${MarkerStore.escapeHtml(ALCOHOL_CATEGORY)}">🔞 ${MarkerStore.escapeHtml(ALCOHOL_CATEGORY)}</button>`
      );
    }

    categoriesBar.innerHTML = chips.join('');
  }

  categoriesBar.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const cat = chip.dataset.cat;

    if (cat === ALCOHOL_CATEGORY && !isAgeVerified()) {
      ageGateModal.classList.remove('hidden');
      return;
    }

    selectedCategory = cat;
    renderCategories();
    renderProducts();
  });

  catalogSearch.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderProducts();
  });

  function renderProducts() {
    const allProducts = MarkerStore.getProducts();
    const categories = MarkerStore.getCategories();
    const hiddenCatSet = new Set(categories.filter((c) => c.hidden).map((c) => c.name));
    const favSet = new Set(getFavorites());
    const cartMap = new Map(getCart().map((item) => [item.id, item.qty]));
    const q = searchQuery.trim().toLowerCase();

    let filtered = allProducts.filter((p) => {
      if (hiddenCatSet.has(p.category) && selectedCategory !== p.category) return false;

      if (selectedCategory === ALCOHOL_CATEGORY) {
        if (p.category !== ALCOHOL_CATEGORY) return false;
      } else {
        if (p.category === ALCOHOL_CATEGORY) return false;
      }

      if (selectedCategory === 'favorites') {
        if (!favSet.has(p.id)) return false;
      } else if (selectedCategory !== 'all' && selectedCategory !== ALCOHOL_CATEGORY) {
        if (p.category !== selectedCategory) return false;
      }

      if (q) {
        const matchName = String(p.name || '').toLowerCase().includes(q);
        const matchCat = String(p.category || '').toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const aStock = a.inStock === false ? 0 : 1;
      const bStock = b.inStock === false ? 0 : 1;
      return bStock - aStock;
    });

    if (selectedCategory === 'all') {
      catalogHeading.textContent = 'Усі товари магазину';
    } else if (selectedCategory === 'favorites') {
      catalogHeading.textContent = '❤️ Ваші обрані товари';
    } else {
      catalogHeading.textContent = selectedCategory;
    }

    catalogCount.textContent = `${filtered.length} шт.`;

    if (filtered.length === 0) {
      productsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          ${
            selectedCategory === 'favorites'
              ? 'Список обраного порожній. Натисніть сердечко ❤️ на картці товару, щоб зберегти його сюди.'
              : 'У цій категорії товарів поки не знайдено.'
          }
        </div>`;
      return;
    }

    productsGrid.innerHTML = filtered
      .map((p) => {
        const isOut = p.inStock === false;
        const isFav = favSet.has(p.id);
        const inCartQty = cartMap.get(p.id) || 0;

        const mediaHtml = p.image
          ? `<img src="${MarkerStore.escapeHtml(p.image)}" alt="${MarkerStore.escapeHtml(p.name)}" loading="lazy">`
          : `<span class="product-emoji">${MarkerStore.escapeHtml(p.icon || '🛒')}</span>`;

        const metaUnit = p.capacity
          ? `Місткість: <strong>${MarkerStore.escapeHtml(p.capacity)}</strong>`
          : `Фасування: ${MarkerStore.escapeHtml(p.unit)}`;

        const actionHtml = isOut
          ? `<button type="button" class="btn btn-outline-brown btn-sm btn-block" disabled>Немає в наявності</button>`
          : inCartQty > 0
            ? `<div class="qty-control-bar">
                 <button type="button" class="qty-btn" data-qty-minus="${p.id}">−</button>
                 <strong>${MarkerStore.formatQty(inCartQty)} ${MarkerStore.escapeHtml(p.unit)}</strong>
                 <button type="button" class="qty-btn" data-qty-plus="${p.id}">+</button>
               </div>`
            : `<button type="button" class="btn btn-yellow btn-sm btn-block" data-add-id="${p.id}">+ В кошик</button>`;

        return `
          <article class="product-card ${isOut ? 'out-of-stock' : ''}">
            <div class="product-media">
              <span class="product-cat-tag">${MarkerStore.escapeHtml(p.category)}</span>
              ${mediaHtml}
              <button type="button" class="fav-toggle-btn ${isFav ? 'active' : ''}" data-fav-id="${p.id}" title="Додати в обране">
                ${isFav ? '❤️' : '🤍'}
              </button>
              ${isOut ? '<span class="stock-badge-out">Немає в наявності</span>' : ''}
            </div>
            <div class="product-info">
              <div>
                <h3 class="product-title">${MarkerStore.escapeHtml(p.name)}</h3>
                <span class="product-unit">${metaUnit}</span>
              </div>
              <div class="product-bottom">
                <strong class="product-price">${MarkerStore.formatPrice(p.price)}</strong>
                <div style="min-width: 118px;">${actionHtml}</div>
              </div>
            </div>
          </article>`;
      })
      .join('');
  }

  productsGrid.addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-fav-id]');
    if (favBtn) {
      const id = favBtn.dataset.favId;
      const favs = getFavorites();
      const idx = favs.indexOf(id);
      if (idx === -1) {
        favs.push(id);
        showToast('Додано в обране ❤️');
      } else {
        favs.splice(idx, 1);
      }
      saveFavorites(favs);
      renderCategories();
      renderProducts();
      return;
    }

    const addBtn = e.target.closest('[data-add-id]');
    if (addBtn) {
      changeCartItemQty(addBtn.dataset.addId, 1, true);
      return;
    }

    const plusBtn = e.target.closest('[data-qty-plus]');
    if (plusBtn) {
      changeCartItemQty(plusBtn.dataset.qtyPlus, 1, false);
      return;
    }

    const minusBtn = e.target.closest('[data-qty-minus]');
    if (minusBtn) {
      changeCartItemQty(minusBtn.dataset.qtyMinus, -1, false);
    }
  });

  function changeCartItemQty(productId, direction, isInitialAdd) {
    const product = MarkerStore.getProducts().find((p) => p.id === productId);
    if (!product || product.inStock === false) return;

    const cart = getCart();
    const step = getQtyStep(product.unit);
    const idx = cart.findIndex((i) => i.id === productId);

    if (idx === -1 && direction > 0) {
      cart.push({
        id: product.id,
        sku: product.sku || '',
        name: product.name,
        category: product.category,
        capacity: product.capacity || '',
        isBag: MarkerStore.isBagProduct(product),
        price: product.price,
        unit: product.unit,
        qty: step
      });
      if (isInitialAdd) {
        showToast(`«${product.name}» додано в кошик`);
      }
    } else if (idx !== -1) {
      const nextQty = MarkerStore.formatQty(cart[idx].qty + direction * step);
      if (nextQty <= 0) {
        cart.splice(idx, 1);
      } else {
        cart[idx].qty = nextQty;
      }
    }

    saveCart(cart);
    renderProducts();
    if (!cartDrawer.classList.contains('hidden') && cartDrawer.classList.contains('open')) {
      renderCartDrawer();
    }
  }

  async function openCartDrawer() {
    const saved = getSavedClient();
    if (!orderFullnameInput.value && saved.fullName) {
      orderFullnameInput.value = saved.fullName;
    }
    if (!orderPhoneInput.value && saved.phone) {
      orderPhoneInput.value = saved.phone;
    }

    renderCartDrawer();
    cartBackdrop.classList.remove('hidden');
    cartDrawer.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');

    await MarkerStore.syncFromCloud();
    renderCartDrawer();
  }

  function closeCartDrawer() {
    cartBackdrop.classList.add('hidden');
    cartDrawer.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('open-cart-btn').addEventListener('click', openCartDrawer);
  document.getElementById('close-cart-btn').addEventListener('click', closeCartDrawer);
  cartBackdrop.addEventListener('click', closeCartDrawer);

  function renderCartBagsSection(cart) {
    const availableBags = MarkerStore.getBagProducts().filter((p) => p.inStock !== false);
    if (cart.length === 0 || availableBags.length === 0) {
      cartBagsSection.classList.add('hidden');
      return;
    }

    cartBagsSection.classList.remove('hidden');
    const cartMap = new Map(cart.map((i) => [i.id, i.qty]));

    cartBagsList.innerHTML = availableBags
      .map((bag) => {
        const qty = cartMap.get(bag.id) || 0;
        const capTag = bag.capacity
          ? `<span class="bag-cap-badge">${MarkerStore.escapeHtml(bag.capacity)}</span>`
          : '';

        const ctrlHtml =
          qty > 0
            ? `<div class="qty-control">
                 <button type="button" class="qty-btn" data-cart-bag-minus="${bag.id}">−</button>
                 <span class="qty-val">${qty}</span>
                 <button type="button" class="qty-btn" data-cart-bag-plus="${bag.id}">+</button>
               </div>`
            : `<button type="button" class="btn btn-outline-brown btn-xs" data-cart-bag-add="${bag.id}">+ Додати</button>`;

        return `
          <div class="cart-bag-row ${qty > 0 ? 'has-qty' : ''}">
            <div>
              <div style="font-size:13px; font-weight:700;">${MarkerStore.escapeHtml(bag.name)} ${capTag}</div>
              <div style="font-size:11.5px; color:var(--text-muted);">${MarkerStore.formatPrice(bag.price)} / шт</div>
            </div>
            <div>${ctrlHtml}</div>
          </div>`;
      })
      .join('');
  }

  cartBagsList.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-cart-bag-add]');
    if (addBtn) {
      changeCartItemQty(addBtn.dataset.cartBagAdd, 1, false);
      renderCartDrawer();
      return;
    }
    const plusBtn = e.target.closest('[data-cart-bag-plus]');
    if (plusBtn) {
      changeCartItemQty(plusBtn.dataset.cartBagPlus, 1, false);
      renderCartDrawer();
      return;
    }
    const minusBtn = e.target.closest('[data-cart-bag-minus]');
    if (minusBtn) {
      changeCartItemQty(minusBtn.dataset.cartBagMinus, -1, false);
      renderCartDrawer();
    }
  });

  function renderCartDrawer() {
    const cart = getCart();

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="empty-state" style="margin-top:30px;">
          Ваш кошик порожній.<br>
          <small>Оберіть продукти в каталозі, щоб оформити замовлення.</small>
        </div>`;
      cartBagsSection.classList.add('hidden');
      cartCheckoutSection.classList.add('hidden');
      return;
    }

    cartCheckoutSection.classList.remove('hidden');

    cartItemsContainer.innerHTML = cart
      .map((item) => {
        const subInfo = item.capacity
          ? `${MarkerStore.formatPrice(item.price)} / шт (${MarkerStore.escapeHtml(item.capacity)})`
          : `${MarkerStore.formatPrice(item.price)} / ${MarkerStore.escapeHtml(item.unit)}`;

        return `
          <div class="cart-item-row">
            <div class="cart-item-info">
              <div class="cart-item-title">${MarkerStore.escapeHtml(item.name)}</div>
              <div class="cart-item-sub">${subInfo}</div>
            </div>
            <div class="cart-item-controls">
              <div class="qty-control">
                <button type="button" class="qty-btn" data-cart-minus="${item.id}">−</button>
                <span class="qty-val">${MarkerStore.formatQty(item.qty)}</span>
                <button type="button" class="qty-btn" data-cart-plus="${item.id}">+</button>
              </div>
              <strong class="cart-line-sum">${MarkerStore.formatPrice(item.price * item.qty)}</strong>
              <button type="button" class="btn-mini" style="background:var(--red-bg); color:var(--red);" data-cart-remove="${item.id}">✕</button>
            </div>
          </div>`;
      })
      .join('');

    renderCartBagsSection(cart);
    updateCartTotalsAndMerge();
  }

  function updateCartTotalsAndMerge() {
    const cart = getCart();
    const subtotal = cart.reduce((acc, i) => acc + Number(i.price) * Number(i.qty), 0);
    const phone = orderPhoneInput.value.trim();
    const loyalty = MarkerStore.getClientLoyalty(phone);

    let discountAmount = 0;
    if (loyalty.isLoyal && loyalty.discountPercent > 0) {
      discountAmount = Math.round(((subtotal * loyalty.discountPercent) / 100) * 100) / 100;
      cartDiscountRow.classList.remove('hidden');
      cartLoyaltyLabel.textContent = `⭐ Знижка постійного клієнта (-${loyalty.discountPercent}%):`;
      cartDiscountSum.textContent = `-${MarkerStore.formatPrice(discountAmount)}`;
    } else {
      cartDiscountRow.classList.add('hidden');
    }

    const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
    cartTotalSum.textContent = MarkerStore.formatPrice(total);

    const normPhone = MarkerStore.normalizePhone(phone);
    const activeOrder = normPhone
      ? MarkerStore.getOrders().find(
          (o) =>
            o.phoneNormalized === normPhone &&
            (o.status === 'Розміщено' || o.status === 'Комплектується')
        )
      : null;

    if (activeOrder) {
      activeOrderMergeBox.classList.remove('hidden');
      activeOrderMergeText.innerHTML = `У вас є активне замовлення <strong>#${activeOrder.code}</strong> (${activeOrder.status}). Можете додати ці товари туди:`;
      mergeIntoActiveBtn.dataset.targetOrderId = activeOrder.id;
    } else {
      activeOrderMergeBox.classList.add('hidden');
    }

    const selectedPay = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    if (selectedPay === 'Оплата за реквізитами') {
      const settings = MarkerStore.getSettings();
      const nextCode = MarkerStore.peekNextOrderCode();
      displayCardNumber.textContent = settings.cardNumber;
      displayCardHolder.textContent = settings.cardHolder || '';
      previewOrderCode.textContent = nextCode;
      previewCodeInline.textContent = nextCode;
      requisitesBox.classList.remove('hidden');
    } else {
      requisitesBox.classList.add('hidden');
    }
  }

  cartItemsContainer.addEventListener('click', (e) => {
    const minus = e.target.closest('[data-cart-minus]');
    if (minus) {
      changeCartItemQty(minus.dataset.cartMinus, -1, false);
      renderCartDrawer();
      return;
    }
    const plus = e.target.closest('[data-cart-plus]');
    if (plus) {
      changeCartItemQty(plus.dataset.cartPlus, 1, false);
      renderCartDrawer();
      return;
    }
    const rem = e.target.closest('[data-cart-remove]');
    if (rem) {
      const cart = getCart().filter((i) => i.id !== rem.dataset.cartRemove);
      saveCart(cart);
      renderProducts();
      renderCartDrawer();
    }
  });

  orderPhoneInput.addEventListener('input', updateCartTotalsAndMerge);

  document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener('change', updateCartTotalsAndMerge);
  });

  document.getElementById('copy-card-btn').addEventListener('click', () => {
    navigator.clipboard?.writeText(displayCardNumber.textContent.trim());
    showToast('Номер картки скопійовано!');
  });

  document.getElementById('copy-code-btn').addEventListener('click', () => {
    navigator.clipboard?.writeText(previewOrderCode.textContent.trim());
    showToast('Код замовлення скопійовано!');
  });

  mergeIntoActiveBtn.addEventListener('click', async () => {
    const targetId = mergeIntoActiveBtn.dataset.targetOrderId;
    const cart = getCart();
    if (!targetId || cart.length === 0) return;

    mergeIntoActiveBtn.disabled = true;
    await MarkerStore.syncFromCloud();

    const hasAdult = cart.some((i) => i.category === ALCOHOL_CATEGORY);
    const updated = MarkerStore.mergeItemsIntoOrder(targetId, cart, hasAdult);
    mergeIntoActiveBtn.disabled = false;
    if (!updated) return;

    saveCart([]);
    closeCartDrawer();
    renderProducts();
    showToast(`Товари додано до замовлення #${updated.code}!`);
    cabinetPhoneInput.value = updated.phone;
    lastClientPhone = updated.phone;
    switchView('cabinet');
  });

  function openBagPromptModal(availableBags) {
    const cart = getCart();
    bagModalSelection = new Map();
    availableBags.forEach((bag) => {
      const inCart = cart.find((i) => i.id === bag.id);
      bagModalSelection.set(bag.id, inCart ? Math.max(0, Math.round(Number(inCart.qty))) : 0);
    });
    renderBagModalOptions();
    bagPromptModal.classList.remove('hidden');
  }

  function renderBagModalOptions() {
    const availableBags = MarkerStore.getBagProducts().filter((p) => p.inStock !== false);
    const cart = getCart();

    bagModalOptionsList.innerHTML = availableBags
      .map((bag) => {
        const qty = bagModalSelection.get(bag.id) || 0;
        const capHtml = bag.capacity
          ? `<span class="bag-cap-badge">${MarkerStore.escapeHtml(bag.capacity)}</span>`
          : '';

        return `
          <div class="bag-option-row ${qty > 0 ? 'selected' : ''}">
            <div style="text-align:left;">
              <strong style="font-size:13.5px; display:block;">${MarkerStore.escapeHtml(bag.icon || '🛍️')} ${MarkerStore.escapeHtml(bag.name)}</strong>
              <div style="margin-top:3px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                ${capHtml}
                <span style="font-size:12.5px; font-weight:700; color:var(--brown-dark);">${MarkerStore.formatPrice(bag.price)} / шт</span>
              </div>
            </div>
            <div class="qty-control">
              <button type="button" class="qty-btn" data-bag-modal-minus="${bag.id}">−</button>
              <span class="qty-val">${qty}</span>
              <button type="button" class="qty-btn" data-bag-modal-plus="${bag.id}">+</button>
            </div>
          </div>`;
      })
      .join('');

    const nonBagSubtotal = cart
      .filter((i) => !MarkerStore.isBagProduct(i))
      .reduce((acc, i) => acc + Number(i.price) * Number(i.qty), 0);

    let bagsSubtotal = 0;
    availableBags.forEach((bag) => {
      const q = bagModalSelection.get(bag.id) || 0;
      bagsSubtotal += Number(bag.price) * q;
    });

    const subtotal = nonBagSubtotal + bagsSubtotal;
    const loyalty = MarkerStore.getClientLoyalty(orderPhoneInput.value.trim());
    const discountAmount =
      loyalty.isLoyal && loyalty.discountPercent > 0
        ? Math.round(((subtotal * loyalty.discountPercent) / 100) * 100) / 100
        : 0;
    const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    bagModalTotalSum.textContent = MarkerStore.formatPrice(total);
  }

  bagModalOptionsList.addEventListener('click', (e) => {
    const plus = e.target.closest('[data-bag-modal-plus]');
    if (plus) {
      const id = plus.dataset.bagModalPlus;
      bagModalSelection.set(id, (bagModalSelection.get(id) || 0) + 1);
      renderBagModalOptions();
      return;
    }
    const minus = e.target.closest('[data-bag-modal-minus]');
    if (minus) {
      const id = minus.dataset.bagModalMinus;
      const next = Math.max(0, (bagModalSelection.get(id) || 0) - 1);
      bagModalSelection.set(id, next);
      renderBagModalOptions();
    }
  });

  document.getElementById('confirm-with-bags-btn').addEventListener('click', async () => {
    let totalBagsQty = 0;
    bagModalSelection.forEach((q) => {
      totalBagsQty += q;
    });

    if (totalBagsQty <= 0) {
      showToast('Оберіть кількість пакетів або натисніть «Я прийду зі своїм пакетом»');
      return;
    }

    const availableBags = MarkerStore.getBagProducts().filter((p) => p.inStock !== false);
    const nonBagItems = getCart().filter((i) => !MarkerStore.isBagProduct(i));

    availableBags.forEach((bag) => {
      const qty = bagModalSelection.get(bag.id) || 0;
      if (qty > 0) {
        nonBagItems.push({
          id: bag.id,
          sku: bag.sku || '',
          name: bag.name,
          category: bag.category,
          capacity: bag.capacity || '',
          isBag: true,
          price: bag.price,
          unit: bag.unit || 'шт',
          qty
        });
      }
    });

    saveCart(nonBagItems);
    bagPromptModal.classList.add('hidden');
    await finalizeOrderCreation(false);
  });

  document.getElementById('confirm-own-bag-btn').addEventListener('click', async () => {
    const nonBagItems = getCart().filter((i) => !MarkerStore.isBagProduct(i));
    saveCart(nonBagItems);
    bagPromptModal.classList.add('hidden');
    await finalizeOrderCreation(true);
  });

  document.getElementById('close-bag-modal-btn').addEventListener('click', () => {
    bagPromptModal.classList.add('hidden');
  });

  async function finalizeOrderCreation(ownBag) {
    const cart = getCart();
    if (cart.length === 0) return;

    const fullName = orderFullnameInput.value.trim();
    const phone = orderPhoneInput.value.trim();
    const paymentMethod =
      document.querySelector('input[name="paymentMethod"]:checked')?.value ||
      'Оплата при отриманні';

    if (!fullName || !phone) return;

    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    await MarkerStore.syncFromCloud();

    const hasAdultItems = cart.some((i) => i.category === ALCOHOL_CATEGORY);
    const order = MarkerStore.createOrder({
      fullName,
      phone,
      paymentMethod,
      items: cart,
      hasAdultItems,
      ownBag
    });

    if (submitBtn) submitBtn.disabled = false;

    saveClientProfile(fullName, phone);
    saveCart([]);
    closeCartDrawer();
    renderProducts();

    modalOrderCode.textContent = order.code;
    if (paymentMethod === 'Оплата за реквізитами') {
      const settings = MarkerStore.getSettings();
      modalPaymentNote.innerHTML = `Перекажіть <strong>${MarkerStore.formatPrice(order.total)}</strong> на картку <strong>${MarkerStore.escapeHtml(settings.cardNumber)}</strong> та обов’язково вкажіть код <strong>${order.code}</strong> у призначенні платежу.`;
    } else {
      modalPaymentNote.innerHTML = `Сума до сплати при отриманні: <strong>${MarkerStore.formatPrice(order.total)}</strong>. Назвіть код <strong>#${order.code}</strong> на касі.`;
    }

    cabinetPhoneInput.value = phone;
    lastClientPhone = phone;
    successModal.classList.remove('hidden');
  }

  checkoutForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cart = getCart();
    if (cart.length === 0) return;

    const fullName = orderFullnameInput.value.trim();
    const phone = orderPhoneInput.value.trim();
    if (!fullName || !phone) return;

    const availableBags = MarkerStore.getBagProducts().filter((p) => p.inStock !== false);
    if (availableBags.length === 0) {
      finalizeOrderCreation(false);
      return;
    }

    openBagPromptModal(availableBags);
  });

  document.getElementById('go-to-cabinet-btn').addEventListener('click', () => {
    successModal.classList.add('hidden');
    switchView('cabinet');
  });

  document.getElementById('close-success-modal-btn').addEventListener('click', () => {
    successModal.classList.add('hidden');
  });

  cabinetSearchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = cabinetPhoneInput.value.trim();
    if (!phone) return;
    lastClientPhone = phone;
    const saved = getSavedClient();
    saveClientProfile(saved.fullName, phone);
    await MarkerStore.syncFromCloud();
    renderCabinetOrders(phone);
  });

  function renderCabinetOrders(phone) {
    const norm = MarkerStore.normalizePhone(phone);
    if (!norm) {
      clientLoyaltyBanner.classList.add('hidden');
      cabinetOrdersList.innerHTML = `<div class="empty-state">Введіть ваш номер телефону вище, щоб побачити історію та статус ваших замовлень.</div>`;
      return;
    }

    const loyalty = MarkerStore.getClientLoyalty(phone);
    clientLoyaltyBanner.classList.remove('hidden');
    if (loyalty.isLoyal) {
      clientLoyaltyBanner.className = 'loyalty-banner is-loyal';
      clientLoyaltyBanner.innerHTML = `
        <strong>⭐ Ви постійний клієнт Marker Plus!</strong>
        <span>Успішних замовлень: <strong>${loyalty.successfulOrders}</strong>. Ваша постійна знижка: <strong>${loyalty.discountPercent}%</strong> на кожне замовлення.</span>`;
    } else {
      clientLoyaltyBanner.className = 'loyalty-banner';
      clientLoyaltyBanner.innerHTML = `
        <span>Успішних замовлень: <strong>${loyalty.successfulOrders} з ${loyalty.threshold}</strong>. Зробіть ще <strong>${loyalty.remaining}</strong>, щоб отримати статус постійного клієнта!</span>`;
    }

    const orders = MarkerStore.getOrders()
      .filter((o) => o.phoneNormalized === norm)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    lastCabinetSnapshot = JSON.stringify(orders);

    const needsApproval = orders.some((o) => o.status === 'Очікує підтвердження клієнта');
    cabinetAlertBadge.classList.toggle('hidden', !needsApproval);

    if (orders.length === 0) {
      cabinetOrdersList.innerHTML = `<div class="empty-state">За номером <strong>${MarkerStore.escapeHtml(phone)}</strong> замовлень поки не знайдено.</div>`;
      return;
    }

    cabinetOrdersList.innerHTML = orders
      .map((o) => {
        const itemsHtml = (o.items || [])
          .map((i) => {
            const st = i.status || 'active';
            if (st === 'missing') {
              return `<div class="order-item-line is-missing"><del>${MarkerStore.escapeHtml(i.name)} × ${MarkerStore.formatQty(i.qty)}</del> <span style="color:var(--red); font-weight:700;">— Немає в наявності</span></div>`;
            }
            if (st === 'replaced' && i.replacement) {
              return `<div class="order-item-line is-replaced"><div><small><del>${MarkerStore.escapeHtml(i.name)}</del></small><br><strong>🔄 Заміна:</strong> ${MarkerStore.escapeHtml(i.replacement.name)} × ${MarkerStore.formatQty(i.replacement.qty)} (${MarkerStore.escapeHtml(i.replacement.unit)})</div><strong>${MarkerStore.formatPrice(i.replacement.price * i.replacement.qty)}</strong></div>`;
            }
            const capNote = i.capacity ? ` [${MarkerStore.escapeHtml(i.capacity)}]` : '';
            return `<div class="order-item-line"><span>${MarkerStore.escapeHtml(i.name)}${capNote} × <strong>${MarkerStore.formatQty(i.qty)}</strong> (${MarkerStore.escapeHtml(i.unit)})</span><strong>${MarkerStore.formatPrice(i.price * i.qty)}</strong></div>`;
          })
          .join('');

        let actionBar = '';
        if (o.status === 'Очікує підтвердження клієнта') {
          actionBar = `
            <div class="approval-box-client">
              <h4>⚠️ Магазин вніс зміни у склад замовлення (відсутній товар або заміна)</h4>
              <p style="font-size:13px;">Нова сума замовлення: <strong>${MarkerStore.formatPrice(o.total)}</strong>. Підтверджуєте збірку?</p>
              <div class="approval-actions-row">
                <button type="button" class="btn btn-green btn-sm" data-client-approve="${o.id}">✓ Підтвердити зміни</button>
                <button type="button" class="btn btn-red btn-sm" data-client-reject="${o.id}">✕ Скасувати замовлення</button>
              </div>
            </div>`;
        } else if (o.status === 'Готове до видачі') {
          actionBar = o.clientArriving
            ? `<div style="margin-top:10px; padding:10px 14px; background:var(--green-bg); border:1.5px solid #9AE6B4; color:var(--green); border-radius:10px; font-size:13px; font-weight:700;">✓ Ви повідомили магазин: «${MarkerStore.escapeHtml(o.clientArriving)}» (${o.clientArrivingAt})</div>`
            : `<div style="margin-top:10px;"><button type="button" class="btn btn-yellow btn-sm" data-client-arriving="${o.id}">🚶 Я підходжу / біля магазину (видати без черги)</button></div>`;
        }

        const cardAccentClass =
          o.status === 'Виконано успішно'
            ? 'order-card-completed'
            : o.status === 'Готове до видачі'
              ? 'order-card-ready'
              : o.status === 'Очікує підтвердження клієнта'
                ? 'approval-highlight'
                : '';

        return `
          <article class="order-card ${cardAccentClass}">
            <div class="order-card-top">
              <div>
                <span class="order-code-tag">Код #${o.code}</span>
                <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">${o.createdAt}</span>
                ${o.ownBag ? '<span class="own-bag-pill">🎒 Зі своїм пакетом</span>' : ''}
              </div>
              ${getStatusBadgeHtml(o.status)}
            </div>
            <div class="order-items-summary">${itemsHtml}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <span style="font-size:13px;">Оплата: <strong>${MarkerStore.escapeHtml(o.paymentMethod)}</strong></span>
              <strong style="font-size:17px; color:var(--brown-dark);">Сума: ${MarkerStore.formatPrice(o.total)}</strong>
            </div>
            ${actionBar}
          </article>`;
      })
      .join('');
  }

  cabinetOrdersList.addEventListener('click', (e) => {
    const approveBtn = e.target.closest('[data-client-approve]');
    if (approveBtn) {
      const orders = MarkerStore.getOrders();
      const idx = orders.findIndex((o) => o.id === approveBtn.dataset.clientApprove);
      if (idx !== -1) {
        orders[idx].status = 'Комплектується';
        orders[idx].originalTotal = orders[idx].total;
        MarkerStore.saveOrders(orders);
        showToast('Зміни підтверджено! Магазин продовжує збірку.');
        renderCabinetOrders(lastClientPhone);
      }
      return;
    }

    const rejectBtn = e.target.closest('[data-client-reject]');
    if (rejectBtn) {
      MarkerStore.updateOrderStatus(rejectBtn.dataset.clientReject, 'Відхилено');
      showToast('Замовлення скасовано.');
      renderCabinetOrders(lastClientPhone);
      return;
    }

    const arrBtn = e.target.closest('[data-client-arriving]');
    if (arrBtn) {
      const orders = MarkerStore.getOrders();
      const idx = orders.findIndex((o) => o.id === arrBtn.dataset.clientArriving);
      if (idx !== -1) {
        orders[idx].clientArriving = 'Підходжу за замовленням';
        orders[idx].clientArrivingAt = new Date().toLocaleTimeString('uk-UA', {
          hour: '2-digit',
          minute: '2-digit'
        });
        MarkerStore.saveOrders(orders);
        showToast('Сигнал надіслано продавцю!');
        renderCabinetOrders(lastClientPhone);
      }
    }
  });

  window.addEventListener('markerstore:updated', (e) => {
    if (e.detail && e.detail.changed) {
      renderCategories();
      renderProducts();
      if (!cartDrawer.classList.contains('hidden') && cartDrawer.classList.contains('open')) {
        renderCartDrawer();
      }
      if (lastClientPhone) {
        renderCabinetOrders(lastClientPhone);
      }
    }
  });

  window.addEventListener('storage', () => {
    renderCategories();
    renderProducts();
    if (lastClientPhone) {
      renderCabinetOrders(lastClientPhone);
    }
  });

  setInterval(() => {
    MarkerStore.syncFromCloud();
    if (currentView === 'cabinet' && lastClientPhone) {
      const norm = MarkerStore.normalizePhone(lastClientPhone);
      const current = MarkerStore.getOrders().filter((o) => o.phoneNormalized === norm);
      if (JSON.stringify(current) !== lastCabinetSnapshot) {
        renderCabinetOrders(lastClientPhone);
      }
    }
  }, 4000);

  const savedProfile = getSavedClient();
  if (savedProfile.phone) {
    lastClientPhone = savedProfile.phone;
    cabinetPhoneInput.value = savedProfile.phone;
  }

  updateCartBadge();
  renderCategories();
  renderProducts();
  MarkerStore.syncFromCloud();
})();
