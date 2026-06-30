// ملف منطق العمل والتحكم البرمجي لتطبيق VetStock Pro

// 1. إدارة الحالة وقاعدة البيانات (State Management)
let state = {
  products: [],
  customers: [],
  transactions: [], // فواتير وسندات
  nextSalesInvoiceNum: 78, // مبيعات عامة تبدأ من 78 (بعد الفاتورة S77)
  nextVaxigenSalesInvoiceNum: 1, // مبيعات Vaxigen تبدأ من 1
  nextPurchaseInvoiceNum: 1,
  nextReturnInvoiceNum: 1,
  nextPaymentNum: 1
};

// تحميل البيانات واسترجاع الحالة عند تشغيل البرنامج
function initApp() {
  const savedData = localStorage.getItem('vet_stock_pro_db');
  
  if (savedData) {
    try {
      state = JSON.parse(savedData);
      
      // تهيئة مسميات التطبيق والقوائم إذا لم تكن موجودة
      if (!state.appName) state.appName = 'VetStock Pro';
      if (!state.menuNames) {
        state.menuNames = {
          nav_dashboard: "لوحة التحكم",
          nav_invoices: "الفواتير والعمليات",
          nav_inventory: "إدارة المخزون",
          nav_customers: "العملاء والحسابات",
          nav_ledger: "كشف الحساب",
          nav_reports: "مركز التقارير",
          nav_settings: "النسخ والإعدادات"
        };
      }
      if (state.prefixSales === undefined) state.prefixSales = 'S-';
      if (state.prefixVaxigen === undefined) state.prefixVaxigen = 'V-';
      if (state.prefixPurchase === undefined) state.prefixPurchase = 'B-';
      if (state.prefixReturn === undefined) state.prefixReturn = 'R-';
      if (state.prefixPayment === undefined) state.prefixPayment = 'P-';
      if (!state.regions) {
        state.regions = ["الغربية", "الوسطى", "الجنوبية", "الشرقية"];
      }
      
      // هجرة وتطهير قاعدة البيانات التلقائي لحذف مبيعات شركة Z وتثبيت الترقيم بعد S77
      if (state.transactions) {
        state.transactions = state.transactions.filter(t => t.type !== 'sales_z' && !t.id.startsWith('Z-'));
      }
      
      // تحويل سند قبض S-68 إلى فاتورة مبيعات إذا كان مسجلاً كسند قبض
      if (state.transactions) {
        const targetTx = state.transactions.find(t => {
          if (!t.id) return false;
          const cleanedId = t.id.toUpperCase().replace('#', '').trim();
          return cleanedId === 'S-68';
        });
        if (targetTx && targetTx.type === 'payment') {
          targetTx.type = 'sales';
          targetTx.items = targetTx.items || [];
          targetTx.subtotal = 0;
          targetTx.discount = 0;
          targetTx.vat_active = false;
          targetTx.vat_amount = 0;
          targetTx.total = Number(targetTx.amount) || 0;
          delete targetTx.amount;
          delete targetTx.notes;
          console.log("Migration: Converted transaction S-68 from payment to sales invoice.");
        }
      }
      
      let maxSalesNum = 77; // الحد الأدنى الافتراضي للترقيم بعد S77
      if (state.transactions) {
        state.transactions.forEach(t => {
          if (t.type === 'sales' && t.id.startsWith('S-')) {
            const num = parseInt(t.id.substring(2));
            if (!isNaN(num) && num > maxSalesNum) {
              maxSalesNum = num;
            }
          }
        });
      }
      state.nextSalesInvoiceNum = maxSalesNum + 1;
      
      // التخلص من حقول شركة Z المهجورة
      if (state.nextCompanyZSalesInvoiceNum !== undefined) {
        delete state.nextCompanyZSalesInvoiceNum;
      }
      
      let maxVaxigenNum = 0;
      if (state.transactions) {
        state.transactions.forEach(t => {
          if (t.type === 'sales_vaxigen' && t.id.startsWith('V-')) {
            const num = parseInt(t.id.substring(2));
            if (!isNaN(num) && num > maxVaxigenNum) {
              maxVaxigenNum = num;
            }
          }
        });
      }
      state.nextVaxigenSalesInvoiceNum = Math.max(state.nextVaxigenSalesInvoiceNum || 1, maxVaxigenNum + 1);
      saveState(); // حفظ قاعدة البيانات النظيفة والمهاجرة
      console.log("Database migrated. Company Z removed. Sales Invoice starts at " + state.nextSalesInvoiceNum);
    } catch (e) {
      console.error("Error parsing saved local storage db, loading defaults...", e);
      loadDefaultDatabase();
    }
  } else {
    loadDefaultDatabase();
  }

  // تهيئة الواجهة
  applyLanguage(state.currentLang || 'ar');
  applyCustomNamesToDOM();
  switchSection('dashboard');
  refreshAllViews();
}

// تحميل قاعدة البيانات الافتراضية
function loadDefaultDatabase() {
  if (window.DEFAULT_DATA) {
    state.products = JSON.parse(JSON.stringify(window.DEFAULT_DATA.products));
    state.customers = JSON.parse(JSON.stringify(window.DEFAULT_DATA.customers));
    state.transactions = [];
    state.nextSalesInvoiceNum = 78; // الترقيم يستأنف بعد S77
    state.nextVaxigenSalesInvoiceNum = 1;
    state.nextPurchaseInvoiceNum = 1;
    state.nextReturnInvoiceNum = 1;
    state.nextPaymentNum = 1;
    state.appName = 'VetStock Pro';
    state.menuNames = {
      nav_dashboard: "لوحة التحكم",
      nav_invoices: "الفواتير والعمليات",
      nav_inventory: "إدارة المخزون",
      nav_customers: "العملاء والحسابات",
      nav_ledger: "كشف الحساب",
      nav_reports: "مركز التقارير",
      nav_settings: "النسخ والإعدادات"
    };
    state.prefixSales = 'S-';
    state.prefixVaxigen = 'V-';
    state.prefixPurchase = 'B-';
    state.prefixReturn = 'R-';
    state.prefixPayment = 'P-';
    state.regions = ["الغربية", "الوسطى", "الجنوبية", "الشرقية"];
    saveState();
    console.log("Initialized default database from desktop data.js");
  } else {
    console.error("DEFAULT_DATA not found. Database is empty.");
  }
}

// حفظ الحالة الحالية في التخزين المحلي
function saveState() {
  localStorage.setItem('vet_stock_pro_db', JSON.stringify(state));
}

// ================= 2. محركات الحسابات الديناميكية (Dynamic Ledgers) =================

// أ. حساب المخزون الحالي لصنف معين بالمعادلة المحاسبية
// المخزون الحالي = المخزون الافتتاحي + المشتريات + المرتجع - المبيعات
function calculateProductStock(prodCode) {
  const prod = state.products.find(p => p.code === prodCode);
  if (!prod) return 0;
  
  let currentStock = Number(prod.initial_stock) || 0;
  
  state.transactions.forEach(t => {
    if (t.type === 'purchase') {
      const item = t.items.find(i => i.code === prodCode);
      if (item) currentStock += Number(item.qty) || 0;
    } else if (t.type === 'return') {
      const item = t.items.find(i => i.code === prodCode);
      if (item) currentStock += Number(item.qty) || 0; // إرجاع مبيعات يضيف للمخزون
    } else if (t.type === 'sales' || t.type === 'sales_vaxigen') {
      const item = t.items.find(i => i.code === prodCode);
      if (item) currentStock -= Number(item.qty) || 0; // المبيعات تخصم من المخزون
    }
  });
  
  return currentStock;
}

// ب. حساب مديونية العميل الحالية بالمعادلة المحاسبية
// مديونية العميل الحالية = الرصيد الافتتاحي + فواتير المبيعات - فواتير المرتجع - سندات القبض المستلمة
function calculateCustomerBalance(custName) {
  const cust = state.customers.find(c => c.name === custName);
  if (!cust) return 0;
  
  let currentBalance = Number(cust.initial_balance) || 0;
  
  state.transactions.forEach(t => {
    if (t.customer === custName) {
      if (t.type === 'sales' || t.type === 'sales_vaxigen') {
        currentBalance += Number(t.total) || 0; // مبيعات تزيد مديونيته
      } else if (t.type === 'return') {
        currentBalance -= Number(t.total) || 0; // مرتجع مبيعات يخصم مديونيته
      } else if (t.type === 'payment') {
        currentBalance -= Number(t.amount) || 0; // سند قبض يخصم مديونيته
      }
    }
  });
  
  return currentBalance;
}

// ت. حساب القيمة الإجمالية للمخزون البيطري بالأسعار الحالية
function getInventoryTotalValue() {
  let totalVal = 0;
  state.products.forEach(p => {
    const currentStock = calculateProductStock(p.code);
    totalVal += currentStock * (Number(p.price_buy) || 0); // تقييم المخزون بسعر الشراء
  });
  return totalVal;
}

// ث. حساب مجموع ديون العملاء الإجمالية المستحقة
function getReceivablesTotal() {
  let totalReceivables = 0;
  state.customers.forEach(c => {
    totalReceivables += calculateCustomerBalance(c.name);
  });
  return totalReceivables;
}

// ج. حساب إجمالي المبيعات الإجمالية الموثقة بالفواتير
function getSalesTotal() {
  let totalSales = 0;
  state.transactions.forEach(t => {
    if (t.type === 'sales' || t.type === 'sales_vaxigen') {
      totalSales += Number(t.total) || 0;
    }
  });
  return totalSales;
}

// ح. حساب إجمالي المشتريات الإجمالية الموثقة بالفواتير
function getPurchasesTotal() {
  let totalPurchases = 0;
  state.transactions.forEach(t => {
    if (t.type === 'purchase') {
      totalPurchases += Number(t.total) || 0;
    }
  });
  return totalPurchases;
}

// ================= 3. تحديث شاشات العرض والتفاعل (Views Refresh) =================

function refreshAllViews() {
  populateRegionSelects();
  renderDashboard();
  renderProductTable();
  renderCustomerTable();
  populateInvoiceSelects();
  populateLedgerCustomerSelect();
  populateReportSelects();
}

// أ. بناء شاشة لوحة التحكم والعدادات والتنبيهات
function renderDashboard() {
  document.getElementById('stat-sales').innerText = getSalesTotal().toFixed(2) + " " + t('currency');
  document.getElementById('stat-purchases').innerText = getPurchasesTotal().toFixed(2) + " " + t('currency');
  document.getElementById('stat-inventory-value').innerText = getInventoryTotalValue().toFixed(2) + " " + t('currency');
  document.getElementById('stat-receivables').innerText = getReceivablesTotal().toFixed(2) + " " + t('currency');

  // استخراج التنبيهات
  let stockAlertsHtml = "";
  let stockAlertsCount = 0;
  
  let expiryAlertsHtml = "";
  let expiryAlertsCount = 0;
  
  const today = new Date();

  // تنبيهات المخزون
  state.products.forEach(p => {
    const currentStock = calculateProductStock(p.code);
    if (currentStock <= Number(p.reorder_limit)) {
      stockAlertsCount++;
      stockAlertsHtml += `
        <li class="alert-item warning-alert">
          <span class="alert-item-name">${p.name} <small style="color:var(--text-muted);">(${p.code})</small></span>
          <span class="alert-item-meta">${t('prod_stock_actual')}: <strong style="color:var(--warning);">${currentStock} ${p.unit}</strong> (${t('prod_reorder')}: ${p.reorder_limit})</span>
        </li>
      `;
    }

    // تنبيهات الصلاحية
    if (p.expiry) {
      const expiryDate = new Date(p.expiry);
      const diffTime = expiryDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        // منتهى الصلاحية
        expiryAlertsCount++;
        expiryAlertsHtml += `
          <li class="alert-item danger-alert">
            <span class="alert-item-name">${p.name} <small style="color:var(--text-muted);">(${p.code})</small></span>
            <span class="alert-item-meta" style="color:var(--danger); font-weight:700;">${state.currentLang === 'en' ? 'Expired since ' + Math.abs(diffDays) + ' days' : 'منتهي الصلاحية منذ ' + Math.abs(diffDays) + ' يوم'} (${p.expiry})</span>
          </li>
        `;
      } else if (diffDays <= 90) {
        // قريب الانتهاء (أقل من 3 أشهر)
        expiryAlertsCount++;
        expiryAlertsHtml += `
          <li class="alert-item warning-alert">
            <span class="alert-item-name">${p.name} <small style="color:var(--text-muted);">(${p.code})</small></span>
            <span class="alert-item-meta" style="color:var(--warning); font-weight:600;">${state.currentLang === 'en' ? 'Expires in ' + diffDays + ' days' : 'ينتهي خلال ' + diffDays + ' يوم'} (${p.expiry})</span>
          </li>
        `;
      }
    }
  });

  // تحديث شاشات تنبيه لوحة التحكم
  document.getElementById('badge-stock-alerts').innerText = stockAlertsCount + " " + t('msg_items');
  document.getElementById('list-stock-alerts').innerHTML = stockAlertsHtml || `
    <li style="padding: 20px; text-align: center; color: var(--text-muted);">
      <i class="fa-solid fa-circle-check" style="color: var(--success); font-size: 24px; margin-bottom: 8px; display: block;"></i>
      ${t('msg_stock_safe')}
    </li>`;

  document.getElementById('badge-expiry-alerts').innerText = expiryAlertsCount + " " + t('msg_items');
  document.getElementById('list-expiry-alerts').innerHTML = expiryAlertsHtml || `
    <li style="padding: 20px; text-align: center; color: var(--text-muted);">
      <i class="fa-solid fa-shield-halved" style="color: var(--success); font-size: 24px; margin-bottom: 8px; display: block;"></i>
      ${t('msg_expiry_safe')}
    </li>`;

  // آخر 5 عمليات مسجلة
  const recentTransactions = [...state.transactions].reverse().slice(0, 5);
  let recentHtml = "";
  
  recentTransactions.forEach(tx => {
    let typeBadge = "";
    let details = tx.customer || t('msg_buy_products');
    let amountColor = "var(--text-main)";

    if (tx.type === 'sales') {
      typeBadge = `<span class="badge badge-success">${t('msg_sales_badge')}</span>`;
      amountColor = "var(--success)";
    } else if (tx.type === 'sales_vaxigen') {
      typeBadge = `<span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6;">${t('msg_vaxigen_badge')}</span>`;
      amountColor = "var(--success)";
    } else if (tx.type === 'purchase') {
      typeBadge = `<span class="badge badge-warning">${t('msg_purchase_badge')}</span>`;
    } else if (tx.type === 'return') {
      typeBadge = `<span class="badge badge-danger">${t('msg_return_badge')}</span>`;
      amountColor = "var(--danger)";
    } else if (tx.type === 'payment') {
      typeBadge = `<span class="badge badge-info">${t('msg_payment_badge')}</span>`;
      details = `${t('msg_payment_collected')}${tx.customer}`;
      amountColor = "var(--secondary)";
    }

    const value = tx.type === 'payment' ? tx.amount : tx.total;

    recentHtml += `
      <tr>
        <td><strong>#${tx.id}</strong></td>
        <td>${typeBadge}</td>
        <td>${details}</td>
        <td>${tx.date}</td>
        <td><strong style="color: ${amountColor};">${Number(value).toFixed(2)} ${t('currency')}</strong></td>
      </tr>
    `;
  });

  document.getElementById('list-recent-transactions').innerHTML = recentHtml || `
    <tr>
      <td colspan="5" style="text-align: center; padding: 30px; color: var(--text-muted);">
        ${t('msg_no_tx')}
      </td>
    </tr>
  `;

  // === حساب وتحليل المبيعات الجغرافية حسب المناطق ===
  const regionsList = state.regions || ['الغربية', 'الوسطى', 'الجنوبية', 'الشرقية'];
  const regionSales = {};
  regionsList.forEach(r => {
    regionSales[r] = 0;
  });
  let totalSalesVal = 0;

  // احتساب مبيعات كل منطقة بالمرور على الفواتير المكتملة
  state.transactions.forEach(t => {
    if (t.type === 'sales' || t.type === 'sales_vaxigen') {
      const customer = state.customers.find(c => c.name === t.customer);
      const region = customer ? customer.region : regionsList[0]; // افتراضي لأول منطقة
      if (regionSales[region] === undefined) {
        regionSales[region] = 0;
      }
      regionSales[region] += Number(t.total) || 0;
      totalSalesVal += Number(t.total) || 0;
    }
  });

  // درجات الألوان الفاخرة لكل منطقة
  const defaultColors = ['#10b981', '#e0a96d', '#06b6d4', '#3b82f6', '#ec4899', '#8b5cf6', '#f59e0b', '#ef4444'];
  const regionColors = {};
  regionsList.forEach((reg, idx) => {
    regionColors[reg] = defaultColors[idx % defaultColors.length];
  });

  // رسم المخطط الدائري التفاعلي باستخدام SVG
  // نصف قطر الدائرة 40، المحيط التقريبي هو 251.3
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  let accumulatedPercent = 0;
  let svgCircles = "";

  const lang = state.currentLang || 'ar';
  const getRegionName = (reg) => reg;
  
  let listHtml = "";

  regionsList.forEach(reg => {
    const amount = regionSales[reg] || 0;
    const pct = totalSalesVal > 0 ? (amount / totalSalesVal) * 100 : 0;
    const color = regionColors[reg] || '#71717a';
    
    // بناء أجزاء الدائرة SVG
    if (pct > 0) {
      const strokeOffset = circ - (circ * pct) / 100;
      const rotation = -90 + (accumulatedPercent / 100) * 360;
      svgCircles += `
        <circle cx="70" cy="70" r="${radius}" fill="none" stroke="${color}" stroke-width="12" 
                stroke-dasharray="${circ}" stroke-dashoffset="${strokeOffset}" 
                transform="rotate(${rotation} 70 70)" stroke-linecap="round" 
                style="transition: stroke-dashoffset 0.5s ease-out; cursor: pointer;"
                title="${getRegionName(reg)}: ${pct.toFixed(1)}%"/>
      `;
      accumulatedPercent += pct;
    }

    // بناء قائمة النسب الجانبية مع أشرطة التقدم الملونة
    listHtml += `
      <div class="region-row" style="font-size: 13px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span>
            <i class="fa-solid fa-circle" style="color: ${color}; font-size: 8px; margin-left: 6px;"></i>
            <strong>${getRegionName(reg)}</strong>
          </span>
          <span style="color: var(--text-muted); font-size:11px;">
            <strong>${pct.toFixed(1)}%</strong> (${amount.toFixed(0)} ${t('currency')})
          </span>
        </div>
        <div style="width: 100%; height: 6px; background: rgba(256, 256, 256, 0.05); border-radius: 10px; overflow: hidden;">
          <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 10px; transition: width 0.5s;"></div>
        </div>
      </div>
    `;
  });

  // إذا لم يكن هناك مبيعات بعد، يتم رسم حلقة رمادية أنيقة
  if (totalSalesVal === 0) {
    svgCircles = `<circle cx="70" cy="70" r="${radius}" fill="none" stroke="rgba(256,256,256,0.06)" stroke-width="12"/>`;
  }

  // صياغة وعرض الرقم الإجمالي بشكل مصغر وأنيق
  const compactSalesStr = totalSalesVal >= 1000 ? (totalSalesVal / 1000).toFixed(1) + "k" : totalSalesVal.toFixed(0);
  const chartHtml = `
    <svg width="140" height="140" viewBox="0 0 140 140" style="display:block;">
      ${svgCircles}
      <!-- نصوص مركز المخطط لعرض الإجمالي -->
      <text x="70" y="66" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-muted)">${t('sales')}</text>
      <text x="70" y="82" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">${compactSalesStr} ${t('currency')}</text>
    </svg>
  `;

  document.getElementById('region-chart-wrapper').innerHTML = chartHtml;
  document.getElementById('region-sales-list').innerHTML = listHtml;

  // === حساب وتحليل أعلى 5 أصناف مبيعاً ===
  const productSalesMap = {};
  state.products.forEach(p => {
    productSalesMap[p.code] = {
      code: p.code,
      name: p.name,
      qty: 0,
      value: 0,
      unit: p.unit || "حبة"
    };
  });

  state.transactions.forEach(t => {
    if (t.type === 'sales' || t.type === 'sales_vaxigen') {
      const subtotal = Number(t.subtotal) || 1;
      const discount = Number(t.discount) || 0;
      const discountRatio = discount / subtotal;
      
      t.items.forEach(item => {
        if (productSalesMap[item.code]) {
          const qty = Number(item.qty) || 0;
          const price = Number(item.price) || 0;
          const itemSubtotal = qty * price;
          const itemDiscount = itemSubtotal * discountRatio;
          const itemNet = Math.max(0, itemSubtotal - itemDiscount);

          productSalesMap[item.code].qty += qty;
          productSalesMap[item.code].value += itemNet;
        }
      });
    }
  });

  const topProducts = Object.values(productSalesMap)
    .filter(p => p.qty > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  let topProductsHtml = "";
  topProducts.forEach((p, index) => {
    const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#10b981', '#3b82f6'];
    const rankColor = medalColors[index] || 'var(--text-muted)';
    topProductsHtml += `
      <li class="alert-item" style="border-right: 4px solid ${rankColor}; background: rgba(256,256,256,0.02); margin-bottom: 8px; border-radius: 6px; padding: 10px 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; color: #fff;">
            <span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: ${rankColor}; color: #000; text-align: center; line-height: 20px; font-size: 11px; margin-left: 8px;">${index + 1}</span>
            ${p.name} <small style="color:var(--text-muted); font-weight: normal;">(${p.code})</small>
          </span>
          <span style="text-align: left;">
            <strong style="color: var(--success); display: block; font-size: 13px;">${p.value.toFixed(0)} ر.س</strong>
            <small style="color: var(--text-muted); font-size: 11px;">الكمية: ${p.qty} ${p.unit}</small>
          </span>
        </div>
      </li>
    `;
  });

  if (topProductsHtml === "") {
    topProductsHtml = `
      <li style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
        لا توجد مبيعات مسجلة لعرض الأصناف الأكثر مبيعاً بعد.
      </li>
    `;
  }
  document.getElementById('list-top-products').innerHTML = topProductsHtml;

  // === حساب وتحليل أعلى 5 عملاء سحباً ===
  const customerSalesMap = {};
  state.customers.forEach(c => {
    customerSalesMap[c.name] = {
      name: c.name,
      region: c.region || "الغربية",
      value: 0,
      invoicesCount: 0
    };
  });

  state.transactions.forEach(t => {
    if (t.type === 'sales' || t.type === 'sales_vaxigen') {
      if (customerSalesMap[t.customer]) {
        const subtotal = Number(t.subtotal) || 0;
        const discount = Number(t.discount) || 0;
        const netValue = Math.max(0, subtotal - discount);

        customerSalesMap[t.customer].value += netValue;
        customerSalesMap[t.customer].invoicesCount++;
      }
    }
  });

  const topCustomers = Object.values(customerSalesMap)
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  let topCustomersHtml = "";
  topCustomers.forEach((c, index) => {
    const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#10b981', '#3b82f6'];
    const rankColor = medalColors[index] || 'var(--text-muted)';
    
    topCustomersHtml += `
      <li class="alert-item" style="border-right: 4px solid ${rankColor}; background: rgba(256,256,256,0.02); margin-bottom: 8px; border-radius: 6px; padding: 10px 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; color: #fff;">
            <span style="display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: ${rankColor}; color: #000; text-align: center; line-height: 20px; font-size: 11px; margin-left: 8px;">${index + 1}</span>
            ${c.name} <small style="color:var(--text-muted); font-weight: normal;">(${c.region})</small>
          </span>
          <span style="text-align: left;">
            <strong style="color: var(--accent); display: block; font-size: 13px;">${c.value.toFixed(0)} ر.س</strong>
            <small style="color: var(--text-muted); font-size: 11px;">${c.invoicesCount} فواتير مبيعات</small>
          </span>
        </div>
      </li>
    `;
  });

  if (topCustomersHtml === "") {
    topCustomersHtml = `
      <li style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
        لا توجد فواتير مبيعات مسجلة لعرض كبار العملاء بعد.
      </li>
    `;
  }
  document.getElementById('list-top-customers').innerHTML = topCustomersHtml;
}


