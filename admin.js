(() => {
  const SESSION_KEY = 'markerplus_admin_auth_v2';
  const ALCOHOL_CATEGORY = MarkerStore.ALCOHOL_CATEGORY;

  const loginScreen = document.getElementById('admin-login-screen');
  const adminApp = document.getElementById('admin-app');
  const loginForm = document.getElementById('admin-login-form');
  const loginError = document.getElementById('login-error-msg');
  const toastEl = document.getElementById('toast');

  const missingItemModal = document.getElementById('missing-item-modal');
  const missingModalItemTitle = document.getElementById('missing-modal-item-title');
  const missingAlsoDisableCatalog = document.getElementById('missing-also-disable-catalog');
  const replacementSearchInput = document.getElementById('replacement-search-input');
  const replacementCandidatesList = document.getElementById('replacement-candidates-list');

  let currentOrderFilter = 'all';
  let adminProductSearch = '';
  let customerSearch = '';
  let activeMissingTarget = null;
  let lastOrdersSnapshot = '';

  if (window.location.protocol === 'file:') {
    const warnEl = document.getElementById('file-protocol-warning');
    if (warnEl) warnEl.classList.remove('hidden');
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  function checkAuth() {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      loginScreen.classList.add('hidden');
      adminApp.classList.remove('hidden');
      refreshAdminAll();
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = document.getElementById('admin-password-input').value;
    const currentPass = MarkerStore.getSettings().adminPassword || 'marketplus3845fff';
    if (val === currentPass) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      loginError.classList.add('hidden');
      checkAuth();
    } else {
      loginError.classList.remove('hidden');
    }
  });

  document.getElementById('admin-logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  document.getElementById('manual-refresh-orders-btn').addEventListener('click', () => {
    refreshAdminAll();
    showToast('Список замовлень оновлено');
  });

  const adminTabs = document.querySelectorAll('[data-admin-tab]');
  const adminSections = document.querySelectorAll('.admin-section');

  adminTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.adminTab;
      adminTabs.forEach((b) => b.classList.toggle('active', b === btn));
      adminSections.forEach((sec) => sec.classList.toggle('hidden', sec.id !== `tab-${target}`));
      refreshAdminAll();
    });
  });

  function renderKPI() {
    const orders = MarkerStore.getOrders();
    const products = MarkerStore.getProducts();
    const newCount = orders.filter((o) => o.status === 'Розміщено').length;
    const validOrders = orders.filter((o) => o.status !== 'Відхилено');
    const revenue = validOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);

    document.getElementById('new-orders-badge').textContent = newCount;

    document.getElementById('admin-kpi-grid').innerHTML = `
      <div class="kpi-card">
        <span>Нові замовлення (Розміщено)</span>
        <strong>${newCount}</strong>
      </div>
      <div class="kpi-card">
        <span>Усього замовлень</span>
        <strong>${orders.length}</strong>
      </div>
      <div class="kpi-card">
        <span>Сума прийнятих замовлень</span>
        <strong>${MarkerStore.formatPrice(revenue)}</strong>
      </div>
      <div class="kpi-card">
        <span>Товарів у каталозі</span>
        <strong>${products.length}</strong>
      </div>
    `;
  }

  function getStatusClass(status) {
    if (status === 'Виконано успішно') return 'status-completed';
    if (status === 'Очікує підтвердження клієнта') return 'status-approval';
    if (status === 'Комплектується') return 'status-packing';
    if (status === 'Готове до видачі') return 'status-ready';
    if (status === 'Відхилено') return 'status-rejected';
    return 'status-placed';
  }

  function renderAdminOrders() {
    const orders = MarkerStore.getOrders();
    lastOrdersSnapshot = JSON.stringify(orders);
    const productsMap = new Map(MarkerStore.getProducts().map((p) => [p.id, p]));
    const listEl = document.getElementById('admin-orders-list');

    let filtered =
      currentOrderFilter === 'all'
        ? [...orders]
        : orders.filter((o) => o.status === currentOrderFilter);

    filtered.sort((a, b) => {
      const aArr = a.clientArriving && a.status === 'Готове до видачі' ? 1 : 0;
      const bArr = b.clientArriving && b.status === 'Готове до видачі' ? 1 : 0;
      if (bArr !== aArr) return bArr - aArr;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state">Замовлень у цій категорії поки немає.<br><small>Натисніть «🔄 Оновити», якщо замовлення щойно було створено на клієнтській сторінці.</small></div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((o) => {
        const hasAdult =
          o.hasAdultItems || (o.items || []).some((i) => i.category === ALCOHOL_CATEGORY);
        const isArriving = Boolean(o.clientArriving && o.status === 'Готове до видачі');

        const activeItems = (o.items || []).filter((i) => (i.status || 'active') !== 'missing');
        const packedCount = activeItems.filter((i) => i.packed).length;
        const hasUnapprovedChanges = (o.items || []).some(
          (i) => i.status === 'missing' || i.status === 'replaced'
        );

        const itemsHtml = (o.items || [])
          .map((i, idx) => {
            const actualSku = i.sku || productsMap.get(i.id)?.sku || '';
            const skuBadge = actualSku
              ? `<span style="background:var(--brown-dark); color:var(--yellow); padding:2px 6px; border-radius:5px; font-size:11px; font-weight:700; margin-right:6px;">Код: ${MarkerStore.escapeHtml(actualSku)}</span>`
              : '';

            const st = i.status || 'active';

            if (st === 'missing') {
              return `
                <div class="order-item-line is-missing">
                  <div>
                    ${skuBadge}<del>${MarkerStore.escapeHtml(i.name)} × ${MarkerStore.formatQty(i.qty)}</del>
                    <strong style="color:var(--red); margin-left:6px;">— Немає в наявності</strong>
                  </div>
                  <button type="button" class="btn-mini" data-item-act="restore" data-ord-id="${o.id}" data-idx="${idx}">Повернути</button>
                </div>`;
            }

            if (st === 'replaced' && i.replacement) {
              const repSku = i.replacement.sku
                ? `<span style="background:var(--brown-dark); color:var(--yellow); padding:2px 6px; border-radius:5px; font-size:11px; font-weight:700; margin-right:6px;">Код: ${MarkerStore.escapeHtml(i.replacement.sku)}</span>`
                : '';
              return `
                <div class="order-item-line is-replaced">
                  <div>
                    <div style="font-size:11px; color:var(--text-muted);">${skuBadge}<del>${MarkerStore.escapeHtml(i.name)}</del> (немає)</div>
                    <div>
                      <input type="checkbox" class="pack-checkbox" data-item-act="toggle-pack" data-ord-id="${o.id}" data-idx="${idx}" ${i.packed ? 'checked' : ''}>
                      <strong>🔄 Заміна:</strong> ${repSku}<span class="item-name-text">${MarkerStore.escapeHtml(i.replacement.name)} × ${MarkerStore.formatQty(i.replacement.qty)} (${MarkerStore.escapeHtml(i.replacement.unit)})</span>
                    </div>
                  </div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <strong>${MarkerStore.formatPrice(i.replacement.price * i.replacement.qty)}</strong>
                    <button type="button" class="btn-mini" data-item-act="restore" data-ord-id="${o.id}" data-idx="${idx}">Скасувати заміну</button>
                  </div>
                </div>`;
            }

            return `
              <div class="order-item-line ${i.packed ? 'is-packed' : ''}">
                <div>
                  <input type="checkbox" class="pack-checkbox" data-item-act="toggle-pack" data-ord-id="${o.id}" data-idx="${idx}" ${i.packed ? 'checked' : ''} title="Позначити як покладено в пакет">
                  ${skuBadge}<span class="item-name-text">${MarkerStore.escapeHtml(i.name)} × <strong>${MarkerStore.formatQty(i.qty)}</strong> (${MarkerStore.escapeHtml(i.unit)})</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <strong>${MarkerStore.formatPrice(i.price * i.qty)}</strong>
                  <button type="button" class="btn-mini" data-item-act="weight" data-ord-id="${o.id}" data-idx="${idx}" title="Змінити точну вагу або кількість">⚖️ Вага / к-сть</button>
                  <button type="button" class="btn-mini" style="background:var(--red-bg); color:var(--red);" data-item-act="missing" data-ord-id="${o.id}" data-idx="${idx}">Немає в наявності</button>
                </div>
              </div>`;
          })
          .join('');

        return `
          <article class="order-card ${isArriving ? 'arriving-highlight' : ''}">
            ${
              isArriving
                ? `<div class="arriving-alert-bar">
                     <span>🔔 УВАГА! Клієнт повідомив: «${MarkerStore.escapeHtml(o.clientArriving)}» (о ${o.clientArrivingAt}) — підготуйте пакет на видачу!</span>
                     <button type="button" class="btn-mini" data-clear-arriving="${o.id}">Зняти сигнал</button>
                   </div>`
                : ''
            }

            <div class="order-card-top">
              <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span class="order-code-tag">Код #${o.code}</span>
                <strong>${MarkerStore.escapeHtml(o.fullName)}</strong>
                <a href="tel:${MarkerStore.escapeHtml(o.phone)}" style="color:var(--brown-main); font-weight:700; font-size:13px;">📞 ${MarkerStore.escapeHtml(o.phone)}</a>
                <span style="font-size:12px; color:var(--text-muted);">${o.createdAt}</span>
                <span style="font-size:12px; font-weight:700; color:var(--green);">✓ Зібрано: ${packedCount} з ${activeItems.length}</span>
                ${hasAdult ? '<span class="status-pill status-rejected">🔞 18+ Документ</span>' : ''}
              </div>
              <span class="status-pill ${getStatusClass(o.status)}">${o.status === 'Виконано успішно' ? '✅ ' : ''}${o.status}</span>
            </div>

            ${
              o.addedNote
                ? `<div style="background:var(--blue-bg); color:var(--blue); padding:6px 12px; border-radius:8px; font-size:12px; font-weight:700; margin-bottom:10px;">➕ ${MarkerStore.escapeHtml(o.addedNote)}</div>`
                : ''
            }

            <div class="order-items-summary">${itemsHtml}</div>

            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <span style="font-size:13px;">Оплата: <strong>${MarkerStore.escapeHtml(o.paymentMethod)}</strong></span>
                ${
                  o.discountAmount > 0
                    ? `<span style="margin-left:10px; font-size:12px; color:var(--green); font-weight:700;">(Знижка -${o.discountPercent}%: -${MarkerStore.formatPrice(o.discountAmount)})</span>`
                    : ''
                }
              </div>
              <strong style="font-size:18px; color:var(--brown-dark);">Сума: ${MarkerStore.formatPrice(o.total)}</strong>
            </div>

            <div class="admin-actions-bar">
              ${
                hasUnapprovedChanges &&
                o.status !== 'Очікує підтвердження клієнта' &&
                o.status !== 'Відхилено' &&
                o.status !== 'Виконано успішно'
                  ? `<button type="button" class="btn btn-yellow btn-sm" style="border:2px solid var(--brown-dark);" data-ord-id="${o.id}" data-set-status="Очікує підтвердження клієнта">📩 Надіслати зміни на погодження клієнту</button>`
                  : ''
              }
              ${
                o.status === 'Розміщено'
                  ? `<button type="button" class="btn btn-green btn-sm" data-ord-id="${o.id}" data-set-status="Комплектується">✓ Прийняти в роботу</button>
                     <button type="button" class="btn btn-red btn-sm" data-ord-id="${o.id}" data-set-status="Відхилено">✕ Відхилити</button>`
                  : ''
              }
              <button type="button" class="btn btn-outline-brown btn-sm" data-ord-id="${o.id}" data-set-status="Розміщено">Розміщено</button>
              <button type="button" class="btn btn-outline-brown btn-sm" data-ord-id="${o.id}" data-set-status="Комплектується">Комплектується</button>
              <button type="button" class="btn btn-yellow btn-sm" data-ord-id="${o.id}" data-set-status="Готове до видачі">Готове до видачі</button>
              <button type="button" class="btn btn-green btn-sm" data-ord-id="${o.id}" data-set-status="Виконано успішно">✅ Виконано успішно</button>
              ${
                o.status !== 'Відхилено' &&
                o.status !== 'Розміщено' &&
                o.status !== 'Виконано успішно'
                  ? `<button type="button" class="btn btn-red btn-sm" data-ord-id="${o.id}" data-set-status="Відхилено">Відхилити</button>`
                  : ''
              }
            </div>
          </article>`;
      })
      .join('');
  }

  document.getElementById('admin-order-filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    currentOrderFilter = chip.dataset.status;
    document.querySelectorAll('#admin-order-filters .chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    renderAdminOrders();
  });

  document.getElementById('admin-orders-list').addEventListener('click', (e) => {
    const clearArrBtn = e.target.closest('[data-clear-arriving]');
    if (clearArrBtn) {
      const orders = MarkerStore.getOrders();
      const idx = orders.findIndex((o) => o.id === clearArrBtn.dataset.clearArriving);
      if (idx !== -1) {
        orders[idx].clientArriving = '';
        MarkerStore.saveOrders(orders);
        renderAdminOrders();
      }
      return;
    }

    const statusBtn = e.target.closest('[data-set-status]');
    if (statusBtn) {
      MarkerStore.updateOrderStatus(statusBtn.dataset.ordId, statusBtn.dataset.setStatus);
      showToast(`Статус змінено на «${statusBtn.dataset.setStatus}»`);
      refreshAdminAll();
      return;
    }

    const itemActEl = e.target.closest('[data-item-act]');
    if (!itemActEl) return;

    const act = itemActEl.dataset.itemAct;
    const ordId = itemActEl.dataset.ordId;
    const idx = parseInt(itemActEl.dataset.idx, 10);
    const orders = MarkerStore.getOrders();
    const oIdx = orders.findIndex((o) => o.id === ordId);
    if (oIdx === -1 || !orders[oIdx].items[idx]) return;

    const item = orders[oIdx].items[idx];

    if (act === 'toggle-pack') {
      item.packed = !item.packed;
      MarkerStore.saveOrders(orders);
      renderAdminOrders();
    } else if (act === 'weight') {
      const currentVal = item.status === 'replaced' && item.replacement ? item.replacement.qty : item.qty;
      const input = prompt(
        `Введіть фактичну вагу або кількість для «${item.name}» (${item.unit}):`,
        currentVal
      );
      if (input !== null) {
        const parsed = parseFloat(String(input).replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) {
          if (item.status === 'replaced' && item.replacement) {
            item.replacement.qty = MarkerStore.formatQty(parsed);
          } else {
            item.qty = MarkerStore.formatQty(parsed);
          }
          MarkerStore.recalculateOrderTotals(orders[oIdx]);
          MarkerStore.saveOrders(orders);
          showToast('Вагу та суму замовлення перераховано!');
          refreshAdminAll();
        }
      }
    } else if (act === 'missing') {
      openMissingItemModal(ordId, idx);
    } else if (act === 'restore') {
      item.status = 'active';
      item.replacement = null;
      MarkerStore.recalculateOrderTotals(orders[oIdx]);
      MarkerStore.saveOrders(orders);
      showToast('Позицію відновлено у замовленні');
      refreshAdminAll();
    }
  });

  function openMissingItemModal(orderId, itemIndex) {
    const orders = MarkerStore.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (!order || !order.items[itemIndex]) return;

    activeMissingTarget = { orderId, itemIndex };
    const item = order.items[itemIndex];
    missingModalItemTitle.innerHTML = `Позиція: <strong>${MarkerStore.escapeHtml(item.name)}</strong> (${MarkerStore.formatQty(item.qty)} ${MarkerStore.escapeHtml(item.unit)} • ${MarkerStore.formatPrice(item.price)})`;
    replacementSearchInput.value = '';
    renderReplacementCandidates('');
    missingItemModal.classList.remove('hidden');
  }

  function renderReplacementCandidates(query) {
    const q = query.trim().toLowerCase();
    const products = MarkerStore.getProducts().filter((p) => p.inStock);
    const filtered = products
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 20);

    if (filtered.length === 0) {
      replacementCandidatesList.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px;">Підходящих товарів в наявності не знайдено.</div>`;
      return;
    }

    replacementCandidatesList.innerHTML = filtered
      .map((p) => {
        const skuTag = p.sku ? `[Код: ${MarkerStore.escapeHtml(p.sku)}] ` : '';
        return `
          <div class="replacement-option-row">
            <div>
              <strong>${skuTag}${MarkerStore.escapeHtml(p.name)}</strong><br>
              <small style="color:var(--text-muted);">${MarkerStore.escapeHtml(p.unit)} • ${MarkerStore.formatPrice(p.price)}</small>
            </div>
            <button type="button" class="btn btn-yellow btn-xs" data-pick-replacement="${p.id}">Обрати заміну</button>
          </div>`;
      })
      .join('');
  }

  replacementSearchInput.addEventListener('input', (e) => {
    renderReplacementCandidates(e.target.value);
  });

  function maybeDisableMissingProductInCatalog(productId) {
    if (!missingAlsoDisableCatalog.checked) return;
    const products = MarkerStore.getProducts();
    const pIdx = products.findIndex((p) => p.id === productId);
    if (pIdx !== -1) {
      products[pIdx].inStock = false;
      MarkerStore.saveProducts(products);
    }
  }

  document.getElementById('choice-remove-item-btn').addEventListener('click', () => {
    if (!activeMissingTarget) return;
    const { orderId, itemIndex } = activeMissingTarget;
    const orders = MarkerStore.getOrders();
    const oIdx = orders.findIndex((o) => o.id === orderId);
    if (oIdx === -1) return;

    const item = orders[oIdx].items[itemIndex];
    item.status = 'missing';
    item.replacement = null;
    item.packed = false;

    maybeDisableMissingProductInCatalog(item.id);
    MarkerStore.recalculateOrderTotals(orders[oIdx]);
    MarkerStore.saveOrders(orders);

    missingItemModal.classList.add('hidden');
    activeMissingTarget = null;
    showToast('Товар виключено із замовлення. Натисніть «Надіслати зміни на погодження клієнту».');
    refreshAdminAll();
  });

  replacementCandidatesList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick-replacement]');
    if (!btn || !activeMissingTarget) return;

    const repProd = MarkerStore.getProducts().find((p) => p.id === btn.dataset.pickReplacement);
    if (!repProd) return;

    const { orderId, itemIndex } = activeMissingTarget;
    const orders = MarkerStore.getOrders();
    const oIdx = orders.findIndex((o) => o.id === orderId);
    if (oIdx === -1) return;

    const item = orders[oIdx].items[itemIndex];
    item.status = 'replaced';
    item.packed = false;
    item.replacement = {
      id: repProd.id,
      sku: repProd.sku || '',
      name: repProd.name,
      unit: repProd.unit,
      price: repProd.price,
      qty: item.qty
    };

    maybeDisableMissingProductInCatalog(item.id);
    MarkerStore.recalculateOrderTotals(orders[oIdx]);
    MarkerStore.saveOrders(orders);

    missingItemModal.classList.add('hidden');
    activeMissingTarget = null;
    showToast(`Заміну «${repProd.name}» додано! Надішліть замовлення на погодження клієнту.`);
    refreshAdminAll();
  });

  document.getElementById('close-missing-modal-btn').addEventListener('click', () => {
    missingItemModal.classList.add('hidden');
    activeMissingTarget = null;
  });

  function compressImageFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 360;
          let w = img.width;
          let h = img.height;
          if (w > maxSide || h > maxSide) {
            if (w > h) {
              h = Math.round((h * maxSide) / w);
              w = maxSide;
            } else {
              w = Math.round((w * maxSide) / h);
              h = maxSide;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = () => resolve('');
        img.src = ev.target.result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sku = document.getElementById('prod-sku').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value.trim();
    const unit = document.getElementById('prod-unit').value.trim();
    const price = parseFloat(document.getElementById('prod-price').value);
    const icon = document.getElementById('prod-icon').value;
    const urlInput = document.getElementById('prod-image-url').value.trim();
    const fileInput = document.getElementById('prod-image-file');

    if (!name || !category || isNaN(price) || price <= 0) return;

    let image = urlInput;
    if (fileInput.files && fileInput.files[0]) {
      image = await compressImageFile(fileInput.files[0]);
    }

    const products = MarkerStore.getProducts();
    products.unshift({
      id: 'prod_' + Date.now(),
      sku,
      name,
      category,
      price,
      unit: unit || 'шт',
      icon,
      image,
      inStock: true
    });

    MarkerStore.saveProducts(products);
    MarkerStore.getCategories();
    e.target.reset();
    document.getElementById('prod-unit').value = 'шт';
    showToast(`Товар «${name}» додано в магазин!`);
    refreshAdminAll();
  });

  function renderAdminProducts() {
    const products = MarkerStore.getProducts();
    const q = adminProductSearch.trim().toLowerCase();
    const filtered = products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );

    document.getElementById('admin-products-count').textContent = products.length;
    const listEl = document.getElementById('admin-products-list');

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state">Товарів не знайдено.</div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((p) => {
        const thumb = p.image
          ? `<img src="${MarkerStore.escapeHtml(p.image)}" alt="">`
          : MarkerStore.escapeHtml(p.icon || '🛒');

        const skuBadge = p.sku
          ? `<span style="background:var(--brown-dark); color:var(--yellow); padding:2px 7px; border-radius:6px; font-size:11px; font-weight:700; margin-right:6px;">Код: ${MarkerStore.escapeHtml(p.sku)}</span>`
          : `<span style="background:var(--white); border:1px solid var(--border); color:var(--text-muted); padding:2px 7px; border-radius:6px; font-size:11px; margin-right:6px;">Без коду</span>`;

        return `
          <div class="admin-prod-row">
            <div class="admin-prod-main">
              <div class="admin-prod-thumb">${thumb}</div>
              <div>
                <strong style="display:block; font-size:14px;">${skuBadge}${MarkerStore.escapeHtml(p.name)}</strong>
                <span style="font-size:12px; color:var(--text-muted);">${MarkerStore.escapeHtml(p.category)} • ${MarkerStore.escapeHtml(p.unit)} • <strong>${MarkerStore.formatPrice(p.price)}</strong></span>
              </div>
            </div>
            <div class="admin-prod-controls">
              <button type="button" class="btn-mini" data-prod-act="sku" data-id="${p.id}">Змінити код</button>
              <button type="button" class="btn-mini" data-prod-act="price" data-id="${p.id}">Змінити ціну</button>
              <button type="button" class="btn-mini" style="background:${p.inStock ? 'var(--green-bg)' : 'var(--red-bg)'}; color:${p.inStock ? 'var(--green)' : 'var(--red)'};" data-prod-act="stock" data-id="${p.id}">
                ${p.inStock ? 'В наявності' : 'Немає'}
              </button>
              <button type="button" class="btn-mini" style="background:var(--red-bg); color:var(--red);" data-prod-act="delete" data-id="${p.id}">✕</button>
            </div>
          </div>`;
      })
      .join('');
  }

  document.getElementById('admin-product-search').addEventListener('input', (e) => {
    adminProductSearch = e.target.value;
    renderAdminProducts();
  });

  document.getElementById('admin-products-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-prod-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.prodAct;
    const products = MarkerStore.getProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) return;

    if (act === 'sku') {
      const nextSku = prompt(
        `Внутрішній код товару для «${products[idx].name}»:`,
        products[idx].sku || ''
      );
      if (nextSku !== null) {
        products[idx].sku = nextSku.trim();
        MarkerStore.saveProducts(products);
        showToast('Код товару оновлено');
      }
    } else if (act === 'stock') {
      products[idx].inStock = !products[idx].inStock;
      MarkerStore.saveProducts(products);
      showToast('Наявність товару оновлено');
    } else if (act === 'price') {
      const nextPrice = prompt(
        `Нова ціна (грн) для «${products[idx].name}»:`,
        products[idx].price
      );
      const parsed = parseFloat(nextPrice);
      if (!isNaN(parsed) && parsed > 0) {
        products[idx].price = parsed;
        MarkerStore.saveProducts(products);
        showToast('Ціну оновлено');
      }
    } else if (act === 'delete') {
      if (confirm(`Видалити товар «${products[idx].name}»?`)) {
        products.splice(idx, 1);
        MarkerStore.saveProducts(products);
        showToast('Товар видалено');
      }
    }

    refreshAdminAll();
  });

  function renderAdminCategories() {
    const categories = MarkerStore.getCategories();
    const products = MarkerStore.getProducts();
    const settings = MarkerStore.getSettings();

    document.getElementById('toggle-hide-empty-cats').checked = Boolean(
      settings.hideEmptyCategories
    );

    const datalist = document.getElementById('category-suggestions');
    datalist.innerHTML = categories
      .map((c) => `<option value="${MarkerStore.escapeHtml(c.name)}">`)
      .join('');

    const listEl = document.getElementById('admin-categories-list');
    listEl.innerHTML = categories
      .map((c, idx) => {
        const count = products.filter((p) => p.category === c.name).length;
        const isProtected = c.name === ALCOHOL_CATEGORY;
        return `
          <div class="admin-prod-row">
            <div>
              <strong style="font-size:14px;">${MarkerStore.escapeHtml(c.name)}</strong>
              <span style="display:block; font-size:12px; color:var(--text-muted);">Товарів у категорії: ${count}</span>
            </div>
            <div class="admin-prod-controls">
              <button type="button" class="btn-mini" data-cat-act="up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}>▲</button>
              <button type="button" class="btn-mini" data-cat-act="down" data-idx="${idx}" ${idx === categories.length - 1 ? 'disabled' : ''}>▼</button>
              <button type="button" class="btn-mini" style="background:${!c.hidden ? 'var(--green-bg)' : 'var(--red-bg)'}; color:${!c.hidden ? 'var(--green)' : 'var(--red)'};" data-cat-act="toggle" data-idx="${idx}">
                ${!c.hidden ? 'Показано' : 'Приховано'}
              </button>
              ${
                !isProtected && count === 0
                  ? `<button type="button" class="btn-mini" style="background:var(--red-bg); color:var(--red);" data-cat-act="delete" data-idx="${idx}">✕</button>`
                  : ''
              }
            </div>
          </div>`;
      })
      .join('');
  }

  document.getElementById('add-category-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    if (!name) return;

    const categories = MarkerStore.getCategories();
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      showToast('Така категорія вже існує!');
      return;
    }

    categories.unshift({ name, hidden: false });
    MarkerStore.saveCategories(categories);
    input.value = '';
    showToast(`Категорію «${name}» створено!`);
    renderAdminCategories();
  });

  document.getElementById('toggle-hide-empty-cats').addEventListener('change', (e) => {
    MarkerStore.saveSettings({ hideEmptyCategories: e.target.checked });
    showToast('Налаштування видимості порожніх категорій збережено');
  });

  document.getElementById('admin-categories-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat-act]');
    if (!btn) return;
    const act = btn.dataset.catAct;
    const idx = parseInt(btn.dataset.idx, 10);
    const categories = MarkerStore.getCategories();
    if (!categories[idx]) return;

    if (act === 'up' && idx > 0) {
      [categories[idx - 1], categories[idx]] = [categories[idx], categories[idx - 1]];
    } else if (act === 'down' && idx < categories.length - 1) {
      [categories[idx + 1], categories[idx]] = [categories[idx], categories[idx + 1]];
    } else if (act === 'toggle') {
      categories[idx].hidden = !categories[idx].hidden;
    } else if (act === 'delete') {
      categories.splice(idx, 1);
    }

    MarkerStore.saveCategories(categories);
    renderAdminCategories();
  });

  function renderCustomerStats() {
    const stats = MarkerStore.getCustomerAnalytics();
    const q = customerSearch.trim().toLowerCase();
    const filtered = stats.filter(
      (c) => !q || c.phoneDisplay.toLowerCase().includes(q) || c.fullName.toLowerCase().includes(q)
    );

    const tbody = document.getElementById('customers-stats-tbody');

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:28px; color:var(--text-muted);">Даних про клієнтів поки немає.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map(
        (c) => `
        <tr>
          <td><strong>${MarkerStore.escapeHtml(c.fullName)}</strong><br><small style="color:var(--text-muted);">Останнє: ${c.lastOrderDate}</small></td>
          <td><strong>${MarkerStore.escapeHtml(c.phoneDisplay)}</strong></td>
          <td>
            ${
              c.isLoyal
                ? `<span class="status-pill status-ready">⭐ Постійний клієнт</span>`
                : `<span class="status-pill status-placed">Звичайний</span>`
            }
          </td>
          <td><strong>${c.totalOrders}</strong></td>
          <td><span style="color:var(--green); font-weight:700;">${c.successfulOrders} успішн.</span> / <span style="color:var(--red);">${c.rejectedOrders} відхил.</span></td>
          <td>
            <div class="rate-bar-wrap">
              <div class="rate-bar"><div class="rate-bar-fill" style="width:${c.successRate}%;"></div></div>
              <strong>${c.successRate}%</strong>
            </div>
          </td>
          <td><strong style="color:var(--brown-dark);">${MarkerStore.formatPrice(c.successfulSum)}</strong></td>
          <td>${MarkerStore.formatPrice(c.avgCheck)}</td>
        </tr>`
      )
      .join('');
  }

  document.getElementById('customer-stats-search').addEventListener('input', (e) => {
    customerSearch = e.target.value;
    renderCustomerStats();
  });

  function exportOrdersToCsv(filteredOrders, periodLabel) {
    const validOrders = filteredOrders.filter((o) => o.status !== 'Відхилено');
    const totalRevenue = validOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const avgCheck =
      validOrders.length > 0 ? Math.round((totalRevenue / validOrders.length) * 100) / 100 : 0;

    const productStatsMap = new Map();
    validOrders.forEach((o) => {
      (o.items || []).forEach((i) => {
        const st = i.status || 'active';
        if (st === 'missing') return;
        const target = st === 'replaced' && i.replacement ? i.replacement : i;
        const key = target.id || target.name;
        if (!productStatsMap.has(key)) {
          productStatsMap.set(key, {
            sku: target.sku || '',
            name: target.name,
            unit: target.unit,
            qty: 0,
            sum: 0
          });
        }
        const entry = productStatsMap.get(key);
        entry.qty = MarkerStore.formatQty(entry.qty + Number(target.qty || 0));
        entry.sum = Math.round((entry.sum + Number(target.price || 0) * Number(target.qty || 0)) * 100) / 100;
      });
    });

    const topProducts = Array.from(productStatsMap.values()).sort((a, b) => b.sum - a.sum);

    const escCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const lines = [];
    lines.push([escCsv(`ЗВІТ МАГАЗИНУ MARKER PLUS (${periodLabel})`)].join(';'));
    lines.push([escCsv('Успішних замовлень'), escCsv(validOrders.length)].join(';'));
    lines.push([escCsv('Загальна виручка (грн)'), escCsv(totalRevenue)].join(';'));
    lines.push([escCsv('Середній чек (грн)'), escCsv(avgCheck)].join(';'));
    lines.push('');

    lines.push([escCsv('НАЙПОПУЛЯРНІШІ ТОВАРИ ЗА ПЕРІОД')].join(';'));
    lines.push(
      [
        escCsv('Код товару'),
        escCsv('Назва товару'),
        escCsv('Одиниця'),
        escCsv('Продано кількість'),
        escCsv('Виручка (грн)')
      ].join(';')
    );
    topProducts.forEach((tp) => {
      lines.push(
        [escCsv(tp.sku), escCsv(tp.name), escCsv(tp.unit), escCsv(tp.qty), escCsv(tp.sum)].join(';')
      );
    });
    lines.push('');

    lines.push([escCsv('ДЕТАЛЬНИЙ СПИСОК ЗАМОВЛЕНЬ')].join(';'));
    lines.push(
      [
        escCsv('Код замовлення'),
        escCsv('Дата і час'),
        escCsv('Клієнт'),
        escCsv('Телефон'),
        escCsv('Статус'),
        escCsv('Спосіб оплати'),
        escCsv('Знижка (%)'),
        escCsv('Сума (грн)'),
        escCsv('Склад замовлення')
      ].join(';')
    );

    filteredOrders.forEach((o) => {
      const itemsText = (o.items || [])
        .map((i) => {
          const st = i.status || 'active';
          if (st === 'missing') return `[ВІДСУТНІЙ] ${i.name}`;
          if (st === 'replaced' && i.replacement) {
            return `[ЗАМІНА] ${i.replacement.name} x${i.replacement.qty}`;
          }
          return `${i.sku ? `[${i.sku}] ` : ''}${i.name} x${i.qty}`;
        })
        .join(', ');

      lines.push(
        [
          escCsv(`#${o.code}`),
          escCsv(o.createdAt),
          escCsv(o.fullName),
          escCsv(o.phone),
          escCsv(o.status),
          escCsv(o.paymentMethod),
          escCsv(o.discountPercent || 0),
          escCsv(o.total),
          escCsv(itemsText)
        ].join(';')
      );
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MarkerPlus_Zvit_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Файл звіту для Excel завантажено!');
  }

  document.querySelectorAll('[data-export-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.exportRange;
      const allOrders = MarkerStore.getOrders();
      const now = new Date();

      if (range === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const filtered = allOrders.filter((o) => (o.timestamp || 0) >= start);
        exportOrdersToCsv(filtered, 'За сьогодні');
      } else if (range === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const filtered = allOrders.filter((o) => (o.timestamp || 0) >= start);
        exportOrdersToCsv(filtered, 'За поточний місяць');
      } else {
        exportOrdersToCsv(allOrders, 'За весь період');
      }
    });
  });

  document.getElementById('export-custom-btn').addEventListener('click', () => {
    const fromVal = document.getElementById('export-date-from').value;
    const toVal = document.getElementById('export-date-to').value;
    if (!fromVal || !toVal) {
      alert('Оберіть початкову та кінцеву дату для звіту.');
      return;
    }
    const startTs = new Date(fromVal + 'T00:00:00').getTime();
    const endTs = new Date(toVal + 'T23:59:59').getTime();
    const filtered = MarkerStore.getOrders().filter(
      (o) => (o.timestamp || 0) >= startTs && (o.timestamp || 0) <= endTs
    );
    exportOrdersToCsv(filtered, `Період ${fromVal} — ${toVal}`);
  });

  function loadSettingsForm() {
    const settings = MarkerStore.getSettings();
    document.getElementById('setting-card-number').value = settings.cardNumber;
    document.getElementById('setting-card-holder').value = settings.cardHolder;
    document.getElementById('setting-loyalty-threshold').value = settings.loyaltyThreshold;
    document.getElementById('setting-loyalty-discount').value = settings.loyaltyDiscount;
    document.getElementById('setting-admin-pass').value = settings.adminPassword;
  }

  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const cardNumber = document.getElementById('setting-card-number').value.trim();
    const cardHolder = document.getElementById('setting-card-holder').value.trim();
    const loyaltyThreshold = parseInt(
      document.getElementById('setting-loyalty-threshold').value,
      10
    );
    const loyaltyDiscount = parseFloat(
      document.getElementById('setting-loyalty-discount').value
    );
    const adminPassword = document.getElementById('setting-admin-pass').value.trim();

    MarkerStore.saveSettings({
      cardNumber: cardNumber || 'Вкажіть номер картки в адмін-панелі',
      cardHolder,
      loyaltyThreshold: !isNaN(loyaltyThreshold) && loyaltyThreshold >= 1 ? loyaltyThreshold : 5,
      loyaltyDiscount: !isNaN(loyaltyDiscount) && loyaltyDiscount >= 0 ? loyaltyDiscount : 0,
      adminPassword: adminPassword || 'marketplus3845fff'
    });

    showToast('Усі налаштування збережено!');
    refreshAdminAll();
  });

  function refreshAdminAll() {
    renderKPI();
    renderAdminOrders();
    renderAdminProducts();
    renderAdminCategories();
    renderCustomerStats();
  }

  window.addEventListener('storage', () => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      refreshAdminAll();
    }
  });

  setInterval(() => {
    if (sessionStorage.getItem(SESSION_KEY) !== 'true') return;
    const currentSnapshot = JSON.stringify(MarkerStore.getOrders());
    if (currentSnapshot !== lastOrdersSnapshot) {
      refreshAdminAll();
    }
  }, 3000);

  loadSettingsForm();
  checkAuth();
})();