// ب. بناء جدول المنتجات في شاشة المخازن
function renderProductTable() {
  const searchVal = document.getElementById('search-product').value.toLowerCase();
  const categoryVal = document.getElementById('filter-category').value;
  const statusVal = document.getElementById('filter-stock-status').value;
  const tbody = document.getElementById('product-table-body');
  
  let html = "";
  const today = new Date();

  state.products.forEach((p, idx) => {
    const currentStock = calculateProductStock(p.code);
    const isLow = currentStock <= Number(p.reorder_limit);
    
    // التحقق من الصلاحية
    let isExpired = false;
    let isExpiringSoon = false;
    if (p.expiry) {
      const exp = new Date(p.expiry);
      const diff = exp - today;
      const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (diffDays < 0) isExpired = true;
      else if (diffDays <= 90) isExpiringSoon = true;
    }

    // تطبيق الفلاتر والبحث
    const matchesSearch = p.name.toLowerCase().includes(searchVal) || p.code.includes(searchVal);
    const matchesCategory = categoryVal === 'all' || p.category === categoryVal;
    
    let matchesStatus = true;
    if (statusVal === 'low') matchesStatus = isLow;
    else if (statusVal === 'expired') matchesStatus = isExpired;
    else if (statusVal === 'normal') matchesStatus = !isLow && !isExpired;

    if (matchesSearch && matchesCategory && matchesStatus) {
      // بناء شارة حالة المخزون
      let stockBadge = `<span class="badge badge-success">${currentStock} ${p.unit}</span>`;
      if (currentStock === 0) {
        stockBadge = `<span class="badge badge-danger">${t('prod_status_out_of_stock')}</span>`;
      } else if (isLow) {
        stockBadge = `<span class="badge badge-warning">${currentStock} ${p.unit} (${t('prod_status_low')})</span>`;
      }

      // شارة الصلاحية
      let expiryBadge = `<span style="color:var(--text-main);">${p.expiry || '--'}</span>`;
      if (isExpired) {
        expiryBadge = `<span class="badge badge-danger">${t('prod_status_expired')} (${p.expiry})</span>`;
      } else if (isExpiringSoon) {
        expiryBadge = `<span class="badge badge-warning">${t('prod_status_expiring_soon')} (${p.expiry})</span>`;
      }

      html += `
        <tr>
          <td><strong>${p.code}</strong></td>
          <td><span style="font-weight:600; color:#fff;">${p.name}</span></td>
          <td><span style="font-size:12px; color:var(--text-muted);">${p.category}</span></td>
          <td>${p.unit}</td>
          <td>${p.initial_stock}</td>
          <td>${stockBadge}</td>
          <td>${p.reorder_limit}</td>
          <td>${expiryBadge}</td>
          <td><strong>${Number(p.price_sell).toFixed(2)}</strong></td>
          <td class="no-print">
            <button class="btn btn-secondary btn-sm" onclick="openProductModal(${idx})" style="padding: 6px 12px; font-size:12px;">
              <i class="fa-solid fa-pen-to-square"></i> ${t('prod_btn_edit')}
            </button>
          </td>
        </tr>
      `;
    }
  });

  tbody.innerHTML = html || `
    <tr>
      <td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">
        ${t('prod_no_match')}
      </td>
    </tr>
  `;
}

// ت. بناء جدول العملاء في شاشة العملاء والحسابات
function renderCustomerTable() {
  const searchVal = document.getElementById('search-customer').value.toLowerCase();
  const regionVal = document.getElementById('filter-region').value;
  const tbody = document.getElementById('customer-table-body');
  
  let html = "";

  state.customers.forEach((c, idx) => {
    const currentBalance = calculateCustomerBalance(c.name);
    
    const matchesSearch = c.name.toLowerCase().includes(searchVal) || (c.phone && c.phone.includes(searchVal));
    const matchesRegion = regionVal === 'all' || c.region === regionVal;

    if (matchesSearch && matchesRegion) {
      const balanceColor = currentBalance > 0 ? "var(--danger)" : (currentBalance < 0 ? "var(--success)" : "var(--text-muted)");
      const balanceText = currentBalance > 0 
        ? `${currentBalance.toFixed(2)} ${t('currency')} (${t('cust_debit')})` 
        : (currentBalance < 0 
          ? `${Math.abs(currentBalance).toFixed(2)} ${t('currency')} (${t('cust_credit')})` 
          : t('cust_settled'));

      html += `
        <tr>
          <td><span style="font-weight:600; color:#fff; font-size:15px;">${c.name}</span></td>
          <td><span class="badge badge-info"><i class="fa-solid fa-map-location-dot"></i> ${c.region}</span></td>
          <td>${c.phone || '--'}</td>
          <td>${c.credit_days !== undefined ? c.credit_days : 30} يوم</td>
          <td>${Number(c.initial_balance).toFixed(2)} ${t('currency')}</td>
          <td><strong style="color:${balanceColor};">${balanceText}</strong></td>
          <td class="no-print" style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="openCustomerModal(${idx})" style="padding: 6px 12px; font-size:12px;">
              <i class="fa-solid fa-user-pen"></i> ${t('cust_btn_edit_balance')}
            </button>
            <button class="btn btn-primary btn-sm" onclick="quickPaymentForCustomer('${c.name}')" style="padding: 6px 12px; font-size:12px;">
              <i class="fa-solid fa-hand-holding-dollar"></i> ${t('cust_btn_collect_payment')}
            </button>
          </td>
        </tr>
      `;
    }
  });

  tbody.innerHTML = html || `
    <tr>
      <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
        ${t('cust_no_match')}
      </td>
    </tr>
  `;
}

// ث. شحن قوائم الاختيار (Select option lists) في الفواتير والعمليات
function populateInvoiceSelects() {
  const partySelect = document.getElementById('inv-party');
  let customerOptions = `<option value=''>${t('select_customer_placeholder')}</option>`;
  
  // شحن العملاء
  state.customers.forEach(c => {
    customerOptions += `<option value="${c.name}">${c.name}</option>`;
  });
  
  partySelect.innerHTML = customerOptions;
  
  // تصفير خانة المنطقة تلقائياً
  const regionInput = document.getElementById('inv-region');
  if (regionInput) regionInput.value = "";
}

// دالة لتحديث المنطقة الجغرافية للعميل ديناميكياً عند اختياره
function handleInvoicePartyChange() {
  const partySelect = document.getElementById('inv-party');
  const regionInput = document.getElementById('inv-region');
  if (!partySelect || !regionInput) return;
  
  const selectedName = partySelect.value;
  const customer = state.customers.find(c => c.name === selectedName);
  
  if (customer) {
    regionInput.value = customer.region;
  } else {
    regionInput.value = "";
  }
}

// ج. شحن قوائم الاختيار لكشف حساب العملاء
function populateLedgerCustomerSelect() {
  const select = document.getElementById('ledger-customer-select');
  let html = `<option value=''>${t('select_ledger_customer_placeholder')}</option>`;
  
  state.customers.forEach(c => {
    html += `<option value="${c.name}">${c.name} [${t('select_ledger_region')}: ${c.region}]</option>`;
  });
  
  select.innerHTML = html;
}

// ================= 4. منطق فواتير المبيعات والمشتريات والمرتجع وسندات القبض =================

// التحكم بنوع الفاتورة وتغيير الخيارات
function handleInvoiceTypeChange(isEditing = false) {
  const type = document.getElementById('inv-type').value;
  const numDisplay = document.getElementById('inv-number-display');
  const numDisplayGroup = document.getElementById('inv-number-display-group');
  const itemsWrapper = document.getElementById('invoice-items-wrapper');
  const paymentWrapper = document.getElementById('payment-details-wrapper');
  const pricingSummary = document.getElementById('invoice-pricing-summary');
  const partyLabel = document.getElementById('inv-party-label');
  
  // تحديث وعرض المنطقة الجغرافية بناءً على نوع العملية
  const regionInput = document.getElementById('inv-region');
  if (regionInput) {
    if (type === 'purchase') {
      regionInput.value = "شراء من مورد (لا ينطبق)";
    } else {
      handleInvoicePartyChange(); // تحديث فوري للمنطقة للعميل المختار
    }
  }

  if (type === 'payment') {
    // إخفاء المخزن وعرض السند
    itemsWrapper.style.display = 'none';
    paymentWrapper.style.display = 'block';
    pricingSummary.style.display = 'none';
    numDisplayGroup.style.display = 'block';
    numDisplay.value = (state.prefixPayment || "P-") + state.nextPaymentNum;
    partyLabel.innerText = "العميل المستلم منه";
  } else {
    // فواتير
    itemsWrapper.style.display = 'block';
    paymentWrapper.style.display = 'none';
    pricingSummary.style.display = 'block';
    numDisplayGroup.style.display = 'block';
    partyLabel.innerText = type === 'purchase' ? "المورد / تفاصيل الشراء" : "العميل";
    
    if (type === 'sales') {
      numDisplay.value = (state.prefixSales || "S-") + state.nextSalesInvoiceNum;
    } else if (type === 'sales_vaxigen') {
      numDisplay.value = (state.prefixVaxigen || "V-") + state.nextVaxigenSalesInvoiceNum;
    } else if (type === 'purchase') {
      numDisplay.value = (state.prefixPurchase || "B-") + state.nextPurchaseInvoiceNum;
    } else if (type === 'return') {
      numDisplay.value = (state.prefixReturn || "R-") + state.nextReturnInvoiceNum;
    }
    
    if (!isEditing) {
      // إعادة بناء الأسطر بإنشاء سطر فارغ فقط إذا لم نكن في وضع التحرير
      document.getElementById('invoice-items-body').innerHTML = "";
      addInvoiceItemRow();
    }
  }
  calculateInvoiceTotals();
}

// إضافة سطر جديد للفاتورة
function addInvoiceItemRow() {
  const tbody = document.getElementById('invoice-items-body');
  
  // بناء قائمة اختيار الأصناف
  let productOptions = "<option value=''>-- اختر الصنف البيطري --</option>";
  state.products.forEach(p => {
    productOptions += `<option value="${p.code}" data-sell="${p.price_sell}" data-buy="${p.price_buy}" data-expiry="${p.expiry || ''}">${p.name} (${p.code})</option>`;
  });

  const tr = document.createElement('tr');
  tr.className = 'invoice-item-row';
  tr.innerHTML = `
    <td>
      <select class="form-control row-product-select" onchange="handleRowProductSelect(this)" required>
        ${productOptions}
      </select>
    </td>
    <td>
      <input type="number" step="0.01" class="form-control row-price-input" oninput="calculateInvoiceTotals()" required min="0" value="0">
    </td>
    <td>
      <input type="number" class="form-control row-qty-input" oninput="calculateInvoiceTotals()" required min="1" value="1">
    </td>
    <td>
      <input type="date" class="form-control row-expiry-input" required>
    </td>
    <td>
      <span class="row-total-display" style="font-weight:700; color:var(--success);">0.00 ر.س</span>
    </td>
    <td style="text-align: center;">
      <button type="button" class="btn btn-danger btn-sm" onclick="removeInvoiceItemRow(this)" style="padding:6px 10px;">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </td>
  `;
  
  tbody.appendChild(tr);
  calculateInvoiceTotals();
}

// إزالة سطر من الفاتورة
function removeInvoiceItemRow(button) {
  const row = button.closest('tr');
  row.remove();
  
  // إذا فرغ الجدول تماماً، نضعه فارغاً بسطر جديد
  if (document.querySelectorAll('.invoice-item-row').length === 0) {
    addInvoiceItemRow();
  }
  calculateInvoiceTotals();
}

// معالجة اختيار الصنف وتعبئة الحقول تلقائياً
function handleRowProductSelect(selectElement) {
  const row = selectElement.closest('tr');
  const type = document.getElementById('inv-type').value;
  
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  if (!selectedOption || selectElement.value === '') return;
  
  const sellPrice = selectedOption.getAttribute('data-sell');
  const buyPrice = selectedOption.getAttribute('data-buy');
  const expiry = selectedOption.getAttribute('data-expiry');
  
  // شحن الحقول بناءً على العملية
  const priceInput = row.querySelector('.row-price-input');
  priceInput.value = type === 'purchase' ? buyPrice : sellPrice;
  
  const expiryInput = row.querySelector('.row-expiry-input');
  expiryInput.value = expiry || "";
  
  calculateInvoiceTotals();
}

// حساب مجاميع الفاتورة بالكامل
function calculateInvoiceTotals() {
  const type = document.getElementById('inv-type').value;
  
  if (type === 'payment') {
    const payAmount = Number(document.getElementById('pay-amount').value) || 0;
    document.getElementById('inv-total').innerText = payAmount.toFixed(2) + " ر.س";
    return;
  }
  
  let subtotal = 0;
  const rows = document.querySelectorAll('.invoice-item-row');
  
  rows.forEach(row => {
    const price = Number(row.querySelector('.row-price-input').value) || 0;
    const qty = Number(row.querySelector('.row-qty-input').value) || 0;
    const rowTotal = price * qty;
    subtotal += rowTotal;
    
    // تحديث خلية إجمالي الصنف النشط لهذا السطر لحظياً
    const rowTotalDisplay = row.querySelector('.row-total-display');
    if (rowTotalDisplay) {
      rowTotalDisplay.innerText = rowTotal.toFixed(2) + " ر.س";
    }
  });
  
  const discount = Number(document.getElementById('inv-discount').value) || 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  
  // ضريبة القيمة المضافة 15%
  const vatActive = document.getElementById('inv-vat-toggle').checked;
  const vatAmount = vatActive ? afterDiscount * 0.15 : 0;
  
  const grandTotal = afterDiscount + vatAmount;
  
  // حقن القيم الفرعية والإجمالية
  document.getElementById('inv-subtotal').innerText = subtotal.toFixed(2) + " ر.س";
  document.getElementById('inv-vat-amount').innerText = vatAmount.toFixed(2) + " ر.س";
  document.getElementById('inv-total').innerText = grandTotal.toFixed(2) + " ر.س";
}

// حفظ وترحيل المعاملة (Invoice / Payment)
function saveInvoiceTransaction() {
  const type = document.getElementById('inv-type').value;
  const party = document.getElementById('inv-party').value;
  const dateInput = document.getElementById('inv-date').value;
  const editingId = document.getElementById('editing-tx-id').value;
  
  if (!dateInput) {
    alert("برجاء تحديد تاريخ الفاتورة / المعاملة أولاً.");
    return;
  }
  
  if (type === 'payment') {
    // معالجة سند القبض المالي
    const amount = Number(document.getElementById('pay-amount').value) || 0;
    const notes = document.getElementById('pay-notes').value || "سند قبض نقدي";
    
    if (amount <= 0) {
      alert("برجاء إدخال مبلغ مالي صحيح في سند القبض.");
      return;
    }

    if (editingId) {
      // تعديل سند قبض قائم
      const txIndex = state.transactions.findIndex(t => t.id === editingId);
      if (txIndex === -1) {
        alert("خطأ: تعذر العثور على السند الأصلي لتعديله.");
        return;
      }
      state.transactions[txIndex] = {
        id: editingId,
        type: 'payment',
        customer: party,
        date: dateInput,
        amount: amount,
        notes: notes
      };
      saveState();
      alert(`تم تعديل وحفظ سند القبض رقم ${editingId} بنجاح!`);
    } else {
      // تسجيل سند قبض جديد
      const payId = state.nextPaymentNum;
      const paymentIdStr = (state.prefixPayment || "P-") + payId;
      const transaction = {
        id: paymentIdStr,
        type: 'payment',
        customer: party,
        date: dateInput,
        amount: amount,
        notes: notes
      };
      state.transactions.push(transaction);
      state.nextPaymentNum++;
      saveState();
      alert(`تم ترحيل سند القبض رقم ${paymentIdStr} بنجاح، وخصم المبلغ من مديونية العميل!`);
    }
    
    // إعادة تهيئة النموذج والخروج
    resetInvoiceFormState();
    refreshAllViews();
    switchSection('dashboard');
  } else {
    // معالجة الفواتير (مبيعات، مشتريات، مرتجع)
    const rows = document.querySelectorAll('.invoice-item-row');
    const items = [];
    let valid = true;
    
    rows.forEach(row => {
      const prodSelect = row.querySelector('.row-product-select');
      const prodCode = prodSelect.value;
      const price = Number(row.querySelector('.row-price-input').value) || 0;
      const qty = Number(row.querySelector('.row-qty-input').value) || 0;
      const expiry = row.querySelector('.row-expiry-input').value;
      
      if (!prodCode) {
        valid = false;
        return;
      }
      
      const prodName = prodSelect.options[prodSelect.selectedIndex].text.split(" (")[0];
      
      // إذا كانت فاتورة مبيعات، نتحقق من توفر المخزون الكافي
      // عند التعديل، يجب عدم احتساب كمية الفاتورة الحالية المعلقة ضمن النواقص
      if (type === 'sales' || type === 'sales_vaxigen') {
        let availableStock = calculateProductStock(prodCode);
        
        // إذا كنا نقوم بالتعديل، نضيف كمية الصنف القديمة المعلقة في نفس الفاتورة للمخازن مؤقتاً للتأكد من حساب المخزون بدقة
        if (editingId) {
          const oldTx = state.transactions.find(t => t.id === editingId);
          if (oldTx && (oldTx.type === 'sales' || oldTx.type === 'sales_vaxigen')) {
            const oldItem = oldTx.items.find(i => i.code === prodCode);
            if (oldItem) {
              availableStock += Number(oldItem.qty) || 0;
            }
          }
        }
        
        if (qty > availableStock) {
          alert(`كمية المبيعات المطلوبة (${qty}) للصنف [${prodName}] تتجاوز المتوفر في المخازن حالياً (${availableStock})!`);
          valid = false;
          return;
        }
      }
      
      items.push({
        code: prodCode,
        name: prodName,
        price: price,
        qty: qty,
        expiry: expiry
      });
    });
    
    if (!valid || items.length === 0) {
      if (items.length === 0) alert("برجاء إضافة عنصر واحد على الأقل للفاتورة.");
      return;
    }
    
    // الحسابات النهائية
    let subtotal = 0;
    items.forEach(i => subtotal += i.price * i.qty);
    
    const discount = Number(document.getElementById('inv-discount').value) || 0;
    const afterDiscount = Math.max(0, subtotal - discount);
    const vatActive = document.getElementById('inv-vat-toggle').checked;
    const vatAmount = vatActive ? afterDiscount * 0.15 : 0;
    const grandTotal = afterDiscount + vatAmount;
    
    if (editingId) {
      // تعديل فاتورة قائمة
      const txIndex = state.transactions.findIndex(t => t.id === editingId);
      if (txIndex === -1) {
        alert("خطأ: تعذر العثور على الفاتورة الأصلية لتعديلها.");
        return;
      }
      state.transactions[txIndex] = {
        id: editingId,
        type: type,
        customer: party,
        date: dateInput,
        items: items,
        subtotal: subtotal,
        discount: discount,
        vat_active: vatActive,
        vat_amount: vatAmount,
        total: grandTotal
      };
      saveState();
      alert(`تم تعديل وحفظ الفاتورة رقم ${editingId} بنجاح!`);
    } else {
      // تسجيل فاتورة جديدة تماماً
      let invId = "";
      if (type === 'sales') {
        invId = (state.prefixSales || "S-") + state.nextSalesInvoiceNum;
        state.nextSalesInvoiceNum++;
      } else if (type === 'sales_vaxigen') {
        invId = (state.prefixVaxigen || "V-") + state.nextVaxigenSalesInvoiceNum;
        state.nextVaxigenSalesInvoiceNum++;
      } else if (type === 'purchase') {
        invId = (state.prefixPurchase || "B-") + state.nextPurchaseInvoiceNum;
        state.nextPurchaseInvoiceNum++;
      } else if (type === 'return') {
        invId = (state.prefixReturn || "R-") + state.nextReturnInvoiceNum;
        state.nextReturnInvoiceNum++;
      }
      
      const invoice = {
        id: invId,
        type: type,
        customer: party,
        date: dateInput,
        items: items,
        subtotal: subtotal,
        discount: discount,
        vat_active: vatActive,
        vat_amount: vatAmount,
        total: grandTotal
      };
      
      state.transactions.push(invoice);
      saveState();
      alert(`تم حفظ وترحيل الفاتورة بنجاح برقم: ${invId}`);
    }
    
    // تصفير وتهيئة وضع التعديل والخروج
    resetInvoiceFormState();
    refreshAllViews();
    switchSection('dashboard');
  }
}

// دالة لمسح التخزين وإلغاء وضع التعديل للفاتورة
function resetInvoiceFormState() {
  document.getElementById('editing-tx-id').value = "";
  document.getElementById('btn-save-invoice').innerHTML = '<i class="fa-solid fa-circle-check"></i> حفظ وترحيل المعاملة';
  document.getElementById('inv-number-label').innerText = "رقم الفاتورة القادم";
  document.getElementById('inv-discount').value = 0;
  
  handleInvoiceTypeChange();
}

// ترحيل قبض سريع للعميل من قائمة العملاء
function quickPaymentForCustomer(customerName) {
  switchSection('invoices');
  
  // تحديد نوع الحركة سند قبض
  document.getElementById('inv-type').value = 'payment';
  handleInvoiceTypeChange();
  
  // تحديد العميل المطلوب
  document.getElementById('inv-party').value = customerName;
  document.getElementById('pay-amount').focus();
}

// تبديل التبويبات الفرعية في صفحة الفواتير
function switchInvoiceTab(tab) {
  // إخفاء جميع محتويات التبويبات
  document.querySelectorAll('.invoice-tab-content').forEach(view => {
    view.style.display = 'none';
  });

  // تفعيل الشاشات والأزرار المقابلة
  const btnNew = document.getElementById('btn-tab-new-invoice');
  const btnLog = document.getElementById('btn-tab-log-invoice');

  if (tab === 'new') {
    document.getElementById('invoice-creator-view').style.display = 'block';
    btnNew.className = 'btn btn-primary';
    btnLog.className = 'btn btn-secondary';
  } else if (tab === 'log') {
    document.getElementById('invoice-log-view').style.display = 'block';
    btnNew.className = 'btn btn-secondary';
    btnLog.className = 'btn btn-primary';
    renderInvoiceLogTable(); // تحديث فوري لجدول العمليات التاريخي
  }
}

// بناء وعرض سجل المعاملات التاريخي بالكامل مع خيارات التحرير والحذف
function renderInvoiceLogTable() {
  const searchVal = document.getElementById('search-log').value.toLowerCase();
  const filterType = document.getElementById('filter-log-type').value;
  const tbody = document.getElementById('invoice-log-tbody');
  
  let html = "";
  // ترتيب العمليات من الأحدث للأقدم
  const reversedTransactions = [...state.transactions].reverse();

  reversedTransactions.forEach(tx => {
    // تطبيق الفلاتر والبحث
    const matchesSearch = tx.customer.toLowerCase().includes(searchVal) || tx.id.toLowerCase().includes(searchVal);
    const matchesType = filterType === 'all' || tx.type === filterType;

    if (matchesSearch && matchesType) {
      let typeBadge = "";
      let amountColor = "var(--text-main)";
      let detailsSnippet = "";
      const value = tx.type === 'payment' ? tx.amount : tx.total;

      if (tx.type === 'sales') {
        typeBadge = `<span class="badge badge-success">${translations[state.currentLang || 'ar'].msg_sales_badge || 'فاتورة مبيعات'}</span>`;
        amountColor = "var(--success)";
        detailsSnippet = tx.items.map(i => `${i.name} (${i.qty})`).join(", ");
      } else if (tx.type === 'sales_vaxigen') {
        typeBadge = `<span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6;">${translations[state.currentLang || 'ar'].msg_vaxigen_badge || 'مبيعات V'}</span>`;
        amountColor = "var(--success)";
        detailsSnippet = tx.items.map(i => `${i.name} (${i.qty})`).join(", ");
      } else if (tx.type === 'purchase') {
        typeBadge = `<span class="badge badge-warning">${translations[state.currentLang || 'ar'].msg_purchase_badge || 'فاتورة مشتريات'}</span>`;
        detailsSnippet = tx.items.map(i => `${i.name} (${i.qty})`).join(", ");
      } else if (tx.type === 'return') {
        typeBadge = `<span class="badge badge-danger">${translations[state.currentLang || 'ar'].msg_return_badge || 'فاتورة مرتجع'}</span>`;
        amountColor = "var(--danger)";
        detailsSnippet = tx.items.map(i => `${i.name} (${i.qty})`).join(", ");
      } else if (tx.type === 'payment') {
        typeBadge = `<span class="badge badge-info">${translations[state.currentLang || 'ar'].msg_payment_badge || 'سند قبض'}</span>`;
        amountColor = "var(--secondary)";
        detailsSnippet = tx.notes || translations[state.currentLang || 'ar'].payment_collected_desc || "متحصلات نقدية";
      }

      // الحد من طول تفاصيل العناصر المعروضة في سطر واحد
      if (detailsSnippet.length > 50) {
        detailsSnippet = detailsSnippet.substring(0, 47) + "...";
      }

      html += `
        <tr>
          <td><strong>#${tx.id}</strong></td>
          <td>${typeBadge}</td>
          <td><span style="font-weight:600; color:#fff;">${tx.customer}</span></td>
          <td>${tx.date}</td>
          <td><strong style="color: ${amountColor};">${Number(value).toFixed(2)} ${translations[state.currentLang || 'ar'].currency || 'ر.س'}</strong></td>
          <td><span style="font-size:12px; color:var(--text-muted);">${detailsSnippet}</span></td>
          <td class="no-print" style="text-align: center; display: flex; gap: 8px; justify-content: center;">
            <button class="btn btn-secondary btn-sm" onclick="editInvoiceTransaction('${tx.id}')" style="padding: 6px 12px; font-size: 12px;">
              <i class="fa-solid fa-file-pen"></i> ${translations[state.currentLang || 'ar'].invoice_btn_edit || 'تعديل'}
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteInvoiceTransaction('${tx.id}')" style="padding: 6px 12px; font-size: 12px;">
              <i class="fa-solid fa-trash-can"></i> ${translations[state.currentLang || 'ar'].invoice_btn_delete || 'حذف'}
            </button>
          </td>
        </tr>
      `;
    }
  });

  tbody.innerHTML = html || `
    <tr>
      <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
        ${translations[state.currentLang || 'ar'].invoice_no_match || 'لا توجد أي معاملات أو فواتير مطابقة للبحث حالياً.'}
      </td>
    </tr>
  `;
}

// دالة لتعديل فاتورة/سند قبض واسترجاعه إلى منشئ الفواتير
function editInvoiceTransaction(txId) {
  const t = state.transactions.find(x => x.id === txId);
  if (!t) {
    alert("تعذر العثور على العملية المطلوبة.");
    return;
  }

  // 1. تفعيل حقل معرف التعديل وتحديث واجهة الأزرار
  document.getElementById('editing-tx-id').value = txId;
  document.getElementById('btn-save-invoice').innerHTML = '<i class="fa-solid fa-file-pen"></i> حفظ وتحديث التعديلات';
  document.getElementById('inv-number-label').innerText = "تعديل الفاتورة رقم";
  
  // 2. شحن نوع الفاتورة وتاريخها والطرف الآخر
  document.getElementById('inv-type').value = t.type;
  handleInvoiceTypeChange(true); // استدعاء وضع التحرير بدون مسح الأسطر
  
  document.getElementById('inv-date').value = t.date;
  
  // شحن العميل وتحديث المنطقة الجغرافية
  document.getElementById('inv-party').value = t.customer;
  handleInvoicePartyChange();
  
  document.getElementById('inv-number-display').value = txId;

  // 3. شحن بقية البيانات المالية
  if (t.type === 'payment') {
    document.getElementById('pay-amount').value = t.amount;
    document.getElementById('pay-notes').value = t.notes || "";
  } else {
    // تفريغ جدول الأصناف
    const tbody = document.getElementById('invoice-items-body');
    tbody.innerHTML = "";
    
    // شحن أسطر الأصناف المفوترة
    t.items.forEach(item => {
      // بناء خيارات الصنف
      let productOptions = "<option value=''>-- اختر الصنف البيطري --</option>";
      state.products.forEach(p => {
        const isSelected = p.code === item.code ? "selected" : "";
        productOptions += `<option value="${p.code}" data-sell="${p.price_sell}" data-buy="${p.price_buy}" data-expiry="${p.expiry || ''}" ${isSelected}>${p.name} (${p.code})</option>`;
      });

      const tr = document.createElement('tr');
      tr.className = 'invoice-item-row';
      tr.innerHTML = `
        <td>
          <select class="form-control row-product-select" onchange="handleRowProductSelect(this)" required>
            ${productOptions}
          </select>
        </td>
        <td>
          <input type="number" step="0.01" class="form-control row-price-input" oninput="calculateInvoiceTotals()" required min="0" value="${item.price}">
        </td>
        <td>
          <input type="number" class="form-control row-qty-input" oninput="calculateInvoiceTotals()" required min="1" value="${item.qty}">
        </td>
        <td>
          <input type="date" class="form-control row-expiry-input" required value="${item.expiry || ''}">
        </td>
        <td>
          <span class="row-total-display" style="font-weight:700; color:var(--success);">0.00 ر.س</span>
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-danger btn-sm" onclick="removeInvoiceItemRow(this)" style="padding:6px 10px;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // شحن الخصم الإضافي والضريبة
    document.getElementById('inv-discount').value = t.discount || 0;
    document.getElementById('inv-vat-toggle').checked = t.vat_active;
  }

  // 4. إعادة احتساب الإجماليات وفتح تبويب تحرير الفاتورة
  calculateInvoiceTotals();
  switchInvoiceTab('new');
  
  // تحريك الصفحة بسلاسة للأعلى لرؤية منشئ الفواتير
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// دالة لحذف فاتورة/سند قبض بشكل نهائي وتحديث المخزون والحسابات
function deleteInvoiceTransaction(txId) {
  if (confirm(`تحذير محاسبي: هل أنت متأكد تماماً من رغبتك في حذف العملية رقم (${txId}) بشكل نهائي؟ سيتم إلغاء تأثيرها المالي على المخازن وحسابات العملاء فوراً.`)) {
    const txIndex = state.transactions.findIndex(t => t.id === txId);
    if (txIndex === -1) {
      alert("تعذر العثور على العملية المطلوب حذفها.");
      return;
    }

    state.transactions.splice(txIndex, 1);
    saveState();
    
    alert(`تم حذف المعاملة رقم ${txId} وتحديث الحسابات والمستودعات بنجاح!`);
    
    renderInvoiceLogTable(); // تحديث فوري للجدول
    refreshAllViews(); // تحديث بقية شاشات وتنبيهات التطبيق
  }
}

// ================= 5. بناء وتوليد كشف الحساب التراكمي للعميل =================

function generateCustomerLedger() {
  const custName = document.getElementById('ledger-customer-select').value;
  const startDateStr = document.getElementById('ledger-date-start').value;
  const endDateStr = document.getElementById('ledger-date-end').value;
  
  const tbody = document.getElementById('ledger-table-body');
  
  if (!custName) {
    document.getElementById('lbl-ledger-name').innerText = "--";
    document.getElementById('lbl-ledger-region').innerText = "--";
    document.getElementById('lbl-ledger-period').innerText = "--";
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">
          ${t('ledger_no_customer_selected')}
        </td>
      </tr>
    `;
    return;
  }

  const cust = state.customers.find(c => c.name === custName);
  document.getElementById('lbl-ledger-name').innerText = cust.name;
  document.getElementById('lbl-ledger-region').innerText = cust.region;
  
  let periodText = t('ledger_period_all');
  if (startDateStr && endDateStr) {
    periodText = t('ledger_period_from_to').replace('{start}', startDateStr).replace('{end}', endDateStr);
  } else if (startDateStr) {
    periodText = t('ledger_period_from').replace('{start}', startDateStr);
  } else if (endDateStr) {
    periodText = t('ledger_period_to').replace('{end}', endDateStr);
  }
  document.getElementById('lbl-ledger-period').innerText = periodText;

  // أ. تجميع العمليات المالية للعميل وتصفيتها زمنياً
  // حساب المديونيات "قبل" تاريخ البداية لمعرفة الرصيد الافتتاحي لهذه الفترة
  let prePeriodBalance = Number(cust.initial_balance) || 0;
  const inPeriodTransactions = [];
  
  const startDate = startDateStr ? new Date(startDateStr) : null;
  const endDate = endDateStr ? new Date(endDateStr) : null;

  state.transactions.forEach(tRow => {
    if (tRow.customer === custName) {
      const transDate = new Date(tRow.date);
      
      // تصنيف ما قبل الفترة
      if (startDate && transDate < startDate) {
        if (tRow.type === 'sales' || tRow.type === 'sales_vaxigen') {
          prePeriodBalance += Number(tRow.total) || 0;
        } else if (tRow.type === 'return') {
          prePeriodBalance -= Number(tRow.total) || 0;
        } else if (tRow.type === 'payment') {
          prePeriodBalance -= Number(tRow.amount) || 0;
        }
      } else {
        // فحص البقاء داخل الفترة
        if (endDate && transDate > endDate) {
          // خارج نهاية الفترة المحددة
          return;
        }
        inPeriodTransactions.push(tRow);
      }
    }
  });

  // فرز العمليات في الفترة زمنياً
  inPeriodTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  // ب. صب الأسطر في الجدول
  let runningBalance = prePeriodBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  let html = `
    <tr style="background: rgba(256,256,256,0.03); font-weight:700;">
      <td>${startDateStr || '--'}</td>
      <td style="color:var(--secondary);">${t('ledger_initial_balance_title')}</td>
      <td>--</td>
      <td>--</td>
      <td>--</td>
      <td style="direction:ltr;">${runningBalance.toFixed(2)} ${t('currency')}</td>
    </tr>
  `;

  inPeriodTransactions.forEach(tRow => {
    let debit = "";
    let credit = "";
    let description = "";

    if (tRow.type === 'sales' || tRow.type === 'sales_vaxigen') {
      debit = Number(tRow.total);
      runningBalance += debit;
      totalDebit += debit;
      description = tRow.type === 'sales_vaxigen' 
        ? t('invoice_sales_v_label') + tRow.id 
        : t('invoice_sales_label') + tRow.id;
    } else if (tRow.type === 'return') {
      credit = Number(tRow.total);
      runningBalance -= credit;
      totalCredit += credit;
      description = t('invoice_return_label') + tRow.id;
    } else if (tRow.type === 'payment') {
      credit = Number(tRow.amount);
      runningBalance -= credit;
      totalCredit += credit;
      description = t('payment_receipt_label') + (tRow.notes || t('payment_collected_desc'));
    }

    html += `
      <tr>
        <td>${tRow.date}</td>
        <td>${description}</td>
        <td><strong>#${tRow.id}</strong></td>
        <td style="color:var(--danger);">${debit ? debit.toFixed(2) : '--'}</td>
        <td style="color:var(--success);">${credit ? credit.toFixed(2) : '--'}</td>
        <td style="direction:ltr; font-weight:700;">${runningBalance.toFixed(2)} ${t('currency')}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  
  // تحديث الخلاصة السفلية
  document.getElementById('lbl-total-debit').innerText = totalDebit.toFixed(2) + " " + t('currency');
  document.getElementById('lbl-total-credit').innerText = totalCredit.toFixed(2) + " " + t('currency');
  
  const balanceColor = runningBalance > 0 ? "var(--danger)" : (runningBalance < 0 ? "var(--success)" : "var(--text-muted)");
  document.getElementById('lbl-final-balance').innerText = runningBalance.toFixed(2) + " " + t('currency');
  document.getElementById('lbl-final-balance').style.color = balanceColor;
}

// ================= 6. التحكم ببيانات ونموذج الصنف البيطري =================

function openProductModal(index = null) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('product-modal-title');
  const form = document.getElementById('product-form');
  
  form.reset();
  modal.classList.add('active');

  if (index !== null) {
    title.innerText = t('prod_modal_edit_title');
    const p = state.products[index];
    
    document.getElementById('prod-idx').value = index;
    document.getElementById('prod-code').value = p.code;
    document.getElementById('prod-code').readOnly = true; // منع تعديل الكود للأصناف الموجودة
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-category').value = p.category;
    document.getElementById('prod-unit').value = p.unit;
    document.getElementById('prod-initial-stock').value = p.initial_stock;
    document.getElementById('prod-reorder').value = p.reorder_limit;
    document.getElementById('prod-expiry').value = p.expiry || "";
    document.getElementById('prod-price-sell').value = p.price_sell || 100;
    document.getElementById('prod-price-buy').value = p.price_buy || 70;
  } else {
    title.innerText = t('prod_modal_add_title');
    document.getElementById('prod-idx').value = "";
    document.getElementById('prod-code').readOnly = false;
  }
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('active');
}

function saveProductForm(event) {
  event.preventDefault();
  
  const index = document.getElementById('prod-idx').value;
  const code = document.getElementById('prod-code').value;
  const name = document.getElementById('prod-name').value;
  const category = document.getElementById('prod-category').value;
  const unit = document.getElementById('prod-unit').value;
  const initialStock = Number(document.getElementById('prod-initial-stock').value) || 0;
  const reorder = Number(document.getElementById('prod-reorder').value) || 0;
  const expiry = document.getElementById('prod-expiry').value;
  const sellPrice = Number(document.getElementById('prod-price-sell').value) || 100;
  const buyPrice = Number(document.getElementById('prod-price-buy').value) || 70;

  if (index !== "") {
    // تعديل
    const idx = parseInt(index);
    state.products[idx] = {
      ...state.products[idx],
      name,
      category,
      unit,
      initial_stock: initialStock,
      reorder_limit: reorder,
      expiry,
      price_sell: sellPrice,
      price_buy: buyPrice
    };
    alert("تم تعديل الصنف البيطري بنجاح!");
  } else {
    // صنف جديد
    // فحص عدم تكرار الكود
    if (state.products.some(p => p.code === code)) {
      alert("تنبيه: كود الصنف هذا مستخدم مسبقاً لصنف آخر. يرجى إدخال كود فريد.");
      return;
    }
    
    state.products.push({
      code,
      name,
      category,
      unit,
      initial_stock: initialStock,
      reorder_limit: reorder,
      expiry,
      price_sell: sellPrice,
      price_buy: buyPrice
    });
    alert("تم إضافة الصنف البيطري الجديد للمستودع بنجاح!");
  }

  saveState();
  closeProductModal();
  refreshAllViews();
}

// ================= 7. التحكم ببيانات ونموذج العميل والحساب الافتتاحي =================

function openCustomerModal(index = null) {
  const modal = document.getElementById('customer-modal');
  const title = document.getElementById('customer-modal-title');
  const form = document.getElementById('customer-form');
  
  form.reset();
  populateRegionSelects();
  modal.classList.add('active');

  if (index !== null) {
    title.innerText = t('cust_modal_edit_title');
    const c = state.customers[index];
    
    document.getElementById('cust-idx').value = index;
    document.getElementById('cust-name').value = c.name;
    document.getElementById('cust-name').readOnly = false; // السماح بتعديل الاسم
    document.getElementById('cust-region').value = c.region;
    document.getElementById('cust-phone').value = c.phone || "";
    document.getElementById('cust-balance').value = c.initial_balance;
    document.getElementById('cust-email').value = c.email || "";
    document.getElementById('cust-credit-days').value = c.credit_days !== undefined ? c.credit_days : 30;
  } else {
    title.innerText = t('cust_modal_add_title');
    document.getElementById('cust-idx').value = "";
    document.getElementById('cust-name').readOnly = false;
    document.getElementById('cust-credit-days').value = 30;
  }
}

function closeCustomerModal() {
  document.getElementById('customer-modal').classList.remove('active');
}

function saveCustomerForm(event) {
  event.preventDefault();
  
  const index = document.getElementById('cust-idx').value;
  const name = document.getElementById('cust-name').value.trim();
  const region = document.getElementById('cust-region').value;
  const phone = document.getElementById('cust-phone').value;
  const initialBalance = Number(document.getElementById('cust-balance').value) || 0;
  const email = document.getElementById('cust-email').value;
  const creditDays = Number(document.getElementById('cust-credit-days').value) || 0;

  if (index !== "") {
    // تعديل عميل قائم
    const idx = parseInt(index);
    const oldName = state.customers[idx].name;
    
    if (oldName !== name) {
      // إذا تم تغيير الاسم، نتحقق أن الاسم الجديد غير مستخدم لعميل آخر
      if (state.customers.some((c, cIdx) => c.name === name && cIdx !== idx)) {
        alert("خطأ: اسم هذا العميل أو المزرعة مسجل مسبقاً لعميل آخر.");
        return;
      }
      
      // تحديث اسم العميل في كافة الفواتير والعمليات السابقة لربطها بالاسم الجديد
      state.transactions.forEach(t => {
        if (t.customer === oldName) {
          t.customer = name;
        }
      });
      console.log(`Propagated customer name change from "${oldName}" to "${name}" across transactions.`);
    }

    state.customers[idx] = {
      ...state.customers[idx],
      name,
      region,
      phone,
      initial_balance: initialBalance,
      email,
      credit_days: creditDays
    };
    alert("تم تعديل بيانات العميل وحفظها بنجاح!");
  } else {
    // عميل جديد
    if (state.customers.some(c => c.name === name)) {
      alert("اسم هذا العميل أو المزرعة مسجل مسبقاً بالبرنامج.");
      return;
    }
    
    state.customers.push({
      name,
      region,
      phone,
      initial_balance: initialBalance,
      email,
      credit_days: creditDays
    });
    alert("تم إضافة العميل الجديد بنجاح!");
  }

  saveState();
  closeCustomerModal();
  refreshAllViews();
}

// ================= 8. النسخ الاحتياطي وإدارة البيانات (Settings & Backups) =================

// تصدير كملف JSON تنزيلي للكمبيوتر
function exportDatabaseToFile() {
  const dbStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dbStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `vetstock-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// استيراد قاعدة بيانات واستبدال الحالية
function importDatabaseFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // التحقق من بنية الملف للتأكد من ملاءمته
      if (importedData.products && importedData.customers && importedData.transactions) {
        if (confirm("تحذير: هل أنت متأكد من رغبتك في استيراد هذا الملف؟ هذا الإجراء سيمسح البيانات الحالية ويستبدلها بالكامل ببيانات الملف المستورد.")) {
          state = importedData;
          saveState();
          alert("تم استيراد نسخة قاعدة البيانات واستعادة كافة الحركات والأرصدة بنجاح!");
          window.location.reload();
        }
      } else {
        alert("ملف غير صالح! هيكلية البيانات للملف المرفوع لا تتناسب مع برنامج VetStock Pro.");
      }
    } catch (err) {
      alert("خطأ في قراءة ملف الـ JSON المرفوع!");
      console.error(err);
    }
  };
  reader.readAsText(file);
}

// تصفير وإرجاع البيانات الافتراضية
function resetDatabaseToDefault() {
  if (confirm("تحذير حرج: هل أنت متأكد تماماً من رغبتك بمسح كافة المعاملات وفواتير المبيعات الجارية، وإرجاع الأرصدة الافتتاحية للأصناف والعملاء إلى حالتهم الافتراضية الأولى؟")) {
    localStorage.removeItem('vet_stock_pro_db');
    alert("تم حذف البيانات بنجاح، سيقوم التطبيق بإعادة التحميل للبدء ببيانات Excel الافتراضية.");
    window.location.reload();
  }
}

// تعبئة حقول تعديل الترقيم بالقيم الحالية
function populateNumberingInputs() {
  const salesInput = document.getElementById('setting-next-sales');
  const vaxigenInput = document.getElementById('setting-next-vaxigen');
  const purchaseInput = document.getElementById('setting-next-purchase');
  const returnInput = document.getElementById('setting-next-return');
  const paymentInput = document.getElementById('setting-next-payment');

  const prefixSalesInput = document.getElementById('setting-prefix-sales');
  const prefixVaxigenInput = document.getElementById('setting-prefix-vaxigen');
  const prefixPurchaseInput = document.getElementById('setting-prefix-purchase');
  const prefixReturnInput = document.getElementById('setting-prefix-return');
  const prefixPaymentInput = document.getElementById('setting-prefix-payment');

  if (salesInput) salesInput.value = state.nextSalesInvoiceNum || 78;
  if (vaxigenInput) vaxigenInput.value = state.nextVaxigenSalesInvoiceNum || 1;
  if (purchaseInput) purchaseInput.value = state.nextPurchaseInvoiceNum || 1;
  if (returnInput) returnInput.value = state.nextReturnInvoiceNum || 1;
  if (paymentInput) paymentInput.value = state.nextPaymentNum || 1;

  if (prefixSalesInput) prefixSalesInput.value = state.prefixSales || 'S-';
  if (prefixVaxigenInput) prefixVaxigenInput.value = state.prefixVaxigen || 'V-';
  if (prefixPurchaseInput) prefixPurchaseInput.value = state.prefixPurchase || 'B-';
  if (prefixReturnInput) prefixReturnInput.value = state.prefixReturn || 'R-';
  if (prefixPaymentInput) prefixPaymentInput.value = state.prefixPayment || 'P-';
}

// حفظ أرقام التسلسل وأكواد البادئة المخصصة يدوياً
function saveNumberingSettings() {
  const nextSales = parseInt(document.getElementById('setting-next-sales').value);
  const nextVaxigen = parseInt(document.getElementById('setting-next-vaxigen').value);
  const nextPurchase = parseInt(document.getElementById('setting-next-purchase').value);
  const nextReturn = parseInt(document.getElementById('setting-next-return').value);
  const nextPayment = parseInt(document.getElementById('setting-next-payment').value);

  const prefixSales = document.getElementById('setting-prefix-sales').value.trim();
  const prefixVaxigen = document.getElementById('setting-prefix-vaxigen').value.trim();
  const prefixPurchase = document.getElementById('setting-prefix-purchase').value.trim();
  const prefixReturn = document.getElementById('setting-prefix-return').value.trim();
  const prefixPayment = document.getElementById('setting-prefix-payment').value.trim();

  if (isNaN(nextSales) || nextSales < 1 ||
      isNaN(nextVaxigen) || nextVaxigen < 1 ||
      isNaN(nextPurchase) || nextPurchase < 1 ||
      isNaN(nextReturn) || nextReturn < 1 ||
      isNaN(nextPayment) || nextPayment < 1) {
    alert("خطأ: يرجى إدخال أرقام صحيحة أكبر من أو تساوي 1 لكافة خانات الترقيم.");
    return;
  }

  state.nextSalesInvoiceNum = nextSales;
  state.nextVaxigenSalesInvoiceNum = nextVaxigen;
  state.nextPurchaseInvoiceNum = nextPurchase;
  state.nextReturnInvoiceNum = nextReturn;
  state.nextPaymentNum = nextPayment;

  state.prefixSales = prefixSales || 'S-';
  state.prefixVaxigen = prefixVaxigen || 'V-';
  state.prefixPurchase = prefixPurchase || 'B-';
  state.prefixReturn = prefixReturn || 'R-';
  state.prefixPayment = prefixPayment || 'P-';

  // التحقق مما إذا كان المستخدم يرغب في تطبيق المسميات والأرقام الجديدة على العمليات الحالية
  if (state.transactions && state.transactions.length > 0) {
    if (confirm("هل ترغب في إعادة ترقيم وتغيير كود تسلسل جميع الفواتير والمعاملات الحالية المسجلة بالبرنامج لتطابق الأكواد الجديدة والترتيب الزمني الجديد؟")) {
      resequenceExistingTransactions();
    }
  }

  saveState();
  alert("تم تعديل وحفظ أرقام تسلسل وأكواد الفواتير والعمليات القادمة بنجاح!");
  
  // تحديث وعرض شاشة الفواتير لتنعكس الأرقام الجديدة فوراً
  refreshAllViews();
}

// دالة لإعادة ترقيم وتسلسل الفواتير الحالية بناءً على الأكواد والبدايات الجديدة
function resequenceExistingTransactions() {
  let countSales = parseInt(document.getElementById('setting-next-sales').value) || 1;
  let countVaxigen = parseInt(document.getElementById('setting-next-vaxigen').value) || 1;
  let countPurchase = parseInt(document.getElementById('setting-next-purchase').value) || 1;
  let countReturn = parseInt(document.getElementById('setting-next-return').value) || 1;
  let countPayment = parseInt(document.getElementById('setting-next-payment').value) || 1;

  const prefixSales = document.getElementById('setting-prefix-sales').value.trim() || 'S-';
  const prefixVaxigen = document.getElementById('setting-prefix-vaxigen').value.trim() || 'V-';
  const prefixPurchase = document.getElementById('setting-prefix-purchase').value.trim() || 'B-';
  const prefixReturn = document.getElementById('setting-prefix-return').value.trim() || 'R-';
  const prefixPayment = document.getElementById('setting-prefix-payment').value.trim() || 'P-';

  // ترتيب الفواتير الحالية زمنياً من الأقدم للأحدث لضمان ترقيم متناسق مع التاريخ
  state.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  // إعادة الترقيم الفعلي لكل عملية بناءً على نوعها
  state.transactions.forEach(t => {
    if (t.type === 'sales') {
      t.id = prefixSales + countSales;
      countSales++;
    } else if (t.type === 'sales_vaxigen') {
      t.id = prefixVaxigen + countVaxigen;
      countVaxigen++;
    } else if (t.type === 'purchase') {
      t.id = prefixPurchase + countPurchase;
      countPurchase++;
    } else if (t.type === 'return') {
      t.id = prefixReturn + countReturn;
      countReturn++;
    } else if (t.type === 'payment') {
      t.id = prefixPayment + countPayment;
      countPayment++;
    }
  });

  // تحديث القيم التالية في الـ state للاستمرار من الرقم التالي
  state.nextSalesInvoiceNum = countSales;
  state.nextVaxigenSalesInvoiceNum = countVaxigen;
  state.nextPurchaseInvoiceNum = countPurchase;
  state.nextReturnInvoiceNum = countReturn;
  state.nextPaymentNum = countPayment;
}

// تعبئة حقول مسميات التطبيق والقوائم المخصصة
function populateCustomNamesInputs() {
  const appNameInput = document.getElementById('setting-app-name');
  const menuDashboardInput = document.getElementById('setting-menu-dashboard');
  const menuInvoicesInput = document.getElementById('setting-menu-invoices');
  const menuInventoryInput = document.getElementById('setting-menu-inventory');
  const menuCustomersInput = document.getElementById('setting-menu-customers');
  const menuLedgerInput = document.getElementById('setting-menu-ledger');
  const menuReportsInput = document.getElementById('setting-menu-reports');
  const menuSettingsInput = document.getElementById('setting-menu-settings');

  if (appNameInput) appNameInput.value = state.appName || 'VetStock Pro';
  
  if (state.menuNames) {
    if (menuDashboardInput) menuDashboardInput.value = state.menuNames.nav_dashboard || 'لوحة التحكم';
    if (menuInvoicesInput) menuInvoicesInput.value = state.menuNames.nav_invoices || 'الفواتير والعمليات';
    if (menuInventoryInput) menuInventoryInput.value = state.menuNames.nav_inventory || 'إدارة المخزون';
    if (menuCustomersInput) menuCustomersInput.value = state.menuNames.nav_customers || 'العملاء والحسابات';
    if (menuLedgerInput) menuLedgerInput.value = state.menuNames.nav_ledger || 'كشف الحساب';
    if (menuReportsInput) menuReportsInput.value = state.menuNames.nav_reports || 'مركز التقارير';
    if (menuSettingsInput) menuSettingsInput.value = state.menuNames.nav_settings || 'النسخ والإعدادات';
  } else {
    if (menuDashboardInput) menuDashboardInput.value = 'لوحة التحكم';
    if (menuInvoicesInput) menuInvoicesInput.value = 'الفواتير والعمليات';
    if (menuInventoryInput) menuInventoryInput.value = 'إدارة المخزون';
    if (menuCustomersInput) menuCustomersInput.value = 'العملاء والحسابات';
    if (menuLedgerInput) menuLedgerInput.value = 'كشف الحساب';
    if (menuReportsInput) menuReportsInput.value = 'مركز التقارير';
    if (menuSettingsInput) menuSettingsInput.value = 'النسخ والإعدادات';
  }
}

// حفظ المسميات المخصصة
function saveCustomNamesSettings() {
  const appName = document.getElementById('setting-app-name').value.trim();
  const menuDashboard = document.getElementById('setting-menu-dashboard').value.trim();
  const menuInvoices = document.getElementById('setting-menu-invoices').value.trim();
  const menuInventory = document.getElementById('setting-menu-inventory').value.trim();
  const menuCustomers = document.getElementById('setting-menu-customers').value.trim();
  const menuLedger = document.getElementById('setting-menu-ledger').value.trim();
  const menuReports = document.getElementById('setting-menu-reports').value.trim();
  const menuSettings = document.getElementById('setting-menu-settings').value.trim();

  if (!appName) {
    alert("خطأ: يجب إدخال اسم التطبيق الرئيسي.");
    return;
  }

  state.appName = appName;
  state.menuNames = {
    nav_dashboard: menuDashboard || 'لوحة التحكم',
    nav_invoices: menuInvoices || 'الفواتير والعمليات',
    nav_inventory: menuInventory || 'إدارة المخزون',
    nav_customers: menuCustomers || 'العملاء والحسابات',
    nav_ledger: menuLedger || 'كشف الحساب',
    nav_reports: menuReports || 'مركز التقارير',
    nav_settings: menuSettings || 'النسخ والإعدادات'
  };

  saveState();
  
  // تحديث فوري للمسميات في الصفحة بأكملها
  applyCustomNamesToDOM();
  applyLanguage(state.currentLang || 'ar');
  
  alert("تم حفظ وتطبيق المسميات الجديدة بنجاح!");
}

// دالة لتطبيق المسميات المخصصة فورا على العناصر الرئيسية بالصفحة
function applyCustomNamesToDOM() {
  // تحديث عنوان تبويب المتصفح
  document.title = state.appName || 'VetStock Pro';
  
  // تحديث النص في شعار التطبيق (Logo)
  const logoText = document.getElementById('logo-text');
  if (logoText) {
    logoText.innerText = state.appName || 'VetStock Pro';
  }
}

// تعبئة حقول اختيار المناطق جغرافياً بشكل ديناميكي
function populateRegionSelects() {
  const custRegionSelect = document.getElementById('cust-region');
  const filterRegionSelect = document.getElementById('filter-region');
  
  const regions = state.regions || ["الغربية", "الوسطى", "الجنوبية", "الشرقية"];
  
  if (custRegionSelect) {
    const currentVal = custRegionSelect.value;
    let html = "";
    regions.forEach(r => {
      html += `<option value="${r}">${r}</option>`;
    });
    custRegionSelect.innerHTML = html;
    if (currentVal && regions.includes(currentVal)) {
      custRegionSelect.value = currentVal;
    }
  }
  
  if (filterRegionSelect) {
    const currentVal = filterRegionSelect.value;
    let html = `<option value="all" data-translate="filter_region_all">كل المناطق</option>`;
    regions.forEach(r => {
      html += `<option value="${r}">${r}</option>`;
    });
    filterRegionSelect.innerHTML = html;
    filterRegionSelect.value = currentVal || "all";
  }
}

// تعبئة قائمة المناطق في صفحة الإعدادات
function populateSettingsRegionsList() {
  const wrapper = document.getElementById('settings-regions-list');
  if (!wrapper) return;
  
  const regions = state.regions || ["الغربية", "الوسطى", "الجنوبية", "الشرقية"];
  
  let html = "";
  regions.forEach(r => {
    // التحقق مما إذا كانت المنطقة مستخدمة من قبل عملاء حاليين
    const isUsed = state.customers.some(c => c.region === r);
    
    html += `
      <div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 20px; border: 1px solid var(--border-color); font-size: 13px; color: #fff;">
        <span>${r}</span>
        ${isUsed ? 
          `<span style="font-size: 10px; color: var(--text-muted);">(مستعملة)</span>` : 
          `<button onclick="deleteRegionSetting('${r}')" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 0 4px; font-size: 12px;" title="حذف المنطقة"><i class="fa-solid fa-xmark"></i></button>`
        }
      </div>
    `;
  });
  wrapper.innerHTML = html || `<span style="font-size:12px; color:var(--text-muted);">لا توجد أي مناطق مضافة حالياً.</span>`;
}

// إضافة منطقة جديدة
function addNewRegionSetting() {
  const input = document.getElementById('setting-new-region-name');
  if (!input) return;
  const name = input.value.trim();
  
  if (!name) {
    alert("برجاء إدخال اسم المنطقة أولاً.");
    return;
  }
  
  if (!state.regions) {
    state.regions = ["الغربية", "الوسطى", "الجنوبية", "الشرقية"];
  }
  
  if (state.regions.includes(name)) {
    alert("هذه المنطقة مسجلة مسبقاً في النظام.");
    return;
  }
  
  state.regions.push(name);
  saveState();
  input.value = "";
  
  populateRegionSelects();
  populateSettingsRegionsList();
  refreshAllViews();
  
  alert(`تم إضافة المنطقة الجديدة "${name}" بنجاح!`);
}

// حذف منطقة
function deleteRegionSetting(regionName) {
  if (confirm(`هل أنت متأكد من رغبتك بحذف المنطقة "${regionName}"؟`)) {
    state.regions = (state.regions || ["الغربية", "الوسطى", "الجنوبية", "الشرقية"]).filter(r => r !== regionName);
    saveState();
    
    populateRegionSelects();
    populateSettingsRegionsList();
    refreshAllViews();
    
    alert(`تم حذف المنطقة "${regionName}" بنجاح!`);
  }
}

// تعبئة قوائم الاختيار لشاشة التقارير
function populateReportSelects() {
  const custSelect = document.getElementById('report-customer-select');
  const prodSelect = document.getElementById('report-product-select');
  
  if (custSelect) {
    let custOptions = `<option value=''>${t('select_customer_placeholder')}</option>`;
    state.customers.forEach(c => {
      custOptions += `<option value="${c.name}">${c.name} (${c.region})</option>`;
    });
    custSelect.innerHTML = custOptions;
  }
  
  if (prodSelect) {
    let prodOptions = `<option value=''>${t('select_product_placeholder')}</option>`;
    state.products.forEach(p => {
      prodOptions += `<option value="${p.code}">${p.name} (${p.code})</option>`;
    });
    prodSelect.innerHTML = prodOptions;
  }
}

// تدوير وعرض الحقول عند تغيير نوع التقرير
function handleReportTypeChange() {
  const type = document.getElementById('report-type').value;
  const prodGroup = document.getElementById('report-product-group');
  const custGroup = document.getElementById('report-customer-group');
  const infoItem2 = document.getElementById('report-info-item-2');
  const dateStartGroup = document.getElementById('report-date-start-group');
  
  if (type === 'product_summary') {
    prodGroup.style.display = 'block';
    custGroup.style.display = 'none';
    if (infoItem2) infoItem2.style.display = 'none';
    if (dateStartGroup) dateStartGroup.style.display = 'block';
  } else if (type === 'customer_product_purchases') {
    prodGroup.style.display = 'block';
    custGroup.style.display = 'block';
    if (infoItem2) infoItem2.style.display = 'block';
    if (dateStartGroup) dateStartGroup.style.display = 'block';
  } else if (type === 'customer_all_purchases') {
    prodGroup.style.display = 'none';
    custGroup.style.display = 'block';
    if (infoItem2) infoItem2.style.display = 'block';
    if (dateStartGroup) dateStartGroup.style.display = 'block';
  } else if (type === 'customer_due_payments') {
    prodGroup.style.display = 'none';
    custGroup.style.display = 'none';
    if (infoItem2) infoItem2.style.display = 'none';
    if (dateStartGroup) dateStartGroup.style.display = 'none';
  }
  
  // تصفير شاشة النتائج
  document.getElementById('report-results-wrapper').style.display = 'none';
  document.getElementById('report-empty-message').style.display = 'block';
}

// توليد ومعالجة التقرير المحاسبي النشط
function generateFinancialReport() {
  const type = document.getElementById('report-type').value;
  const custName = document.getElementById('report-customer-select').value;
  const prodCode = document.getElementById('report-product-select').value;
  const startDateStr = document.getElementById('report-date-start').value;
  const endDateStr = document.getElementById('report-date-end').value;
  
  const resultsWrapper = document.getElementById('report-results-wrapper');
  const emptyMessage = document.getElementById('report-empty-message');
  
  // التحقق من صحة المدخلات
  if (type === 'product_summary' && !prodCode) {
    alert(t('rep_err_select_product'));
    return;
  }
  if (type === 'customer_product_purchases' && (!custName || !prodCode)) {
    alert(t('rep_err_select_cust_prod'));
    return;
  }
  if (type === 'customer_all_purchases' && !custName) {
    alert(t('rep_err_select_customer'));
    return;
  }
  
  // تحويل التواريخ
  const startDate = startDateStr ? new Date(startDateStr) : null;
  const endDate = endDateStr ? new Date(endDateStr) : null;
  if (endDate) endDate.setHours(23, 59, 59, 999);
  
  // إعداد ملصق تاريخ التوليد والفترة
  const now = new Date();
  document.getElementById('lbl-report-gen-date').innerText = t('rep_gen_date') + (state.currentLang === 'en' ? now.toLocaleString('en-US') : now.toLocaleString('ar-EG'));
  
  let periodText = t('rep_period_all');
  if (startDateStr && endDateStr) {
    periodText = t('rep_period_from_to').replace('{start}', startDateStr).replace('{end}', endDateStr);
  } else if (startDateStr) {
    periodText = t('rep_period_from').replace('{start}', startDateStr);
  } else if (endDateStr) {
    periodText = t('rep_period_to').replace('{end}', endDateStr);
  }
  document.getElementById('lbl-report-period').innerText = periodText;
  
  // تحديد عناصر الواجهة المعدة مسبقاً
  const targetLabel1 = document.getElementById('lbl-report-target-label-1');
  const targetVal1 = document.getElementById('lbl-report-target-val-1');
  const targetLabel2 = document.getElementById('lbl-report-target-label-2');
  const targetVal2 = document.getElementById('lbl-report-target-val-2');
  const infoItem2 = document.getElementById('report-info-item-2');
  const reportTitle = document.getElementById('lbl-report-title');
  
  const kpiContainer = document.getElementById('report-kpi-container');
  const tableHead = document.getElementById('report-table-head');
  const tableBody = document.getElementById('report-table-tbody');
  
  let kpisHtml = "";
  let thHtml = "";
  let tbodyHtml = "";
  
  // 1. تقرير حركة صنف بيطري تفصيلي
  if (type === 'product_summary') {
    const prod = state.products.find(p => p.code === prodCode);
    reportTitle.innerText = t('rep_title_prod_summary');
    targetLabel1.innerText = t('rep_label_target_prod');
    targetVal1.innerText = `${prod.name} (${prod.code})`;
    infoItem2.style.display = 'none';
    
    let totalSold = 0;
    let totalPurchased = 0;
    let totalReturned = 0;
    let totalSalesRevenue = 0;
    let movements = [];
    
    state.transactions.forEach(tRow => {
      const txDate = new Date(tRow.date);
      if (startDate && txDate < startDate) return;
      if (endDate && txDate > endDate) return;
      
      const item = tRow.items && tRow.items.find(i => i.code === prodCode);
      if (!item) return;
      
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const rowTotal = qty * price;
      
      if (tRow.type === 'sales' || tRow.type === 'sales_vaxigen') {
        totalSold += qty;
        totalSalesRevenue += rowTotal;
        movements.push({
          date: tRow.date,
          id: tRow.id,
          typeText: tRow.type === 'sales_vaxigen' ? t('msg_vaxigen_badge') : t('msg_sales_badge'),
          typeColor: "var(--success)",
          party: tRow.customer || t('msg_unknown_customer'),
          qty: `-${qty}`,
          qtyVal: -qty,
          price: price,
          total: rowTotal
        });
      } else if (tRow.type === 'purchase') {
        totalPurchased += qty;
        movements.push({
          date: tRow.date,
          id: tRow.id,
          typeText: t('msg_purchase_badge'),
          typeColor: "var(--warning)",
          party: tRow.customer || t('msg_unknown_party'),
          qty: `+${qty}`,
          qtyVal: qty,
          price: price,
          total: rowTotal
        });
      } else if (tRow.type === 'return') {
        totalReturned += qty;
        movements.push({
          date: tRow.date,
          id: tRow.id,
          typeText: t('msg_return_badge'),
          typeColor: "var(--danger)",
          party: tRow.customer || t('msg_unknown_customer'),
          qty: `+${qty}`,
          qtyVal: qty,
          price: price,
          total: rowTotal
        });
      }
    });
    
    movements.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const currentStock = calculateProductStock(prodCode);
    const stockVal = currentStock * (Number(prod.price_sell) || 0);
    const netMoved = totalPurchased + totalReturned - totalSold;
    const avgSalesPrice = totalSold > 0 ? (totalSalesRevenue / totalSold) : 0;
    
    kpisHtml = `
      <div class="alert-panel" style="border-right: 4px solid var(--success); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_total_sales_qty')}</span>
        <strong style="font-size:20px; color:#fff;">${totalSold} ${prod.unit}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--primary); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_avg_sell_price')}</span>
        <strong style="font-size:20px; color:#fff;">${avgSalesPrice.toFixed(2)} ${t('currency')}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--warning); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_total_purchases_qty')}</span>
        <strong style="font-size:20px; color:#fff;">${totalPurchased} ${prod.unit}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--danger); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_total_returns_qty')}</span>
        <strong style="font-size:20px; color:#fff;">${totalReturned} ${prod.unit}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--secondary); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_net_movement')}</span>
        <strong style="font-size:20px; color:${netMoved >= 0 ? 'var(--success)' : 'var(--danger)'};">${netMoved > 0 ? '+' : ''}${netMoved} ${prod.unit}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--accent); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_stock_value')}</span>
        <strong style="font-size:16px; color:#fff;">${currentStock} ${prod.unit} <br><small style="color:var(--accent); font-size:12px;">(${stockVal.toFixed(2)} ${t('currency')})</small></strong>
      </div>
    `;
    
    thHtml = `
      <tr>
        <th>${t('tbl_date')}</th>
        <th>${t('tbl_id')}</th>
        <th>${t('tbl_type')}</th>
        <th>${t('tbl_party')}</th>
        <th style="text-align: center;">${t('inv_qty')}</th>
        <th style="text-align: left;">${t('prod_price_sell')}</th>
        <th style="text-align: left;">${t('inv_item_total')}</th>
      </tr>
    `;
    
    if (movements.length === 0) {
      tbodyHtml = `
        <tr>
          <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
            ${t('rep_no_movement_prod')}
          </td>
        </tr>
      `;
    } else {
      movements.forEach(m => {
        tbodyHtml += `
          <tr>
            <td>${m.date}</td>
            <td><strong>${m.id}</strong></td>
            <td><span class="badge" style="background:rgba(256,256,256,0.05); color:${m.typeColor};">${m.typeText}</span></td>
            <td>${m.party}</td>
            <td style="text-align: center; font-weight:700; color:${m.qtyVal < 0 ? 'var(--success)' : 'var(--text-main)'};">${m.qty}</td>
            <td style="text-align: left; direction:ltr;">${m.price.toFixed(2)} ${t('currency')}</td>
            <td style="text-align: left; font-weight:600; direction:ltr;">${m.total.toFixed(2)} ${t('currency')}</td>
          </tr>
        `;
      });
    }
  }
  
  // 2. تقرير مسحوبات عميل معين من صنف معين
  else if (type === 'customer_product_purchases') {
    const prod = state.products.find(p => p.code === prodCode);
    reportTitle.innerText = t('rep_title_cust_prod_purchases');
    targetLabel1.innerText = t('rep_label_target_prod');
    targetVal1.innerText = `${prod.name} (${prod.code})`;
    infoItem2.style.display = 'block';
    targetLabel2.innerText = t('rep_label_target_cust');
    targetVal2.innerText = custName;
    
    let totalQty = 0;
    let totalSpendSub = 0;
    let totalSpendVat = 0;
    let totalSpendGrand = 0;
    let txCount = 0;
    let invoices = [];
    
    state.transactions.forEach(tRow => {
      if (tRow.customer !== custName) return;
      if (tRow.type !== 'sales' && tRow.type !== 'sales_vaxigen') return;
      
      const txDate = new Date(tRow.date);
      if (startDate && txDate < startDate) return;
      if (endDate && txDate > endDate) return;
      
      const item = tRow.items && tRow.items.find(i => i.code === prodCode);
      if (!item) return;
      
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const rowTotal = qty * price;
      
      // توزيع الخصم والضريبة نسبياً
      const invoiceSubtotal = Number(tRow.subtotal) || 1;
      const proportion = rowTotal / invoiceSubtotal;
      const rowDiscount = (Number(tRow.discount) || 0) * proportion;
      const rowNet = Math.max(0, rowTotal - rowDiscount);
      const rowVat = tRow.vat_active ? rowNet * 0.15 : 0;
      const rowGrand = rowNet + rowVat;
      
      totalQty += qty;
      totalSpendSub += rowNet;
      totalSpendVat += rowVat;
      totalSpendGrand += rowGrand;
      txCount++;
      
      invoices.push({
        date: tRow.date,
        id: tRow.id,
        typeText: tRow.type === 'sales_vaxigen' ? t('msg_vaxigen_badge') : t('msg_sales_badge'),
        qty: qty,
        price: price,
        discount: rowDiscount,
        vat: rowVat,
        total: rowNet
      });
    });
    
    invoices.sort((a, b) => new Date(a.date) - new Date(b.date));
    const avgPrice = totalQty > 0 ? (totalSpendSub / totalQty) : 0;
    
    kpisHtml = `
      <div class="alert-panel" style="border-right: 4px solid var(--success); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_total_purchased_qty')}</span>
        <strong style="font-size:20px; color:#fff;">${totalQty} ${prod.unit}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--secondary); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_invoices_count')}</span>
        <strong style="font-size:20px; color:#fff;">${txCount}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--warning); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_total_purchased_val')}</span>
        <strong style="font-size:20px; color:var(--warning);">${totalSpendSub.toFixed(2)} ${t('currency')}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--danger); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_vat_amount')}</span>
        <strong style="font-size:20px; color:#fff;">${totalSpendVat.toFixed(2)} ${t('currency')}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--accent); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_avg_buy_price')}</span>
        <strong style="font-size:20px; color:var(--accent);">${avgPrice.toFixed(2)} ${t('currency')}</strong>
      </div>
    `;
    
    thHtml = `
      <tr>
        <th>${t('tbl_date')}</th>
        <th>${t('tbl_id')}</th>
        <th>${t('tbl_type')}</th>
        <th style="text-align: center;">${t('inv_qty')}</th>
        <th style="text-align: left;">${t('prod_price_sell')}</th>
        <th style="text-align: left;">${t('inv_discount')}</th>
        <th style="text-align: left;">${t('inv_vat')}</th>
        <th style="text-align: left;">${t('inv_item_total')}</th>
      </tr>
    `;
    
    if (invoices.length === 0) {
      tbodyHtml = `
        <tr>
          <td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
            ${t('rep_no_movement_cust_prod')}
          </td>
        </tr>
      `;
    } else {
      invoices.forEach(inv => {
        tbodyHtml += `
          <tr>
            <td>${inv.date}</td>
            <td><strong>${inv.id}</strong></td>
            <td><span class="badge" style="background:rgba(256,256,256,0.05); color:var(--secondary);">${inv.typeText}</span></td>
            <td style="text-align: center; font-weight:700; color:var(--success);">${inv.qty}</td>
            <td style="text-align: left; direction:ltr;">${inv.price.toFixed(2)} ${t('currency')}</td>
            <td style="text-align: left; direction:ltr; color:var(--text-muted);">${inv.discount.toFixed(2)} ${t('currency')}</td>
            <td style="text-align: left; direction:ltr; color:var(--text-muted);">${inv.vat.toFixed(2)} ${t('currency')}</td>
            <td style="text-align: left; font-weight:600; direction:ltr;">${inv.total.toFixed(2)} ${t('currency')}</td>
          </tr>
        `;
      });
      
      tbodyHtml += `
        <tr style="background: rgba(16, 185, 129, 0.1); border-top: 2px solid var(--success); font-weight: 700;">
          <td colspan="3" style="text-align: center; color: var(--success);">${t('rep_total_purchases_prod_footer')}</td>
          <td style="text-align: center; color: var(--success);">${totalQty} ${prod.unit}</td>
          <td>--</td>
          <td style="text-align: left; direction: ltr; color: var(--text-muted);">${totalSpendSub.toFixed(2)} ${t('currency')}</td>
          <td style="text-align: left; direction: ltr; color: var(--text-muted);">${totalSpendVat.toFixed(2)} ${t('currency')}</td>
          <td style="text-align: left; direction: ltr; color: var(--success); font-size: 15px;">${totalSpendSub.toFixed(2)} ${t('currency')}</td>
        </tr>
      `;
    }
  }
  
  // 3. تقرير مسحوبات عميل من كافة الأصناف
  else if (type === 'customer_all_purchases') {
    reportTitle.innerText = t('rep_title_cust_all_purchases');
    targetLabel1.innerText = t('rep_label_target_cust');
    targetVal1.innerText = custName;
    infoItem2.style.display = 'none';
    
    const cust = state.customers.find(c => c.name === custName);
    
    let productSpend = {};
    let invoiceCount = 0;
    let overallSpendSub = 0;
    let overallSpendGrand = 0;
    
    state.transactions.forEach(tRow => {
      if (tRow.customer !== custName) return;
      if (tRow.type !== 'sales' && tRow.type !== 'sales_vaxigen') return;
      
      const txDate = new Date(tRow.date);
      if (startDate && txDate < startDate) return;
      if (endDate && txDate > endDate) return;
      
      invoiceCount++;
      
      const subtotal = Number(tRow.subtotal) || 1;
      const discount = Number(tRow.discount) || 0;
      const discountRatio = discount / subtotal;
      
      tRow.items.forEach(item => {
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const itemSubtotal = qty * price;
        const itemDiscount = itemSubtotal * discountRatio;
        const itemNet = Math.max(0, itemSubtotal - itemDiscount);
        const itemVat = tRow.vat_active ? itemNet * 0.15 : 0;
        const itemGrand = itemNet + itemVat;
        
        overallSpendSub += itemNet;
        overallSpendGrand += itemGrand;
        
        if (!productSpend[item.code]) {
          productSpend[item.code] = {
            code: item.code,
            qty: 0,
            spendSub: 0,
            spendGrand: 0
          };
        }
        
        productSpend[item.code].qty += qty;
        productSpend[item.code].spendSub += itemNet;
        productSpend[item.code].spendGrand += itemGrand;
      });
    });
    
    const totalDistinctItems = Object.keys(productSpend).length;
    let totalOverallQty = 0;
    Object.values(productSpend).forEach(p => totalOverallQty += p.qty);
    
    kpisHtml = `
      <div class="alert-panel" style="border-right: 4px solid var(--success); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_total_purchased_val')}</span>
        <strong style="font-size:20px; color:var(--success);">${overallSpendSub.toFixed(2)} ${t('currency')}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--secondary); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_invoices_total_period')}</span>
        <strong style="font-size:20px; color:#fff;">${invoiceCount}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--warning); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_distinct_products')}</span>
        <strong style="font-size:20px; color:#fff;">${totalDistinctItems}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--danger); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_total_quantities')}</span>
        <strong style="font-size:20px; color:#fff;">${totalOverallQty}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--accent); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">${t('rep_kpi_region')}</span>
        <strong style="font-size:20px; color:var(--accent);">${cust.region}</strong>
      </div>
    `;
    
    thHtml = `
      <tr>
        <th>${t('prod_code')}</th>
        <th>${t('prod_name')}</th>
        <th>${t('prod_category')}</th>
        <th style="text-align: center;">${t('rep_kpi_total_purchased_qty')}</th>
        <th style="text-align: left;">${t('rep_kpi_avg_buy_price')}</th>
        <th style="text-align: left;">${t('inv_subtotal')}</th>
        <th style="text-align: left;">${t('inv_item_total')}</th>
      </tr>
    `;
    
    if (totalDistinctItems === 0) {
      tbodyHtml = `
        <tr>
          <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
            ${t('rep_no_movement_cust_all')}
          </td>
        </tr>
      `;
    } else {
      Object.values(productSpend).forEach(pSpend => {
        const prod = state.products.find(pr => pr.code === pSpend.code);
        const avgPrice = pSpend.qty > 0 ? (pSpend.spendSub / pSpend.qty) : 0;
        
        tbodyHtml += `
          <tr>
            <td><strong>${pSpend.code}</strong></td>
            <td style="font-weight:600; color:#fff;">${prod ? prod.name : t('rep_unknown_product')}</td>
            <td><span class="badge" style="background:rgba(256,256,256,0.05); color:var(--text-muted);">${prod ? prod.category : '--'}</span></td>
            <td style="text-align: center; font-weight:700; color:var(--success);">${pSpend.qty} ${prod ? prod.unit : ''}</td>
            <td style="text-align: left; direction:ltr;">${avgPrice.toFixed(2)} ${t('currency')}</td>
            <td style="text-align: left; direction:ltr; color:var(--text-muted);">${pSpend.spendSub.toFixed(2)} ${t('currency')}</td>
            <td style="text-align: left; font-weight:600; direction:ltr;">${pSpend.spendSub.toFixed(2)} ${t('currency')}</td>
          </tr>
        `;
      });
      
      tbodyHtml += `
        <tr style="background: rgba(16, 185, 129, 0.1); border-top: 2px solid var(--success); font-weight: 700;">
          <td colspan="3" style="text-align: center; color: var(--success);">${t('rep_total_purchases_all_footer')}</td>
          <td style="text-align: center; color: var(--success);">${totalOverallQty}</td>
          <td>--</td>
          <td style="text-align: left; direction: ltr; color: var(--text-muted);">${overallSpendSub.toFixed(2)} ${t('currency')}</td>
          <td style="text-align: left; direction: ltr; color: var(--success); font-size: 15px;">${overallSpendSub.toFixed(2)} ${t('currency')}</td>
        </tr>
      `;
    }
  }
  
  // 4. تقرير الأموال المستحقة للسداد (الائتمان الشهري)
  else if (type === 'customer_due_payments') {
    reportTitle.innerText = "تقرير الأموال المستحقة للسداد (الائتمان الشهري)";
    targetLabel1.innerText = "مستوى التقييم";
    targetVal1.innerText = "كافة عملاء الائتمان النشطين";
    infoItem2.style.display = 'none';
    
    // تاريخ التقييم (مصحح لتجنب انزياح المناطق الزمنية في المتصفحات)
    let refDate;
    let refDateStr = "";
    if (endDateStr) {
      const parts = endDateStr.split('-');
      refDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59, 999);
      refDateStr = endDateStr;
    } else {
      refDate = new Date();
      const y = refDate.getFullYear();
      const m = String(refDate.getMonth() + 1).padStart(2, '0');
      const d = String(refDate.getDate()).padStart(2, '0');
      refDateStr = `${y}-${m}-${d}`;
    }
    
    let totalOverallDue = 0;
    let totalOverallDebt = 0;
    let dueCustomersCount = 0;
    let dueCustomersList = [];
    
    // دالة مساعدة لحساب تاريخ الاستحقاق المحلي لتفادي انزياح التوقيت العالمي (UTC)
    const calculateDueDateLocal = (dateStr, days) => {
      const parts = dateStr.split('-');
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      date.setDate(date.getDate() + days);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return {
        dateObject: new Date(y, date.getMonth(), date.getDate(), 0, 0, 0, 0),
        dateStr: `${y}-${m}-${d}`
      };
    };

    // حساب الائتمان لكل عميل باستخدام خوارزمية FIFO المحاسبية
    state.customers.forEach(c => {
      const creditDays = c.credit_days !== undefined ? Number(c.credit_days) : 30;
      
      // مديونية العميل الكلية حالياً
      const currentBalance = calculateCustomerBalance(c.name);
      
      // الحصول على فواتير المبيعات وتواريخ استحقاقها
      const invoices = [];
      
      // إدراج الرصيد الافتتاحي كأول دين مستحق (إذا كان موجباً)
      const initialBalance = Number(c.initial_balance) || 0;
      if (initialBalance > 0) {
        invoices.push({
          id: "initial_balance",
          date: "1970-01-01",
          dueDate: new Date(0), // مستحق فوراً
          dueDateStr: "رصيد افتتاحي منقول",
          total: initialBalance,
          unpaid: initialBalance
        });
      }

      state.transactions.forEach(tRow => {
        if (tRow.customer === c.name && (tRow.type === 'sales' || tRow.type === 'sales_vaxigen')) {
          const invTotal = Number(tRow.total) || 0;
          
          // حساب تاريخ الاستحقاق بشكل محلي آمن
          const dueData = calculateDueDateLocal(tRow.date, creditDays);
          
          invoices.push({
            id: tRow.id,
            date: tRow.date,
            dueDate: dueData.dateObject,
            dueDateStr: dueData.dateStr,
            total: invTotal,
            unpaid: invTotal // سيتم تعديلها بالـ FIFO
          });
        }
      });
      
      // ترتيب الفواتير من الأقدم للأحدث لتطبيق الـ FIFO (الرصيد الافتتاحي سيكون الأول دائماً)
      invoices.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // الحصول على إجمالي المبالغ المسددة أو المرتجعة للعميل
      let totalCredits = 0;
      state.transactions.forEach(tRow => {
        if (tRow.customer === c.name) {
          if (tRow.type === 'payment') {
            totalCredits += Number(tRow.amount) || 0;
          } else if (tRow.type === 'return') {
            totalCredits += Number(tRow.total) || 0;
          }
        }
      });
      
      // إذا كان لدى العميل رصيد افتتاحي دائن (سلبي) نعتبره تسديدات إضافية
      if (initialBalance < 0) {
        totalCredits += Math.abs(initialBalance);
      }
      
      // تطبيق الـ FIFO: تسوية الديون/الفواتير الأقدم أولاً بأول باستخدام التسديدات
      let remainingCredits = totalCredits;
      invoices.forEach(inv => {
        if (remainingCredits >= inv.total) {
          inv.unpaid = 0;
          remainingCredits -= inv.total;
        } else if (remainingCredits > 0) {
          inv.unpaid = inv.total - remainingCredits;
          remainingCredits = 0;
        } else {
          inv.unpaid = inv.total;
        }
      });
      
      // الآن، نحسب كم تبلغ قيمة الفواتير التي حل تاريخ استحقاقها ولم تُسدد بعد (DueDate <= TargetDate)
      let customerDueVal = 0;
      const dueInvoicesInfo = [];
      
      invoices.forEach(inv => {
        if (inv.unpaid > 0 && inv.dueDate <= refDate) {
          customerDueVal += inv.unpaid;
          if (inv.id === "initial_balance") {
            dueInvoicesInfo.push(`رصيد افتتاحي (${inv.unpaid.toFixed(0)} ر.س)`);
          } else {
            dueInvoicesInfo.push(`فاتورة #${inv.id} (${inv.unpaid.toFixed(0)} ر.س، استحقاق: ${inv.dueDateStr})`);
          }
        }
      });
      
      // المديونية الحقيقية هي الحد الأقصى للمستحقات (لأن الحسابات التراكمية قد تكون مسواة)
      const finalCustomerDue = Math.max(0, Math.min(currentBalance, customerDueVal));
      
      if (currentBalance > 0) {
        totalOverallDebt += currentBalance;
        if (finalCustomerDue > 0) {
          totalOverallDue += finalCustomerDue;
          dueCustomersCount++;
        }
        
        dueCustomersList.push({
          name: c.name,
          region: c.region,
          creditDays: creditDays,
          debt: currentBalance,
          due: finalCustomerDue,
          invoicesCount: invoices.length,
          dueDetails: dueInvoicesInfo.length > 0 ? dueInvoicesInfo.join(" | ") : "لا توجد فواتير متجاوزة للأجل"
        });
      }
    });
    
    // ترتيب العملاء حسب قيمة المستحقات الأعلى أولاً
    dueCustomersList.sort((a, b) => b.due - a.due);
    
    kpisHtml = `
      <div class="alert-panel" style="border-right: 4px solid var(--danger); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">إجمالي الديون المستحقة للسداد</span>
        <strong style="font-size:20px; color:var(--danger);">${totalOverallDue.toFixed(2)} ${t('currency')}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--warning); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">إجمالي المديونيات القائمة (التراكمية)</span>
        <strong style="font-size:20px; color:var(--warning);">${totalOverallDebt.toFixed(2)} ${t('currency')}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--success); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">عدد العملاء المستحق عليهم سداد</span>
        <strong style="font-size:20px; color:#fff;">${dueCustomersCount} من ${state.customers.length}</strong>
      </div>
      <div class="alert-panel" style="border-right: 4px solid var(--secondary); padding: 15px;">
        <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">تاريخ تقييم الاستحقاق</span>
        <strong style="font-size:20px; color:#fff;">${refDateStr}</strong>
      </div>
    `;
    
    thHtml = `
      <tr>
        <th>اسم العميل / المزرعة</th>
        <th>المنطقة الجغرافية</th>
        <th style="text-align: center;">مدة الائتمان</th>
        <th style="text-align: left;">المديونية الكلية</th>
        <th style="text-align: left; color: var(--danger);">المستحق للسداد حالياً</th>
        <th>تفاصيل الفواتير المستحقة</th>
      </tr>
    `;
    
    if (dueCustomersList.length === 0) {
      tbodyHtml = `
        <tr>
          <td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">
            لا توجد أي ديون قائمة أو أموال مستحقة للسداد على أي عميل حتى تاريخ التقييم المحدد.
          </td>
        </tr>
      `;
    } else {
      dueCustomersList.forEach(cDue => {
        const rowBg = cDue.due > 0 ? "rgba(239, 68, 68, 0.05)" : "transparent";
        const dueColor = cDue.due > 0 ? "var(--danger)" : "var(--text-muted)";
        
        tbodyHtml += `
          <tr style="background: ${rowBg};">
            <td style="font-weight:600; color:#fff;">${cDue.name}</td>
            <td><span class="badge badge-info"><i class="fa-solid fa-map-location-dot"></i> ${cDue.region}</span></td>
            <td style="text-align: center;">${cDue.creditDays} يوم</td>
            <td style="text-align: left; direction:ltr;">${cDue.debt.toFixed(2)} ${t('currency')}</td>
            <td style="text-align: left; direction:ltr; font-weight:700; color:${dueColor};">${cDue.due.toFixed(2)} ${t('currency')}</td>
            <td style="font-size: 11px; color: var(--text-muted); max-width: 300px; white-space: normal; line-height: 1.4;">${cDue.dueDetails}</td>
          </tr>
        `;
      });
      
      tbodyHtml += `
        <tr style="background: rgba(239, 68, 68, 0.1); border-top: 2px solid var(--danger); font-weight: 700;">
          <td colspan="3" style="text-align: center; color: var(--danger);">المجموع الإجمالي للأموال والديون</td>
          <td style="text-align: left; direction: ltr; color: var(--warning);">${totalOverallDebt.toFixed(2)} ${t('currency')}</td>
          <td style="text-align: left; direction: ltr; color: var(--danger); font-size: 15px;">${totalOverallDue.toFixed(2)} ${t('currency')}</td>
          <td>--</td>
        </tr>
      `;
    }
  }
  
  // صب النتائج في شاشة العرض
  kpiContainer.innerHTML = kpisHtml;
  tableHead.innerHTML = thHtml;
  tableBody.innerHTML = tbodyHtml;
  
  resultsWrapper.style.display = 'block';
  emptyMessage.style.display = 'none';
  
  // تحريك الشاشة بسلاسة للنتائج
  resultsWrapper.scrollIntoView({ behavior: 'smooth' });
}

// ================= 9. التوجيه والتبديل المالي للشاشات (Routing) =================

function switchSection(sectionId) {
  // تفعيل الشاشة المختارة وإخفاء الشاشات الأخرى
  document.querySelectorAll('.page-section').forEach(sec => {
    sec.classList.remove('active');
  });
  
  const targetSec = document.getElementById(sectionId);
  if (targetSec) targetSec.classList.add('active');

  // تفعيل الرابط النشط في شريط التنقل
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });

  // العثور على الرابط وتفعيله
  const links = document.querySelectorAll('.nav-link');
  links.forEach(l => {
    if (l.getAttribute('onclick') && l.getAttribute('onclick').includes(sectionId)) {
      l.classList.add('active');
    }
  });

  // إعادة تحميل محددة عند التنقل لضمان التفاعلية
  if (sectionId === 'dashboard') {
    renderDashboard();
  } else if (sectionId === 'inventory') {
    renderProductTable();
  } else if (sectionId === 'customers') {
    renderCustomerTable();
  } else if (sectionId === 'invoices') {
    document.getElementById('inv-date').valueAsDate = new Date();
    handleInvoiceTypeChange();
  } else if (sectionId === 'ledger') {
    generateCustomerLedger();
  } else if (sectionId === 'reports') {
    populateReportSelects();
    document.getElementById('report-date-start').value = "";
    document.getElementById('report-date-end').value = "";
    document.getElementById('report-results-wrapper').style.display = 'none';
    document.getElementById('report-empty-message').style.display = 'block';
  } else if (sectionId === 'settings') {
    populateNumberingInputs();
    populateCustomNamesInputs();
    populateSettingsRegionsList();
  }
}

// ================= 10. استيراد وتصدير البيانات إلى إكسل (Excel Import / Export) =================

// دالة عامة لتنزيل ملف CSV مع دعم ترميز اللغة العربية UTF-8 BOM لمنع تلف الكلمات في Excel
function downloadCSV(csvContent, filename) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// د. تصدير التقرير المالي المعروض حالياً إلى إكسل
function exportReportToExcel() {
  const resultsWrapper = document.getElementById('report-results-wrapper');
  if (!resultsWrapper || resultsWrapper.style.display === 'none') {
    alert("لا توجد بيانات تقرير معروضة حالياً لتصديرها. يرجى توليد تقرير أولاً.");
    return;
  }

  const tableHead = document.getElementById('report-table-head');
  const tableBody = document.getElementById('report-table-tbody');
  
  if (!tableHead || !tableBody) {
    alert("تعذر العثور على جدول التقرير.");
    return;
  }
  
  const title = document.getElementById('lbl-report-title').innerText || "تقرير_مالي";
  
  const headers = [];
  const headerRow = tableHead.querySelector('tr');
  if (headerRow) {
    headerRow.querySelectorAll('th').forEach(th => {
      headers.push(th.innerText.trim());
    });
  }
  
  const rows = [];
  tableBody.querySelectorAll('tr').forEach(tr => {
    const row = [];
    tr.querySelectorAll('td').forEach(td => {
      let cellText = td.innerText.trim();
      // استبدال المسافات المتكررة بمسافة واحدة
      cellText = cellText.replace(/\s+/g, ' ');
      row.push(cellText);
    });
    if (row.length > 0) {
      rows.push(row);
    }
  });
  
  if (headers.length === 0 && rows.length === 0) {
    alert("التقرير فارغ ولا يحتوي على بيانات لتصديرها.");
    return;
  }
  
  // بناء محتوى الـ CSV
  const csvContent = [headers, ...rows].map(r => r.map(field => {
    let f = String(field === undefined || field === null ? '' : field);
    if (f.includes(',') || f.includes('\n') || f.includes('"')) {
      f = '"' + f.replace(/"/g, '""') + '"';
    }
    return f;
  }).join(',')).join('\n');
  
  // تنظيف اسم الملف من الرموز غير الصالحة للملفات
  const safeTitle = title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-_]/g, '').trim().replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSV(csvContent, `${safeTitle}_${dateStr}.csv`);
}

// أ. تصدير الأصناف البيطرية إلى إكسل
function exportProductsToCSV() {
  const headers = [
    "رمز الصنف",
    "اسم الصنف",
    "القسم",
    "الوحدة",
    "الكمية الافتتاحية",
    "المخزون الحالي",
    "حد إعادة الطلب",
    "سعر البيع الافتراضي",
    "سعر الشراء الافتراضي",
    "تاريخ الصلاحية"
  ];

  const rows = state.products.map(p => {
    const currentStock = calculateProductStock(p.code);
    return [
      p.code,
      p.name,
      p.category || "عام",
      p.unit || "حبة",
      p.initial_stock || 0,
      currentStock,
      p.reorder_limit || 0,
      p.price_sell || 0,
      p.price_buy || 0,
      p.expiry || ""
    ];
  });

  const csvContent = [headers, ...rows].map(r => r.map(field => {
    let f = String(field === undefined || field === null ? '' : field);
    if (f.includes(',') || f.includes('\n') || f.includes('"')) {
      f = '"' + f.replace(/"/g, '""') + '"';
    }
    return f;
  }).join(',')).join('\n');

  downloadCSV(csvContent, `vet_products_${new Date().toISOString().slice(0,10)}.csv`);
}

// ب. تصدير العملاء والمزارع إلى إكسل
function exportCustomersToCSV() {
  const headers = [
    "اسم العميل",
    "المنطقة",
    "الهاتف",
    "الرصيد الافتتاحي",
    "الرصيد الحالي",
    "البريد الإلكتروني"
  ];

  const rows = state.customers.map(c => {
    const currentBalance = calculateCustomerBalance(c.name);
    return [
      c.name,
      c.region || "الغربية",
      c.phone || "",
      c.initial_balance || 0,
      currentBalance,
      c.email || ""
    ];
  });

  const csvContent = [headers, ...rows].map(r => r.map(field => {
    let f = String(field === undefined || field === null ? '' : field);
    if (f.includes(',') || f.includes('\n') || f.includes('"')) {
      f = '"' + f.replace(/"/g, '""') + '"';
    }
    return f;
  }).join(',')).join('\n');

  downloadCSV(csvContent, `vet_customers_${new Date().toISOString().slice(0,10)}.csv`);
}

// ج. تصدير سجل العمليات المالي بالكامل إلى إكسل
function exportTransactionsToCSV() {
  const headers = [
    "رقم العملية",
    "نوع العملية",
    "الطرف الآخر/العميل",
    "التاريخ",
    "المجموع الفرعي",
    "الخصم",
    "الضريبة (15%)",
    "الصافي النهائي",
    "الأصناف المبيعة / الملاحظات"
  ];

  const rows = state.transactions.map(t => {
    let typeArabic = t.type;
    if (t.type === 'sales') typeArabic = "فاتورة مبيعات عامة";
    else if (t.type === 'sales_vaxigen') typeArabic = "فاتورة مبيعات Vaxigen";
    else if (t.type === 'purchase') typeArabic = "فاتورة مشتريات";
    else if (t.type === 'return') typeArabic = "فاتورة مرتجع";
    else if (t.type === 'payment') typeArabic = "سند قبض";

    let subtotal = 0;
    let discount = 0;
    let vatAmount = 0;
    let total = 0;
    let details = "";

    if (t.type === 'payment') {
      total = t.amount || 0;
      details = t.notes || "سند قبض نقدي";
    } else {
      subtotal = t.subtotal || 0;
      discount = t.discount || 0;
      vatAmount = t.vat_amount || 0;
      total = t.total || 0;
      details = t.items ? t.items.map(item => `${item.name} (${item.qty} × ${item.price})`).join(' | ') : '';
    }

    return [
      t.id,
      typeArabic,
      t.customer,
      t.date,
      subtotal,
      discount,
      vatAmount,
      total,
      details
    ];
  });

  const csvContent = [headers, ...rows].map(r => r.map(field => {
    let f = String(field === undefined || field === null ? '' : field);
    if (f.includes(',') || f.includes('\n') || f.includes('"')) {
      f = '"' + f.replace(/"/g, '""') + '"';
    }
    return f;
  }).join(',')).join('\n');

  downloadCSV(csvContent, `vet_transactions_${new Date().toISOString().slice(0,10)}.csv`);
}

// د. دالة مخصصة لتحليل محتوى CSV للتعامل مع الفواصل وعلامات التنصيص المزدوجة والسطور المتعددة
function parseCSV(text) {
  let lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    let next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push("");
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

// هـ. دالة البحث عن مؤشر العمود بناءً على مرادفات مختلفة للعناوين باللغتين العربية والإنجليزية
function findHeaderIndex(headers, aliases) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim().toLowerCase();
    if (aliases.some(alias => h.includes(alias.toLowerCase()) || alias.toLowerCase().includes(h))) {
      return i;
    }
  }
  return -1;
}

// و. استقبال واستيراد الملف من متصفح المستخدم ومعالجته
function importDataFromCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const importType = document.getElementById('excel-import-type').value;
  const reader = new FileReader();

  reader.onload = function(e) {
    const text = e.target.result;
    const rows = parseCSV(text);

    if (rows.length < 2) {
      alert("تنبيه: ملف الـ CSV فارغ أو لا يحتوي على صفوف بيانات صالحة للاستيراد.");
      event.target.value = "";
      return;
    }

    // تنظيف رؤوس الأعمدة من علامات التنصيص والمسافات
    const headerRow = rows[0].map(h => h.trim().replace(/^["']|["']$/g, ''));

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    if (importType === 'products') {
      // البحث عن الأعمدة
      const codeIdx = findHeaderIndex(headerRow, ["رمز الصنف", "كود الصنف", "كود", "رمز", "code"]);
      const nameIdx = findHeaderIndex(headerRow, ["اسم الصنف", "الاسم", "اسم المنتج", "name"]);
      const catIdx = findHeaderIndex(headerRow, ["القسم", "الفئة", "التصنيف", "category"]);
      const unitIdx = findHeaderIndex(headerRow, ["الوحدة", "unit"]);
      const initStockIdx = findHeaderIndex(headerRow, ["الكمية الافتتاحية", "الرصيد الافتتاحي", "مخزون البداية", "initial_stock", "initial stock", "stock"]);
      const reorderIdx = findHeaderIndex(headerRow, ["حد الطلب", "حد إعادة الطلب", "reorder_limit", "reorder limit", "reorder"]);
      const sellIdx = findHeaderIndex(headerRow, ["سعر البيع", "سعر بيع", "سعر_البيع", "price_sell", "price sell", "sell"]);
      const buyIdx = findHeaderIndex(headerRow, ["سعر الشراء", "سعر شراء", "سعر_الشراء", "price_buy", "price buy", "buy"]);
      const expiryIdx = findHeaderIndex(headerRow, ["تاريخ الصلاحية", "الصلاحية", "تاريخ_الصلاحية", "expiry"]);

      if (codeIdx === -1 || nameIdx === -1) {
        alert("خطأ: لم يتم العثور على الأعمدة الأساسية المطلوبة للأصناف (كود الصنف واسم الصنف). يرجى التأكد من مطابقة أسماء الأعمدة في الملف.");
        event.target.value = "";
        return;
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || (row.length === 1 && row[0].trim() === "")) {
          continue;
        }

        const code = row[codeIdx] ? row[codeIdx].trim() : "";
        const name = row[nameIdx] ? row[nameIdx].trim() : "";

        if (!code || !name) {
          skippedCount++;
          continue;
        }

        const category = catIdx !== -1 && row[catIdx] ? row[catIdx].trim() : "عام";
        const unit = unitIdx !== -1 && row[unitIdx] ? row[unitIdx].trim() : "حبة";
        const initialStock = initStockIdx !== -1 && row[initStockIdx] ? Number(row[initStockIdx]) || 0 : 0;
        const reorder = reorderIdx !== -1 && row[reorderIdx] ? Number(row[reorderIdx]) || 0 : 0;
        const sellPrice = sellIdx !== -1 && row[sellIdx] ? Number(row[sellIdx]) || 0 : 100;
        const buyPrice = buyIdx !== -1 && row[buyIdx] ? Number(row[buyIdx]) || 0 : 70;
        const expiry = expiryIdx !== -1 && row[expiryIdx] ? row[expiryIdx].trim() : "";

        const existingIndex = state.products.findIndex(p => p.code === code);
        if (existingIndex !== -1) {
          state.products[existingIndex] = {
            ...state.products[existingIndex],
            name: name,
            category: category,
            unit: unit,
            initial_stock: initialStock,
            reorder_limit: reorder,
            price_sell: sellPrice,
            price_buy: buyPrice,
            expiry: expiry
          };
          updatedCount++;
        } else {
          state.products.push({
            code: code,
            name: name,
            category: category,
            unit: unit,
            initial_stock: initialStock,
            reorder_limit: reorder,
            price_sell: sellPrice,
            price_buy: buyPrice,
            expiry: expiry
          });
          insertedCount++;
        }
      }

    } else if (importType === 'customers') {
      const nameIdx = findHeaderIndex(headerRow, ["اسم العميل", "الاسم", "اسم المزرعة", "العميل", "name", "customer"]);
      const regionIdx = findHeaderIndex(headerRow, ["المنطقة", "region", "area"]);
      const phoneIdx = findHeaderIndex(headerRow, ["رقم الهاتف", "الهاتف", "الجوال", "التليفون", "phone", "mobile"]);
      const initBalanceIdx = findHeaderIndex(headerRow, ["الرصيد الافتتاحي", "رصيد البداية", "الرصيد", "initial_balance", "initial balance", "balance"]);
      const emailIdx = findHeaderIndex(headerRow, ["البريد", "البريد الإلكتروني", "email"]);

      if (nameIdx === -1) {
        alert("خطأ: لم يتم العثور على عمود (اسم العميل) في ملف الـ CSV المرفوع.");
        event.target.value = "";
        return;
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || (row.length === 1 && row[0].trim() === "")) {
          continue;
        }

        const name = row[nameIdx] ? row[nameIdx].trim() : "";
        if (!name) {
          skippedCount++;
          continue;
        }

        const region = regionIdx !== -1 && row[regionIdx] ? row[regionIdx].trim() : "الغربية";
        const phone = phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx].trim() : "";
        const initialBalance = initBalanceIdx !== -1 && row[initBalanceIdx] ? Number(row[initBalanceIdx]) || 0 : 0;
        const email = emailIdx !== -1 && row[emailIdx] ? row[emailIdx].trim() : "";

        const existingIndex = state.customers.findIndex(c => c.name === name);
        if (existingIndex !== -1) {
          state.customers[existingIndex] = {
            ...state.customers[existingIndex],
            region: region,
            phone: phone,
            initial_balance: initialBalance,
            email: email
          };
          updatedCount++;
        } else {
          state.customers.push({
            name: name,
            region: region,
            phone: phone,
            initial_balance: initialBalance,
            email: email
          });
          insertedCount++;
        }
      }
    }

    // حفظ التغييرات وتحديث الواجهات بالكامل
    saveState();
    refreshAllViews();
    alert(`تمت عملية الاستيراد والدمج الذكي بنجاح!\n- الأصناف/العملاء الجدد المضافين: ${insertedCount}\n- الأصناف/العملاء المدمجين والمحدثين: ${updatedCount}\n- السجلات التي تم تخطيها لعدم اكتمال بياناتها: ${skippedCount}`);
    event.target.value = "";
  };

  reader.readAsText(file, "UTF-8");
}

// ================= 12. محرك ثنائية اللغة والترجمات (i18n Translation Engine) =================

const translations = {
  ar: {
    // Navigation & General Layout
    nav_dashboard: "لوحة التحكم",
    nav_invoices: "الفواتير والعمليات",
    nav_inventory: "إدارة المخزون",
    nav_customers: "العملاء والحسابات",
    nav_ledger: "كشف الحساب",
    nav_reports: "مركز التقارير",
    nav_settings: "النسخ والإعدادات",
    sidebar_footer_app: "نظام VetStock الإحترافي v1.0",
    sidebar_footer_rights: "© 2026 جميع الحقوق محفوظة",
    app_title: "لوحة التحكم الرئيسية",
    app_subtitle: "ملخص فوري لأعمال الاستيراد والمبيعات البيطرية اليوم",
    new_invoice: "فاتورة جديدة",
    currency: "ر.س",

    // KPI & Cards
    kpi_sales: "إجمالي المبيعات",
    kpi_purchases: "إجمالي المشتريات",
    kpi_inventory_value: "قيمة المخزون الحالي",
    kpi_receivables: "مستحقات العملاء القائمة",
    
    // Alerts
    alert_stock_title: "تنبيهات كميات المخزون",
    alert_expiry_title: "تنبيهات انتهاء الصلاحية",
    alert_region_title: "تحليل مبيعات المناطق",
    alert_recent_tx_title: "آخر 5 عمليات مسجلة بالبرنامج",
    alert_top_products: "أعلى 5 أصناف بيطرية مبيعاً",
    alert_top_customers: "أعلى 5 عملاء سحباً (بدون VAT)",
    
    // Messages
    msg_stock_safe: "جميع مستويات المخزون كافية وآمنة!",
    msg_expiry_safe: "صلاحية جميع المنتجات سارية وآمنة!",
    msg_no_tx: "لا توجد أي فواتير أو معاملات مسجلة بعد.",
    msg_items: "أصناف",
    msg_invoices: "فواتير",
    msg_invoices_count: "فواتير مبيعات",
    msg_vaxigen_badge: "مبيعات V",
    msg_sales_badge: "فاتورة مبيعات",
    msg_purchase_badge: "فاتورة مشتريات",
    msg_return_badge: "فاتورة مرتجع",
    msg_payment_badge: "سند قبض",
    msg_payment_collected: "متحصلات من: ",
    msg_quantity: "الكمية: ",
    msg_net: "الصافي: ",
    msg_unknown_party: "مورد عام",
    msg_unknown_customer: "عميل عام",
    msg_buy_products: "شراء منتجات",
    no_top_products_msg: "لا توجد مبيعات مسجلة لعرض الأصناف الأكثر مبيعاً بعد.",
    no_top_customers_msg: "لا توجد فواتير مبيعات مسجلة لعرض كبار العملاء بعد.",
    sales: "مبيعات",
    
    // Product details
    prod_code: "رمز الصنف",
    prod_name: "اسم المنتج البيطري",
    prod_category: "التصنيف",
    prod_unit: "الوحدة",
    prod_initial_stock: "الكمية الافتتاحية",
    prod_reorder: "حد الطلب",
    prod_price_sell: "سعر البيع",
    prod_price_buy: "سعر الشراء",
    prod_expiry: "تاريخ الصلاحية",
    prod_stock_actual: "المخزون الفعلي",
    prod_status: "الحالة",
    prod_action: "الإجراءات",

    // Customer details
    cust_name: "اسم العميل / المزرعة",
    cust_region: "المنطقة الجغرافية",
    cust_phone: "رقم الهاتف",
    cust_email: "البريد الإلكتروني",
    cust_credit_days: "مدة الائتمان",
    cust_credit_days_label_modal: "مدة الائتمان (بالأيام)",
    cust_initial_balance: "الرصيد الافتتاحي",
    cust_balance_actual: "المديونية الحالية",
    cust_actions: "التحكم",

    // Invoice creator
    inv_type: "نوع الفاتورة والعملية",
    inv_date: "تاريخ الفاتورة",
    inv_party: "العميل أو الطرف الآخر",
    inv_subtotal: "إجمالي الفاتورة (قبل الخصم والضريبة)",
    inv_discount: "خصم إضافي نقدي",
    inv_vat: "ضريبة القيمة المضافة (VAT 15%)",
    inv_grand: "الصافي النهائي للمستند",
    inv_notes: "ملاحظات السند",
    inv_add_item: "إضافة صنف للفاتورة",
    inv_save: "حفظ وترحيل المعاملة",

    // Tables
    tbl_id: "رقم العملية",
    tbl_type: "نوع العملية",
    tbl_party: "العميل / التفاصيل",
    tbl_date: "التاريخ",
    tbl_amount: "قيمة الفاتورة",
    tbl_avg_buy_price: "متوسط سعر الشراء",

    // Product Table and badges
    prod_status_safe: "متوفر وكافي",
    prod_status_low: "قرب النفاد",
    prod_status_expired: "منتهى الصلاحية",
    prod_status_expiring_soon: "قريب الانتهاء",
    prod_status_out_of_stock: "نفذ بالكامل",
    prod_btn_edit: "تعديل",
    prod_no_match: "لا توجد أصناف مطابقة للبحث الحالي.",

    // Customer Table
    cust_debit: "مدين",
    cust_credit: "دائن",
    cust_settled: "خالص",
    cust_btn_edit_balance: "تعديل الرصيد",
    cust_btn_collect_payment: "قبض دفعة",
    cust_no_match: "لا توجد نتائج مطابقة لبحث العملاء.",

    // Dropdowns and placeholders
    select_customer_placeholder: "-- اختر العميل --",
    select_product_placeholder: "-- اختر الصنف البيطري --",
    select_ledger_customer_placeholder: "-- اختر العميل لعرض كشف الحساب التراكمي --",
    select_ledger_region: "المنطقة",

    // Invoice creator and history
    inv_mgmt_title: "إدارة الفواتير والمعاملات المالية",
    inv_mgmt_subtitle: "تسجيل وتعديل فواتير المبيعات، المشتريات، المرتجع وسندات القبض",
    inv_tab_new: "تحرير معاملة جديدة",
    inv_tab_log: "سجل جميع العمليات والفواتير",
    inv_opt_sales: "فاتورة مبيعات (S)",
    inv_opt_vaxigen: "فاتورة مبيعات شركة V",
    inv_opt_purchase: "فاتورة مشتريات (B)",
    inv_opt_return: "فاتورة مرتجع مبيعات (R)",
    inv_opt_payment: "سند قبض مالي",
    inv_party_label: "العميل أو المورد",
    inv_region_label: "المنطقة الجغرافية للعميل",
    inv_region_placeholder: "المنطقة تلقائياً",
    inv_date_label: "تاريخ العملية",
    inv_number_label: "رقم الفاتورة القادم / الحالي",
    inv_items_title: "عناصر الفاتورة",
    inv_qty: "الكمية",
    inv_item_total: "إجمالي الصنف",
    pay_details_title: "تفاصيل سند القبض المالي",
    pay_amount_label: "المبلغ المستلم (ر.س)",
    pay_amount_placeholder: "ادخل المبلغ المستلم لتنزيله من المديونية",
    pay_notes_label: "ملاحظات / رقم السند",
    pay_notes_placeholder: "مثل: نقداً، شيك رقم ...",
    summary_title: "ملخص الحساب",
    inv_subtotal_label: "المجموع الفرعي:",
    inv_discount_label: "خصم إضافي (ر.س)",
    inv_vat_toggle_label: "ضريبة القيمة المضافة (15%):",
    inv_vat_amount_label: "قيمة الضريبة:",
    inv_grand_label: "الإجمالي النهائي:",
    search_invoice_placeholder: "ابحث باسم العميل أو رقم الفاتورة...",
    log_filter_all: "كل المعاملات",
    log_filter_sales: "المبيعات (S) فقط",
    log_filter_sales_v: "مبيعات شركة V فقط",
    log_filter_purchase: "المشتريات فقط",
    log_filter_return: "المرتجع فقط",
    log_filter_payment: "سندات القبض",
    tbl_details: "التفاصيل والملاحظات",
    invoice_btn_edit: "تعديل",
    invoice_btn_delete: "حذف",
    invoice_no_match: "لا توجد أي معاملات أو فواتير مطابقة للبحث حالياً.",
    payment_collected_desc: "متحصلات نقدية",
    invoice_sales_v_label: "فاتورة مبيعات شركة V رقم ",
    invoice_sales_label: "فاتورة مبيعات بيطرية رقم ",
    invoice_return_label: "فاتورة مرتجع مبيعات رقم ",
    payment_receipt_label: "سند قبض مالي - ",

    // Inventory page
    inv_title: "إدارة المخازن والأصناف",
    inv_subtitle: "تتبع مخزون المضادات الحيوية، الفيتامينات، وإضافات الأعلاف",
    new_product: "صنف جديد",
    search_product_placeholder: "ابحث باسم الصنف أو الكود...",
    filter_cat_all: "كل الفئات البيطرية",
    filter_cat_poultry: "دواجن",
    filter_cat_cattle: "ماشية",
    filter_cat_additives: "إضافات علفية",
    filter_status_all: "كل الحالات",
    filter_status_normal: "متوفر وكافي",
    filter_status_low: "قرب النفاد (تحت حد الطلب)",
    filter_status_expired: "منتهى الصلاحية",

    // Customers page
    cust_title: "إدارة العملاء والحسابات المالية",
    cust_subtitle: "توزيع العملاء على المناطق، تتبع الأرصدة الافتتاحية والمديونيات",
    new_customer: "عميل جديد",
    search_customer_placeholder: "ابحث باسم العميل أو المزرعة...",
    filter_region_all: "كل المناطق",
    filter_region_west: "المنطقة الغربية",
    filter_region_center: "المنطقة الوسطى",
    filter_region_south: "المنطقة الجنوبية",
    filter_region_east: "المنطقة الشرقية",

    // Ledger page
    led_title: "كشف حساب العميل التراكمي",
    led_subtitle: "عرض تفصيلي للحركات المالية والفواتير وسندات القبض لفترة محددة",
    led_select_customer: "اختر العميل / المزرعة البيطرية",
    led_from_date: "من تاريخ",
    led_to_date: "إلى تاريخ",
    led_print: "طباعة كشف الحساب / تصدير PDF",
    led_company_brand: "شركة استيراد وتجارة المنتجات البيطرية",
    led_report_title: "كشف حساب تفصيلي وتراكمي للعملاء",
    cust_name_label: "اسم العميل:",
    cust_region_label: "المنطقة الجغرافية:",
    led_period_label: "الفترة الزمنية:",
    led_debit_hdr: "مدين (عليه ر.س)",
    led_credit_hdr: "دائن (له ر.س)",
    led_balance_hdr: "الرصيد التراكمي (ر.س)",
    led_total_debit_label: "إجمالي العمليات المدين:",
    led_total_credit_label: "إجمالي العمليات الدائن:",
    led_final_balance_label: "الرصيد النهائي المستحق:",
    ledger_no_customer_selected: "يرجى اختيار العميل وتحديد الفترة الزمنية لتوليد التقرير المالي.",
    ledger_initial_balance_title: "رصيد افتتاحي (منقول للفترة المحددة)",
    ledger_period_all: "منذ البداية",
    ledger_period_from_to: "من {start} إلى {end}",
    ledger_period_from: "منذ {start}",
    ledger_period_to: "حتى تاريخ {end}",

    // Reports page
    rep_title: "مركز التقارير المتقدمة",
    rep_subtitle: "توليد تقارير مسحوبات العملاء، وحركة الأصناف البيطرية، ومبيعات المناطق الجغرافية",
    rep_type_label: "نوع التقرير المالي",
    rep_opt_prod_summary: "تقرير حركة صنف بيطري تفصيلي",
    rep_opt_cust_prod_purchases: "مسحوبات عميل معين من صنف معين",
    rep_opt_cust_all_purchases: "مسحوبات عميل من كافة الأصناف",
    rep_opt_cust_due_payments: "الأموال المستحقة للسداد (الائتمان الشهري)",
    rep_select_product: "اختر الصنف البيطري",
    rep_generate_btn: "توليد التقرير المالي",
    rep_print_btn: "طباعة التقرير / تصدير PDF",
    rep_export_excel_btn: "تصدير التقرير إلى إكسل",
    rep_dept_label: "قسم الاستيراد وتجارة المنتجات البيطرية",
    rep_db_status_label: "حالة قاعدة البيانات",
    rep_db_status_val: "متصل ومحدثة",
    rep_accountant_signature: "المسؤول المحاسبي:",
    rep_seal_signature: "التوقيع والختم المعتمد:",
    rep_empty_title: "بوابة التقارير المالية والإدارية النشطة",
    rep_empty_desc: "يرجى تحديد نوع التقرير المطلوب، وفلترة الصنف والعميل، وتعيين الفترة الزمنية المطلوبة ثم النقر على \"توليد التقرير المالي\" لعرض البيانات بالتفصيل.",
    rep_err_select_product: "يرجى اختيار الصنف البيطري لتوليد تقرير الحركة.",
    rep_err_select_cust_prod: "يرجى اختيار العميل والصنف البيطري معاً.",
    rep_err_select_customer: "يرجى اختيار العميل لعرض مسحوباته الكلية.",
    rep_gen_date: "تاريخ التوليد: ",
    rep_period_all: "كامل المدة التاريخية",
    rep_period_from_to: "الفترة من {start} إلى {end}",
    rep_period_from: "من تاريخ {start}",
    rep_period_to: "حتى تاريخ {end}",
    rep_title_prod_summary: "تقرير حركة صنف بيطري تفصيلي",
    rep_label_target_prod: "الصنف المستهدف",
    rep_label_target_cust: "العميل المستهدف",
    rep_kpi_total_sales_qty: "إجمالي المبيعات (الكمية)",
    rep_kpi_avg_sell_price: "متوسط سعر البيع بالفترة",
    rep_kpi_total_purchases_qty: "إجمالي المشتريات (الكمية)",
    rep_kpi_total_returns_qty: "إجمالي المرتجع (الكمية)",
    rep_kpi_net_movement: "صافي الحركة بالفترة",
    rep_kpi_stock_value: "المخزون الحالي / القيمة المتوقعة",
    rep_no_movement_prod: "لا توجد أي حركات مسجلة لهذا الصنف خلال الفترة المحددة.",
    rep_title_cust_prod_purchases: "مسحوبات عميل معين من صنف معين",
    rep_kpi_total_purchased_qty: "إجمالي الكمية المسحوبة",
    rep_kpi_invoices_count: "عدد الفواتير الصادرة",
    rep_kpi_total_purchased_val: "إجمالي المسحوبات بالقيمة النقدية (بدون VAT)",
    rep_kpi_vat_amount: "قيمة الضريبة المضافة المحتسبة",
    rep_kpi_avg_buy_price: "متوسط سعر الشراء (بدون VAT)",
    rep_no_movement_cust_prod: "لم يقم هذا العميل بسحب هذا الصنف خلال الفترة الزمنية المحددة.",
    rep_total_purchases_prod_footer: "إجمالي المسحوبات لهذا الصنف (بدون VAT)",
    rep_title_cust_all_purchases: "تقرير مسحوبات عميل من كافة الأصناف",
    rep_kpi_invoices_total_period: "عدد الفواتير الكلي بالفترة",
    rep_kpi_distinct_products: "إجمالي الأصناف المختلفة",
    rep_kpi_total_quantities: "إجمالي الكميات المسحوبة (عبوة)",
    rep_kpi_region: "المنطقة الجغرافية للعميل",
    rep_no_movement_cust_all: "لا توجد أي مسحوبات مسجلة لهذا العميل خلال الفترة المحددة.",
    rep_unknown_product: "صنف مجهول",
    rep_total_purchases_all_footer: "إجمالي المسحوبات الكلي بالقيمة النقدية (بدون VAT)",

    // Settings page
    set_title: "إعدادات النظام والنسخ الاحتياطي",
    set_subtitle: "إدارة قواعد البيانات المحلية، الاستيراد، التصدير وإعادة الضبط",
    set_export_title: "تصدير وحفظ نسخة احتياطية",
    set_export_desc: "يمكنك تصدير كافة العمليات، فواتير المبيعات، المشتريات، المرتجعات، الأرصدة الافتتاحية المعدلة وتفاصيل العملاء في ملف واحد آمن للكمبيوتر. يوصى بعمل نسخة احتياطية دورياً.",
    set_export_btn: "تصدير قاعدة البيانات (JSON)",
    set_import_title: "استيراد واستعادة نسخة احتياطية",
    set_import_desc: "قم برفع نسخة احتياطية بصيغة (JSON) تم تصديرها مسبقاً لاستعادة كافة البيانات والأرصدة والعمليات. تنبيه: هذا الإجراء سيستبدل البيانات الحالية بالكامل.",
    set_import_btn: "اختر ملف النسخة واسترجعها",
    set_excel_export_title: "تصدير البيانات إلى برنامج إكسل",
    set_excel_export_desc: "يمكنك تصدير قاعدة بيانات الأصناف أو العملاء أو سجل المبيعات والعمليات بالكامل إلى ملفات إكسل (CSV متوافق ومرمز باللغة العربية) للتحليل الإحصائي أو التقارير الخارجية.",
    set_excel_export_prod: "تصدير الأصناف البيطرية إلى إكسل",
    set_excel_export_cust: "تصدير العملاء والمزارع إلى إكسل",
    set_excel_export_tx: "تصدير سجل العمليات المالي إلى إكسل",
    set_excel_import_title: "استيراد البيانات من ملفات إكسل",
    set_excel_import_desc: "قم بتجهيز قائمة الأصناف البيطرية أو العملاء في برنامج إكسل، ثم احفظها بصيغة (CSV UTF-8) وارفعها هنا لتحديث قاعدة بيانات البرنامج أو دمج أصناف وعملاء جدد دفعة واحدة.",
    set_excel_import_type: "حدد نوع البيانات المرفوعة",
    set_excel_opt_prod: "الأصناف البيطرية (قائمة أصناف جديدة أو تحديث)",
    set_excel_opt_cust: "العملاء والمزارع (قائمة عملاء جديدة)",
    set_excel_import_btn: "رفع ملف الـ CSV المنسق والدمج الفوري",
    set_excel_note_title: "ملاحظة هامة:",
    set_excel_note_desc: "يجب أن يحتوي ملف إكسل المرفوع على العناوين الصحيحة للأعمدة ليتم قراءتها بنجاح.",
    set_num_title: "التحكم وتعديل ترقيم الفواتير والعمليات",
    set_num_desc: "في حال قمت بحذف فاتورة أو معاملة بالخطأ وترغب في تعديل أو استرجاع تسلسل الترقيم التلقائي للفاتورة القادمة، يمكنك تعديل القيم أدناه مباشرة وحفظ التغييرات.",
    set_num_sales: "المبيعات العامة القادمة (S)",
    set_num_sales_v: "مبيعات شركة V القادمة (V)",
    set_num_purchase: "المشتريات القادمة (B)",
    set_num_return: "المرتجع القادم (R)",
    set_num_payment: "سند القبض القادم",
    set_num_btn: "حفظ وتعديل أرقام التسلسل القادمة",
    set_reset_title: "إعادة الضبط واستيراد قاعدة البيانات الافتراضية",
    set_reset_desc: "في حال رغبتك بمسح كافة المعاملات وفواتير المبيعات الحالية وإرجاع قاعدة بيانات العملاء والأصناف إلى البيانات الافتراضية المستخرجة من Excel (`sales-system-data.json`)، اضغط على زر إعادة الضبط أدناه.",
    set_reset_btn: "إرجاع وإعادة تهيئة النظام بالكامل",

    // Modals
    prod_modal_add_title: "إضافة صنف بيطري جديد",
    prod_modal_edit_title: "تعديل الرصيد الافتتاحي وبيانات الصنف",
    prod_code_label: "كود الصنف (فريد)",
    prod_code_placeholder: "مثال: 1020",
    prod_name_label: "اسم الصنف البيطري",
    prod_name_placeholder: "مثال: MULTIVIT VET",
    prod_category_label: "الفئة البيطرية",
    prod_unit_label: "الوحدة التجارية",
    prod_unit_placeholder: "مثل: لتر، كجم، 100 مل",
    prod_initial_stock_label: "الرصيد الافتتاحي (كمية البداية)",
    prod_reorder_limit_label: "حد إعادة الطلب (الحذر)",
    prod_expiry_label: "تاريخ الصلاحية",
    prod_price_sell_label: "سعر البيع الافتراضي (ر.س)",
    prod_price_buy_label: "سعر الشراء الافتراضي (ر.س)",
    btn_cancel: "إلغاء",
    prod_btn_save: "حفظ بيانات الصنف",

    cust_modal_add_title: "إضافة عميل / مزرعة جديدة",
    cust_modal_edit_title: "تعديل بيانات العميل والرصيد الافتتاحي",
    cust_name_label_modal: "اسم العميل بالكامل / المزرعة البيطرية",
    cust_name_placeholder: "مثال: مزرعة الروضة لإنتاج الدواجن",
    cust_region_label_modal: "المنطقة الجغرافية المعتمدة",
    cust_phone_label_modal: "رقم الجوال للتواصل",
    cust_phone_placeholder: "مثال: 0500000000",
    cust_balance_label_modal: "الرصيد المالي الافتتاحي للعميل (ر.س)",
    cust_email_label_modal: "البريد الإلكتروني",
    cust_btn_save: "حفظ بيانات العميل"
  },
  en: {
    // Navigation & General Layout
    nav_dashboard: "Dashboard",
    nav_invoices: "Invoices & Operations",
    nav_inventory: "Inventory",
    nav_customers: "Customers",
    nav_ledger: "Account Ledger",
    nav_reports: "Reports Center",
    nav_settings: "Backup & Settings",
    sidebar_footer_app: "VetStock Pro System v1.0",
    sidebar_footer_rights: "© 2026 All Rights Reserved",
    app_title: "Main Dashboard",
    app_subtitle: "Real-time summary of veterinary sales and imports today",
    new_invoice: "New Invoice",
    currency: "SAR",

    // KPI & Cards
    kpi_sales: "Total Sales",
    kpi_purchases: "Total Purchases",
    kpi_inventory_value: "Inventory Value",
    kpi_receivables: "Outstanding Receivables",

    // Alerts
    alert_stock_title: "Stock Level Alerts",
    alert_expiry_title: "Expiration Alerts",
    alert_region_title: "Sales by Region",
    alert_recent_tx_title: "Last 5 Transactions Registered",
    alert_top_products: "Top 5 Best-Selling Products",
    alert_top_customers: "Top 5 Active Customers (Excl. VAT)",

    // Messages
    msg_stock_safe: "All stock levels are sufficient and safe!",
    msg_expiry_safe: "All product expiration dates are safe!",
    msg_no_tx: "No transactions or invoices registered yet.",
    msg_items: "Items",
    msg_invoices: "Invoices",
    msg_invoices_count: "Sales Invoices",
    msg_vaxigen_badge: "Vaxigen",
    msg_sales_badge: "Sales Invoice",
    msg_purchase_badge: "Purchase Invoice",
    msg_return_badge: "Return Invoice",
    msg_payment_badge: "Payment Receipt",
    msg_payment_collected: "Collected from: ",
    msg_quantity: "Qty: ",
    msg_net: "Net: ",
    msg_unknown_party: "General Supplier",
    msg_unknown_customer: "General Customer",
    msg_buy_products: "Purchase items",
    no_top_products_msg: "No sales registered to display best-selling products yet.",
    no_top_customers_msg: "No sales invoices registered to display active customers yet.",
    sales: "Sales",
    
    // Product details
    prod_code: "Item Code",
    prod_name: "Veterinary Product",
    prod_category: "Category",
    prod_unit: "Unit",
    prod_initial_stock: "Initial Stock",
    prod_reorder: "Reorder Limit",
    prod_price_sell: "Selling Price",
    prod_price_buy: "Buying Price",
    prod_expiry: "Expiry Date",
    prod_stock_actual: "Actual Stock",
    prod_status: "Status",
    prod_action: "Actions",

    // Customer details
    cust_name: "Customer Name",
    cust_region: "Geographical Region",
    cust_phone: "Phone Number",
    cust_email: "Email Address",
    cust_credit_days: "Credit Terms",
    cust_credit_days_label_modal: "Credit Terms (Days)",
    cust_initial_balance: "Initial Balance",
    cust_balance_actual: "Current Balance",
    cust_actions: "Actions",

    // Invoice creator
    inv_type: "Invoice / Document Type",
    inv_date: "Invoice Date",
    inv_party: "Party / Customer",
    inv_subtotal: "Subtotal (Before Discount/VAT)",
    inv_discount: "Additional Cash Discount",
    inv_vat: "Value Added Tax (VAT 15%)",
    inv_grand: "Net Grand Total Value",
    inv_notes: "Payment Notes",
    inv_add_item: "Add Item to Invoice",
    inv_save: "Save & Commit Transaction",

    // Tables
    tbl_id: "TX ID",
    tbl_type: "TX Type",
    tbl_party: "Party / Details",
    tbl_date: "Date",
    tbl_amount: "Amount Value",
    tbl_avg_buy_price: "Avg Buy Price",

    // Product Table and badges
    prod_status_safe: "Sufficient",
    prod_status_low: "Low Stock",
    prod_status_expired: "Expired",
    prod_status_expiring_soon: "Expiring Soon",
    prod_status_out_of_stock: "Out of Stock",
    prod_btn_edit: "Edit",
    prod_no_match: "No products matching the current search.",

    // Customer Table
    cust_debit: "Debit",
    cust_credit: "Credit",
    cust_settled: "Settled",
    cust_btn_edit_balance: "Edit Balance",
    cust_btn_collect_payment: "Collect Payment",
    cust_no_match: "No customers matching the search.",

    // Dropdowns and placeholders
    select_customer_placeholder: "-- Select Customer --",
    select_product_placeholder: "-- Select Veterinary Product --",
    select_ledger_customer_placeholder: "-- Select Customer for Ledger --",
    select_ledger_region: "Region",

    // Invoice creator and history
    inv_mgmt_title: "Invoices & Operations Management",
    inv_mgmt_subtitle: "Register and edit sales, purchases, returns, and payment receipts",
    inv_tab_new: "New Transaction Form",
    inv_tab_log: "All Transactions Log",
    inv_opt_sales: "Sales Invoice (S)",
    inv_opt_vaxigen: "Vaxigen Company Invoice (V)",
    inv_opt_purchase: "Purchase Invoice (B)",
    inv_opt_return: "Sales Return Invoice (R)",
    inv_opt_payment: "Payment Receipt",
    inv_party_label: "Customer / Supplier",
    inv_region_label: "Customer Geographical Region",
    inv_region_placeholder: "Region automatically filled",
    inv_date_label: "Transaction Date",
    inv_number_label: "Next / Current Invoice Number",
    inv_items_title: "Invoice Items",
    inv_qty: "Quantity",
    inv_item_total: "Item Subtotal",
    pay_details_title: "Payment Receipt Details",
    pay_amount_label: "Amount Received (SAR)",
    pay_amount_placeholder: "Enter amount received to deduct from balance",
    pay_notes_label: "Payment Notes / Receipt No.",
    pay_notes_placeholder: "e.g., Cash, Check No. ...",
    summary_title: "Account Summary",
    inv_subtotal_label: "Subtotal:",
    inv_discount_label: "Additional Cash Discount (SAR)",
    inv_vat_toggle_label: "Value Added Tax (VAT 15%):",
    inv_vat_amount_label: "Tax Amount:",
    inv_grand_label: "Grand Total:",
    search_invoice_placeholder: "Search by customer or invoice number...",
    log_filter_all: "All Transactions",
    log_filter_sales: "General Sales (S) Only",
    log_filter_sales_v: "Vaxigen Company Sales Only",
    log_filter_purchase: "Purchases Only",
    log_filter_return: "Returns Only",
    log_filter_payment: "Payment Receipts Only",
    tbl_details: "Details / Notes",
    invoice_btn_edit: "Edit",
    invoice_btn_delete: "Delete",
    invoice_no_match: "No matching transactions or invoices found.",
    payment_collected_desc: "Cash Receipts",
    invoice_sales_v_label: "Vaxigen Sales Invoice No. ",
    invoice_sales_label: "Veterinary Sales Invoice No. ",
    invoice_return_label: "Sales Return Invoice No. ",
    payment_receipt_label: "Payment Receipt - ",

    // Inventory page
    inv_title: "Inventory & Products Management",
    inv_subtitle: "Track antibiotics, vitamins, and feed additives stock",
    new_product: "New Product",
    search_product_placeholder: "Search by name or code...",
    filter_cat_all: "All Veterinary Categories",
    filter_cat_poultry: "Poultry",
    filter_cat_cattle: "Cattle",
    filter_cat_additives: "Feed Additives",
    filter_status_all: "All Stock Levels",
    filter_status_normal: "Sufficient Stock",
    filter_status_low: "Critical Stock (Below Limit)",
    filter_status_expired: "Expired Stock",

    // Customers page
    cust_title: "Customers & Financial Accounts",
    cust_subtitle: "Distribute customers by region, track opening balances and debts",
    new_customer: "New Customer",
    search_customer_placeholder: "Search by name or farm...",
    filter_region_all: "All Geographical Regions",
    filter_region_west: "Western Region",
    filter_region_center: "Central Region",
    filter_region_south: "Southern Region",
    filter_region_east: "Eastern Region",

    // Ledger page
    led_title: "Customer Account Ledger",
    led_subtitle: "Detailed cumulative statement of financial movements, invoices, and receipts",
    led_select_customer: "Select Customer / Veterinary Farm",
    led_from_date: "From Date",
    led_to_date: "To Date",
    led_print: "Print Ledger / Export PDF",
    led_company_brand: "Veterinary Products Trading & Import Co.",
    led_report_title: "Detailed & Cumulative Customer Ledger",
    cust_name_label: "Customer Name:",
    cust_region_label: "Geographical Region:",
    led_period_label: "Reporting Period:",
    led_debit_hdr: "Debit (Due)",
    led_credit_hdr: "Credit (Paid)",
    led_balance_hdr: "Cumulative Balance (SAR)",
    led_total_debit_label: "Total Debit Movements:",
    led_total_credit_label: "Total Credit Movements:",
    led_final_balance_label: "Final Outstanding Balance:",
    ledger_no_customer_selected: "Please select a customer and period to generate the financial ledger.",
    ledger_initial_balance_title: "Opening Balance (Carried over for selected period)",
    ledger_period_all: "From the beginning",
    ledger_period_from_to: "From {start} to {end}",
    ledger_period_from: "Since {start}",
    ledger_period_to: "Until date {end}",

    // Reports page
    rep_title: "Advanced Reports Center",
    rep_subtitle: "Generate customer pull sheets, product movement logs, and regional sales stats",
    rep_type_label: "Report Type",
    rep_opt_prod_summary: "Detailed Product Movement Report",
    rep_opt_cust_prod_purchases: "Customer Purchases of a Specific Product",
    rep_opt_cust_all_purchases: "Customer Purchases for All Products",
    rep_opt_cust_due_payments: "Monthly Overdue Credit Report",
    rep_select_product: "Select Veterinary Product",
    rep_generate_btn: "Generate Report",
    rep_print_btn: "Print Report / Export PDF",
    rep_export_excel_btn: "Export Report to Excel",
    rep_dept_label: "Veterinary Products Trading & Import Department",
    rep_db_status_label: "Database Status",
    rep_db_status_val: "Connected & Up to Date",
    rep_accountant_signature: "Accountant signature:",
    rep_seal_signature: "Authorized Signature & Stamp:",
    rep_empty_title: "Active Financial & Management Reporting",
    rep_empty_desc: "Please select the report type, filter the product and customer, set the reporting period, and click 'Generate Report' to view the breakdown.",
    rep_err_select_product: "Please select a veterinary product to generate the movement report.",
    rep_err_select_cust_prod: "Please select both a customer and a product.",
    rep_err_select_customer: "Please select a customer to view their overall purchases.",
    rep_gen_date: "Generation Date: ",
    rep_period_all: "Full historical period",
    rep_period_from_to: "Period from {start} to {end}",
    rep_period_from: "From date {start}",
    rep_period_to: "Until date {end}",
    rep_title_prod_summary: "Detailed Veterinary Product Movement",
    rep_label_target_prod: "Target Product",
    rep_label_target_cust: "Target Customer",
    rep_kpi_total_sales_qty: "Total Sales Qty",
    rep_kpi_avg_sell_price: "Avg Selling Price in Period",
    rep_kpi_total_purchases_qty: "Total Purchases Qty",
    rep_kpi_total_returns_qty: "Total Returns Qty",
    rep_kpi_net_movement: "Net Period Movement",
    rep_kpi_stock_value: "Current Stock / Expected Value",
    rep_no_movement_prod: "No movements registered for this product during the selected period.",
    rep_title_cust_prod_purchases: "Customer Purchases of Specific Product",
    rep_kpi_total_purchased_qty: "Total Qty Purchased",
    rep_kpi_invoices_count: "Invoices Issued",
    rep_kpi_total_purchased_val: "Total Purchased Cash (Excl. VAT)",
    rep_kpi_vat_amount: "Value Added Tax (VAT) Amount",
    rep_kpi_avg_buy_price: "Average Buy Price (Excl. VAT)",
    rep_no_movement_cust_prod: "This customer has not purchased this product during the selected period.",
    rep_total_purchases_prod_footer: "Total Purchases for this Product (Excl. VAT)",
    rep_title_cust_all_purchases: "Customer Purchases of All Products",
    rep_kpi_invoices_total_period: "Total Invoices in Period",
    rep_kpi_distinct_products: "Total Distinct Products",
    rep_kpi_total_quantities: "Total Quantities Purchased (Units)",
    rep_kpi_region: "Customer Region",
    rep_no_movement_cust_all: "No purchases registered for this customer during the selected period.",
    rep_unknown_product: "Unknown Product",
    rep_total_purchases_all_footer: "Overall Total Purchases Cash Value (Excl. VAT)",

    // Settings page
    set_title: "System Settings & Database Backup",
    set_subtitle: "Manage local storage database, import/export, and reset settings",
    set_export_title: "Export & Backup Database",
    set_export_desc: "You can export all transactions, sales invoices, purchases, returns, edited opening balances, and customer details into a single secure file. Regular backups are recommended.",
    set_export_btn: "Export Database (JSON)",
    set_import_title: "Import & Restore Database",
    set_import_desc: "Upload a previously exported JSON backup file to restore all data. Warning: This action will completely overwrite all current database entries.",
    set_import_btn: "Choose Backup File & Restore",
    set_excel_export_title: "Export Data to Microsoft Excel",
    set_excel_export_desc: "You can export products, customers, or the entire transaction log into Excel-ready CSV files (properly encoded for Arabic characters) for statistical analysis.",
    set_excel_export_prod: "Export Veterinary Products to Excel",
    set_excel_export_cust: "Export Customers & Farms to Excel",
    set_excel_export_tx: "Export Transaction History to Excel",
    set_excel_import_title: "Import Data from Microsoft Excel",
    set_excel_import_desc: "Prepare your products or customers list in Excel, save it as a CSV (UTF-8 encoded) file, and upload it here to merge or update the local database instantly.",
    set_excel_import_type: "Select Imported Data Type",
    set_excel_opt_prod: "Veterinary Products (New products list or update)",
    set_excel_opt_cust: "Customers & Farms (New customer list)",
    set_excel_import_btn: "Upload CSV & Merge Instantly",
    set_excel_note_title: "Important Note:",
    set_excel_note_desc: "The uploaded CSV file must contain the exact column headers to be read successfully.",
    set_num_title: "Invoice & Operation Numbering Controls",
    set_num_desc: "If you deleted an invoice or transaction by mistake and want to adjust or restore the auto-incrementing serial sequence for the next transaction, edit the values below.",
    set_num_sales: "Next General Sales (S)",
    set_num_sales_v: "Next Vaxigen Sales (V)",
    set_num_purchase: "Next Purchase (B)",
    set_num_return: "Next Return (R)",
    set_num_payment: "Next Payment Receipt",
    set_num_btn: "Save Next Serial Numbers",
    set_reset_title: "Reset System to Default Database",
    set_reset_desc: "If you want to clear all current transactions and reset the customer and product database back to the default initial values extracted from Excel, click the reset button below.",
    set_reset_btn: "Reset & Re-initialize System Completely",

    // Modals
    prod_modal_add_title: "Add New Veterinary Product",
    prod_modal_edit_title: "Edit Opening Stock & Product Info",
    prod_code_label: "Product Code (Unique)",
    prod_code_placeholder: "e.g., 1020",
    prod_name_label: "Veterinary Product Name",
    prod_name_placeholder: "e.g., MULTIVIT VET",
    prod_category_label: "Veterinary Category",
    prod_unit_label: "Commercial Unit",
    prod_unit_placeholder: "e.g., Liter, KG, 100 ML",
    prod_initial_stock_label: "Opening Stock (Initial Quantity)",
    prod_reorder_limit_label: "Reorder Limit (Warning)",
    prod_expiry_label: "Expiration Date",
    prod_price_sell_label: "Default Selling Price (SAR)",
    prod_price_buy_label: "Default Buying Price (SAR)",
    btn_cancel: "Cancel",
    prod_btn_save: "Save Product Details",

    cust_modal_add_title: "Add New Customer / Farm",
    cust_modal_edit_title: "Edit Customer Info & Opening Balance",
    cust_name_label_modal: "Full Customer / Veterinary Farm Name",
    cust_name_placeholder: "e.g., Al-Rawdah Poultry Production Farm",
    cust_region_label_modal: "Assigned Geographical Region",
    cust_phone_label_modal: "Contact Mobile Number",
    cust_phone_placeholder: "e.g., 0500000000",
    cust_balance_label_modal: "Customer Opening Balance (SAR)",
    cust_email_label_modal: "Email Address",
    cust_btn_save: "Save Customer Details"
  }
};

function t(key) {
  // إذا كانت هناك مسميات مخصصة للتبويبات/القوائم من قبل المستخدم، نستخدمها أولاً
  if (state.menuNames && state.menuNames[key]) {
    return state.menuNames[key];
  }
  // ديناميكية اسم التطبيق في الفوتر
  if (key === 'sidebar_footer_app') {
    return `نظام ${state.appName || 'VetStock'} الإحترافي v1.0`;
  }
  // العودة دائماً للغة العربية لضمان استقرار الواجهات التفاعلية والحسابات
  if (translations['ar'] && translations['ar'][key]) {
    return translations['ar'][key];
  }
  return key;
}

function applyLanguage(lang) {
  // فرض اللغة العربية واتجاه اليمين لليسار دائماً لثبات النظام
  state.currentLang = 'ar';
  document.body.setAttribute('dir', 'rtl');

  // Translate static data-translate elements
  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.getAttribute('data-translate');
    const trans = t(key);
    if (trans && trans !== key) {
      el.innerText = trans;
    }
  });

  // Translate placeholders
  document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
    const key = el.getAttribute('data-translate-placeholder');
    const trans = t(key);
    if (trans && trans !== key) {
      el.setAttribute('placeholder', trans);
    }
  });
}

function toggleLanguage() {
  // تم إيقاف تبديل اللغة لضمان استقرار العمليات باللغة العربية حصرياً
}

// تشغيل التطبيق رسمياً عند فتح المتصفح
window.addEventListener('DOMContentLoaded', initApp);


