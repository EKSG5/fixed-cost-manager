"use strict";

const STORAGE_KEYS = { subscriptions: "subscription-manager.items.v1", rate: "subscription-manager.usd-jpy.v1", categories: "subscription-manager.categories.v1", paymentMethods: "subscription-manager.payment-methods.v1", candidatesMigrated: "subscription-manager.candidates-migrated.v1", paymentDefaultsMigrated: "subscription-manager.payment-defaults-migrated.v1" };
const DEFAULT_RATE = 150;
const DEFAULT_CATEGORIES = ["生活", "仕事", "娯楽"];
const DEFAULT_PAYMENT_METHODS = ["カード", "銀行振込"];
const RESERVED_CATEGORIES = ["未分類"];
const COLORS = ["#2F675D", "#D89A55", "#6F93B7", "#A786B8", "#8DAA91", "#C87A74", "#9FAE68", "#5F9690"];

const $ = (id) => document.getElementById(id);
const elements = {
  list: $("subscription-list"), count: $("item-count"), monthlyTotal: $("monthly-total"), yearlyTotal: $("yearly-total"),
  categorySummary: $("category-summary"), rateInput: $("exchange-rate"), rateForm: $("rate-form"), rateMessage: $("rate-message"),
  dialog: $("subscription-dialog"), form: $("subscription-form"), formTitle: $("form-title"), formError: $("form-error"),
  id: $("subscription-id"), name: $("service-name"), price: $("price"), currency: $("currency"), cycle: $("cycle"),
  renewal: $("next-renewal"), payment: $("payment-method"), category: $("category"),
  backupButton: $("backup-button"), restoreButton: $("restore-button"), restoreFile: $("restore-file"),
  csvButton: $("csv-button"), dataMessage: $("data-message"), settingsDialog: $("settings-dialog"),
  listTab: $("list-tab"), categoryTab: $("category-tab"), listPanel: $("list-panel"),
  categoryPanel: $("category-panel"), fab: $("open-form-button"),
  monthlyPeriod: $("monthly-period"), yearlyPeriod: $("yearly-period"), categoryFilter: $("category-filter"),
  categoryOptions: $("category-options"), paymentMethodOptions: $("payment-method-options"),
  candidateDialog: $("candidate-dialog"), categoryCandidateList: $("category-candidate-list"), paymentCandidateList: $("payment-candidate-list"),
  readmeDialog: $("readme-dialog")
};

let subscriptions = loadSubscriptions();
let exchangeRate = loadRate();
let categoryPeriod = "monthly";
let selectedCategory = "";
let savedCategories = loadSavedCategories();
let savedPaymentMethods = loadSavedPaymentMethods();
const expandedCategoryNames = new Set();
migrateExistingCandidatesOnce();
migrateOldPaymentDefaultOnce();

function loadSubscriptions() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.subscriptions) || "[]");
    return Array.isArray(value) ? value.filter(isValidSubscription) : [];
  } catch { return []; }
}

function isValidSubscription(item) {
  return item && typeof item.id === "string" && typeof item.name === "string" && Number.isFinite(Number(item.price)) &&
    ["JPY", "USD"].includes(item.currency) && ["monthly", "yearly"].includes(item.cycle);
}

function loadRate() {
  const value = Number(localStorage.getItem(STORAGE_KEYS.rate));
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RATE;
}

function saveSubscriptions() { localStorage.setItem(STORAGE_KEYS.subscriptions, JSON.stringify(subscriptions)); }
function loadSavedCategories() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.categories) || "[]"); return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).filter((item) => !DEFAULT_CATEGORIES.includes(item) && !RESERVED_CATEGORIES.includes(item)))] : []; }
  catch { return []; }
}
function saveCategory(category) {
  const value = category.trim(); if (!value || DEFAULT_CATEGORIES.includes(value) || RESERVED_CATEGORIES.includes(value) || savedCategories.includes(value)) return;
  savedCategories.push(value); localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(savedCategories));
}
function updateCategoryOptions() {
  renderInputCandidates(elements.category, elements.categoryOptions, [...DEFAULT_CATEGORIES, ...savedCategories]);
}
function loadSavedPaymentMethods() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.paymentMethods) || "[]"); return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))] : []; }
  catch { return []; }
}
function savePaymentMethod(paymentMethod) {
  const value = paymentMethod.trim(); if (!value || DEFAULT_PAYMENT_METHODS.includes(value) || savedPaymentMethods.includes(value)) return;
  savedPaymentMethods.push(value); localStorage.setItem(STORAGE_KEYS.paymentMethods, JSON.stringify(savedPaymentMethods));
}
function updatePaymentMethodOptions() {
  renderInputCandidates(elements.payment, elements.paymentMethodOptions, [...DEFAULT_PAYMENT_METHODS, ...savedPaymentMethods]);
}

function candidateValues(input) {
  return input === elements.category
    ? [...DEFAULT_CATEGORIES, ...savedCategories]
    : [...DEFAULT_PAYMENT_METHODS, ...savedPaymentMethods];
}

function renderInputCandidates(input, panel, values = candidateValues(input)) {
  const query = input.value.trim().toLocaleLowerCase("ja");
  const filtered = [...new Set(values)].filter((value) => !query || value.toLocaleLowerCase("ja").includes(query));
  panel.replaceChildren();
  filtered.forEach((value) => {
    const option = make("button", "input-candidate-option", value); option.type = "button"; option.setAttribute("role", "option");
    option.addEventListener("pointerdown", (event) => event.preventDefault());
    option.addEventListener("click", () => { input.value = value; input.focus({ preventScroll: true }); closeInputCandidates(); });
    panel.append(option);
  });
  if (!panel.hidden) {
    panel.hidden = filtered.length === 0;
    input.setAttribute("aria-expanded", String(filtered.length > 0));
  }
}

function openInputCandidates(input, panel) {
  closeInputCandidates(); renderInputCandidates(input, panel);
  const hasOptions = panel.childElementCount > 0; panel.hidden = !hasOptions; input.setAttribute("aria-expanded", String(hasOptions));
}

function closeInputCandidates() {
  [[elements.category, elements.categoryOptions], [elements.payment, elements.paymentMethodOptions]].forEach(([input, panel]) => {
    panel.hidden = true; input.setAttribute("aria-expanded", "false");
  });
}
function migrateExistingCandidatesOnce() {
  if (localStorage.getItem(STORAGE_KEYS.candidatesMigrated) === "1") return;
  const categories = subscriptions.map((item) => typeof item.category === "string" ? item.category.trim() : "").filter((item) => item && !DEFAULT_CATEGORIES.includes(item));
  const paymentMethods = subscriptions.map((item) => typeof item.paymentMethod === "string" ? item.paymentMethod.trim() : "").filter((item) => item && !DEFAULT_PAYMENT_METHODS.includes(item));
  savedCategories = [...new Set([...savedCategories, ...categories])];
  savedPaymentMethods = [...new Set([...savedPaymentMethods, ...paymentMethods])];
  localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(savedCategories));
  localStorage.setItem(STORAGE_KEYS.paymentMethods, JSON.stringify(savedPaymentMethods));
  localStorage.setItem(STORAGE_KEYS.candidatesMigrated, "1");
}
function migrateOldPaymentDefaultOnce() {
  if (localStorage.getItem(STORAGE_KEYS.paymentDefaultsMigrated) === "1") return;
  const oldDefault = "銀行引き落とし";
  const isUsed = subscriptions.some((item) => typeof item.paymentMethod === "string" && item.paymentMethod.trim() === oldDefault);
  if (isUsed && !savedPaymentMethods.includes(oldDefault)) {
    savedPaymentMethods.push(oldDefault); localStorage.setItem(STORAGE_KEYS.paymentMethods, JSON.stringify(savedPaymentMethods));
  }
  localStorage.setItem(STORAGE_KEYS.paymentDefaultsMigrated, "1");
}
function renderCandidateManager() {
  renderCandidateGroup(elements.categoryCandidateList, DEFAULT_CATEGORIES, savedCategories, "category");
  renderCandidateGroup(elements.paymentCandidateList, DEFAULT_PAYMENT_METHODS, savedPaymentMethods, "payment");
}
function renderCandidateGroup(container, defaults, customValues, type) {
  container.replaceChildren();
  defaults.forEach((value) => {
    const row = make("div", "candidate-item"); row.append(make("span", "candidate-name", value), make("span", "standard-badge", "標準")); container.append(row);
  });
  customValues.forEach((value) => {
    const row = make("div", "candidate-item"); const remove = make("button", "candidate-delete", "削除"); remove.type = "button";
    remove.setAttribute("aria-label", `${value}を入力候補から削除`); remove.addEventListener("click", () => removeCandidate(type, value));
    row.append(make("span", "candidate-name", value), remove); container.append(row);
  });
}
function removeCandidate(type, value) {
  const usageCount = candidateUsageCount(type, value);
  if (usageCount > 0) {
    const label = type === "category" ? "カテゴリ" : "支払方法";
    window.alert(`この${label}は${usageCount}件のサービスで使用中のため削除できません。`); return;
  }
  if (!window.confirm(`「${value}」を入力候補から削除しますか？\n登録済みサービスのデータは変更されません。`)) return;
  if (type === "category") {
    savedCategories = savedCategories.filter((item) => item !== value);
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(savedCategories)); updateCategoryOptions();
  } else {
    savedPaymentMethods = savedPaymentMethods.filter((item) => item !== value);
    localStorage.setItem(STORAGE_KEYS.paymentMethods, JSON.stringify(savedPaymentMethods)); updatePaymentMethodOptions();
  }
  renderCandidateManager();
}
function candidateUsageCount(type, value) {
  const property = type === "category" ? "category" : "paymentMethod";
  return subscriptions.filter((item) => typeof item[property] === "string" && item[property].trim() === value.trim()).length;
}
function yen(value) { return `${Math.round(value).toLocaleString("ja-JP")}円`; }
function originalPrice(item) { return item.currency === "JPY" ? `${Number(item.price).toLocaleString("ja-JP")}円` : `$${Number(item.price).toLocaleString("en-US")}`; }
function originalPriceWithCycle(item) { return `${originalPrice(item)} / ${item.cycle === "monthly" ? "月" : "年"}`; }
function baseYen(item) { return Number(item.price) * (item.currency === "USD" ? exchangeRate : 1); }
function amounts(item) {
  const base = baseYen(item);
  return item.cycle === "monthly" ? { monthly: base, yearly: base * 12 } : { monthly: base / 12, yearly: base };
}
function categoryServicePrice(item) {
  return `${yen(amounts(item)[categoryPeriod])} / ${categoryPeriod === "monthly" ? "月" : "年"}`;
}
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContentでユーザー入力のXSSを防ぐ
  return node;
}

function makeIconButton(label, pathData, className = "") {
  const button = make("button", `card-action icon-action ${className}`.trim()); button.type = "button"; button.setAttribute("aria-label", label); button.title = label;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", pathData); svg.append(path); button.append(svg); return button;
}
function categoryName(item) { return typeof item.category === "string" && item.category.trim() ? item.category.trim() : "未分類"; }
function categoryColor(name) {
  let hash = 0;
  for (const character of name) hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}
function createCategoryColorMap(categories) {
  const colorMap = new Map(); const usedIndexes = new Set();
  [...categories].map(([name]) => name).sort((a, b) => a.localeCompare(b, "ja")).forEach((name) => {
    let index = COLORS.indexOf(categoryColor(name));
    if (usedIndexes.size < COLORS.length) while (usedIndexes.has(index)) index = (index + 1) % COLORS.length;
    usedIndexes.add(index); colorMap.set(name, COLORS[index]);
  });
  return colorMap;
}

function getCategoryTotals() {
  const totals = new Map();
  subscriptions.forEach((item) => {
    const category = categoryName(item);
    const current = totals.get(category) || { monthly: 0, yearly: 0 };
    const calculated = amounts(item);
    current.monthly += calculated.monthly;
    current.yearly += calculated.yearly;
    totals.set(category, current);
  });
  return [...totals.entries()].sort((a, b) => b[1].monthly - a[1].monthly);
}

function render() {
  updateCategoryOptions();
  updatePaymentMethodOptions();
  updateCategoryFilter();
  renderSubscriptions();
  renderCategories();
}

function renderListTotals(items) {
  const calculated = items.map(amounts);
  elements.monthlyTotal.textContent = yen(calculated.reduce((sum, value) => sum + value.monthly, 0));
  elements.yearlyTotal.textContent = yen(calculated.reduce((sum, value) => sum + value.yearly, 0));
}

function renderSubscriptions() {
  elements.list.replaceChildren();
  const filtered = selectedCategory ? subscriptions.filter((item) => categoryName(item) === selectedCategory) : subscriptions;
  renderListTotals(filtered);
  if (subscriptions.length === 0) {
    elements.count.textContent = "0件";
    const empty = make("div", "empty-state");
    empty.append(make("strong", "", "まだ登録がありません"), make("p", "", "「＋ 追加」から最初のサブスクリプションを登録してください。"));
    elements.list.append(empty);
    return;
  }
  elements.count.textContent = `${filtered.length}件`;
  if (filtered.length === 0) {
    elements.list.append(make("div", "empty-state", "このカテゴリには登録中のサービスがありません。"));
    return;
  }
  const sorted = [...filtered].sort((a, b) => effectiveRenewalDate(a).localeCompare(effectiveRenewalDate(b)));
  sorted.forEach((item) => elements.list.append(createSubscriptionCard(item)));
}

function updateCategoryFilter() {
  const categories = [...new Set(subscriptions.map(categoryName))].sort((a, b) => a.localeCompare(b, "ja"));
  if (selectedCategory && !categories.includes(selectedCategory)) selectedCategory = "";
  elements.categoryFilter.replaceChildren();
  const all = make("option", "", "すべて"); all.value = ""; elements.categoryFilter.append(all);
  categories.forEach((category) => { const option = make("option", "", category); option.value = category; elements.categoryFilter.append(option); });
  elements.categoryFilter.value = selectedCategory;
}

function createSubscriptionCard(item) {
  const card = make("article", "subscription-card");
  const top = make("button", "card-top"); top.type = "button"; top.setAttribute("aria-expanded", "false");
  const titleArea = make("div");
  titleArea.append(make("h3", "", item.name), make("span", "category-badge", categoryName(item)));
  const priceArea = make("div", "compact-meta");
  priceArea.append(make("strong", "registered-price", originalPriceWithCycle(item)), make("span", "renewal-date", `次回 ${formatCompactDate(effectiveRenewalDate(item))}`));
  const chevron = make("span", "chevron", "⌄"); chevron.setAttribute("aria-hidden", "true");
  top.append(titleArea, priceArea, chevron);
  const value = amounts(item);
  const expanded = make("div", "card-expanded"); expanded.hidden = true;
  const conversion = make("div", "conversion-grid");
  [["月額換算", yen(value.monthly)], ["年額換算", yen(value.yearly)]].forEach(([label, amount]) => {
    const box = make("div"); box.append(make("span", "", label), make("strong", "", amount)); conversion.append(box);
  });
  const details = make("dl", "details");
  [["入力料金", originalPriceWithCycle(item)], ["更新周期", item.cycle === "monthly" ? "毎月" : "毎年"], ["次回更新日", formatDate(effectiveRenewalDate(item))], ["支払方法", item.paymentMethod || "未設定"]].forEach(([term, description]) => {
    const row = make("div"); row.append(make("dt", "", term), make("dd", "", description)); details.append(row);
  });
  const actions = make("div", "card-actions");
  const edit = makeIconButton("編集", "M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5ZM16 4.5l3.5 3.5 1-1a1.4 1.4 0 0 0 0-2L18.5 3a1.4 1.4 0 0 0-2 0l-.5 1.5Z"); edit.addEventListener("click", () => openForm(item));
  const remove = makeIconButton("削除", "M7 20a2 2 0 0 1-2-2V7h14v11a2 2 0 0 1-2 2H7Zm2-10v7h2v-7H9Zm4 0v7h2v-7h-2ZM4 4h5l1-1h4l1 1h5v2H4V4Z", "danger"); remove.addEventListener("click", () => removeSubscription(item.id));
  actions.append(edit, remove); expanded.append(conversion, details, actions); card.append(top, expanded);
  top.addEventListener("click", () => { const open = top.getAttribute("aria-expanded") !== "true"; top.setAttribute("aria-expanded", String(open)); expanded.hidden = !open; card.classList.toggle("expanded", open); });
  return card;
}

function daysInMonth(year, monthIndex) { return new Date(year, monthIndex + 1, 0).getDate(); }
function anchoredDate(year, monthIndex, day) { return new Date(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex))); }
function localDateString(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

function effectiveRenewalDate(item, now = new Date()) {
  const parts = String(item.nextRenewal || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return item.nextRenewal || "";
  const [baseYear, baseMonth, baseDay] = parts; const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let candidate;
  if (item.cycle === "yearly") {
    let year = Math.max(baseYear, today.getFullYear()); candidate = anchoredDate(year, baseMonth - 1, baseDay);
    if (candidate < today) candidate = anchoredDate(year + 1, baseMonth - 1, baseDay);
  } else {
    let monthOffset = Math.max(0, (today.getFullYear() - baseYear) * 12 + today.getMonth() - (baseMonth - 1));
    candidate = anchoredDate(baseYear, baseMonth - 1 + monthOffset, baseDay);
    if (candidate < today) candidate = anchoredDate(baseYear, baseMonth + monthOffset, baseDay);
  }
  return localDateString(candidate);
}

function formatCompactDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "未設定";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric", weekday: "short" }).format(date);
}

function renderCategories() {
  const categories = getCategoryTotals();
  const colorMap = createCategoryColorMap(categories);
  const visibleCategories = categories.filter(([, value]) => value[categoryPeriod] > 0);
  const total = visibleCategories.reduce((sum, [, value]) => sum + value[categoryPeriod], 0);
  elements.categorySummary.replaceChildren();
  if (categories.length === 0) elements.categorySummary.append(make("p", "empty-state", "登録するとカテゴリ別の集計とグラフが表示されます。"));
  visibleCategories.forEach(([name, value]) => {
    const item = make("div", "category-breakdown");
    const row = make("button", "category-row"); row.type = "button";
    const isExpanded = expandedCategoryNames.has(name);
    row.setAttribute("aria-expanded", String(isExpanded));
    const dot = make("span", "category-color"); dot.style.backgroundColor = colorMap.get(name);
    const metrics = make("span", "category-metrics");
    metrics.append(
      make("span", "category-amount", `${yen(value[categoryPeriod])} / ${categoryPeriod === "monthly" ? "月" : "年"}`),
      make("span", "category-percentage", `${total > 0 ? (value[categoryPeriod] / total * 100).toFixed(1) : "0.0"}%`)
    );
    const chevron = make("span", "category-chevron", "⌄"); chevron.setAttribute("aria-hidden", "true");
    row.append(dot, make("strong", "", name), metrics, chevron);
    const services = make("div", "category-services"); services.hidden = !isExpanded;
    subscriptions.filter((subscription) => categoryName(subscription) === name).forEach((subscription) => {
      const service = make("div", "category-service");
      service.append(make("strong", "", subscription.name), make("span", "", categoryServicePrice(subscription)));
      services.append(service);
    });
    row.addEventListener("click", () => {
      const open = row.getAttribute("aria-expanded") !== "true";
      row.setAttribute("aria-expanded", String(open)); services.hidden = !open;
      if (open) expandedCategoryNames.add(name); else expandedCategoryNames.delete(name);
    });
    item.append(row, services); elements.categorySummary.append(item);
  });
  const canvas = $("category-chart");
  canvas.setAttribute("aria-label", `カテゴリ別${categoryPeriod === "monthly" ? "月額換算" : "年間総額"}の円グラフ`);
  drawChart(canvas, categories, categoryPeriod, colorMap);
}

// 外部ライブラリなしのため、PWAをオフラインで開いても円グラフを描画できる。
function drawChart(canvas, categories, key, colorMap) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = 360; const height = 360; const centerX = 180; const centerY = 180; const radius = 88; const ringWidth = 48;
  canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const visible = categories.filter(([, value]) => value[key] > 0);
  const total = visible.reduce((sum, [, value]) => sum + value[key], 0);
  if (!total) {
    ctx.strokeStyle = "#dbe4e0"; ctx.lineWidth = ringWidth; ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#64746f"; ctx.font = "14px system-ui"; ctx.textAlign = "center"; ctx.fillText("データなし", centerX, centerY + 5); return;
  }
  let start = -Math.PI / 2; const labels = [];
  visible.forEach(([name, value], index) => {
    const angle = value[key] / total * Math.PI * 2;
    const middle = start + angle / 2; const percentage = value[key] / total * 100;
    const color = colorMap.get(name);
    ctx.beginPath(); ctx.arc(centerX, centerY, radius, start + 0.008, start + angle - 0.008); ctx.strokeStyle = color; ctx.lineWidth = ringWidth; ctx.lineCap = "butt"; ctx.stroke();
    labels.push({ name, percentage, middle, inside: percentage >= 8, color }); start += angle;
  });
  ctx.fillStyle = "#19302b"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "600 14px system-ui"; ctx.fillText(key === "monthly" ? "月額合計" : "年額合計", centerX, centerY - 12);
  ctx.font = "750 17px system-ui"; ctx.fillText(yen(total), centerX, centerY + 14);
  drawChartLabels(ctx, labels, centerX, centerY, radius, ringWidth, width, height);
}

function shortLabel(name, max = 7) { return name.length > max ? `${name.slice(0, max)}…` : name; }

function drawChartLabels(ctx, labels, centerX, centerY, radius, ringWidth, width, height) {
  ctx.font = "700 12px system-ui"; ctx.lineJoin = "round";
  labels.filter((label) => label.inside).forEach((label) => {
    const x = centerX + Math.cos(label.middle) * radius; const y = centerY + Math.sin(label.middle) * radius;
    const text = `${shortLabel(label.name, 5)} ${label.percentage.toFixed(0)}%`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(25,48,43,.48)"; ctx.strokeText(text, x, y); ctx.fillStyle = "#fff"; ctx.fillText(text, x, y);
  });
  ["left", "right"].forEach((side) => {
    const labelRadius = radius + ringWidth / 2 + 30;
    const smallLabels = labels.filter((label) => !label.inside && (Math.cos(label.middle) < 0 ? "left" : "right") === side)
      .map((label) => ({ ...label, targetX: centerX + Math.cos(label.middle) * labelRadius, targetY: centerY + Math.sin(label.middle) * labelRadius }))
      .sort((a, b) => a.targetY - b.targetY);
    const gap = 19; const top = 14; const bottom = height - 14;
    smallLabels.forEach((label, index) => { label.y = Math.max(top, index ? Math.max(label.targetY, smallLabels[index - 1].y + gap) : label.targetY); });
    for (let index = smallLabels.length - 1; index >= 0; index -= 1) labelPositionWithinBounds(smallLabels, index, gap, top, bottom);
    smallLabels.forEach((label) => drawFloatingLabel(ctx, label, side, width));
  });
}

function labelPositionWithinBounds(labels, index, gap, top, bottom) {
  const nextLimit = index < labels.length - 1 ? labels[index + 1].y - gap : bottom;
  labels[index].y = Math.max(top, Math.min(labels[index].y, nextLimit));
}

function drawFloatingLabel(ctx, label, side, width) {
  const text = `${shortLabel(label.name, 6)} ${label.percentage.toFixed(1)}%`; ctx.font = "700 11.5px system-ui";
  const groupWidth = 14 + ctx.measureText(text).width; let x = side === "left" ? label.targetX - groupWidth : label.targetX;
  x = Math.max(6, Math.min(x, width - groupWidth - 6));
  ctx.fillStyle = label.color; ctx.fillRect(x, label.y - 5, 10, 10);
  ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.72)"; ctx.strokeText(text, x + 14, label.y);
  ctx.fillStyle = "#19302b"; ctx.fillText(text, x + 14, label.y);
}

function selectCategoryPeriod(period, moveFocus = false) {
  categoryPeriod = period;
  const isMonthly = period === "monthly";
  elements.monthlyPeriod.classList.toggle("active", isMonthly);
  elements.yearlyPeriod.classList.toggle("active", !isMonthly);
  elements.monthlyPeriod.setAttribute("aria-selected", String(isMonthly));
  elements.yearlyPeriod.setAttribute("aria-selected", String(!isMonthly));
  elements.monthlyPeriod.tabIndex = isMonthly ? 0 : -1;
  elements.yearlyPeriod.tabIndex = isMonthly ? -1 : 0;
  renderCategories();
  if (moveFocus) (isMonthly ? elements.monthlyPeriod : elements.yearlyPeriod).focus();
}

function openForm(item = null) {
  elements.form.reset(); elements.formError.textContent = "";
  updateCategoryOptions(); updatePaymentMethodOptions(); closeInputCandidates();
  elements.formTitle.textContent = item ? "サブスクリプションを編集" : "サブスクリプションを追加";
  elements.id.value = item?.id || ""; elements.name.value = item?.name || ""; elements.price.value = item?.price ?? "";
  elements.currency.value = item?.currency || "JPY"; elements.cycle.value = item?.cycle || "monthly";
  elements.renewal.value = item?.nextRenewal || todayString(); elements.payment.value = item?.paymentMethod || ""; elements.category.value = item?.category || "";
  elements.dialog.showModal(); setTimeout(() => elements.name.focus(), 0);
}
function todayString() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function closeForm() { closeInputCandidates(); elements.dialog.close(); }

function submitSubscription(event) {
  event.preventDefault();
  const price = Number(elements.price.value); const category = elements.category.value.trim(); const name = elements.name.value.trim();
  if (!name || !Number.isFinite(price) || price < 0 || !elements.renewal.value) { elements.formError.textContent = "必須項目と料金を正しく入力してください。"; return; }
  const id = elements.id.value || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const item = { id, name, price, currency: elements.currency.value, cycle: elements.cycle.value, nextRenewal: elements.renewal.value, paymentMethod: elements.payment.value.trim(), category };
  const index = subscriptions.findIndex((entry) => entry.id === id);
  if (index >= 0) subscriptions[index] = item; else subscriptions.push(item);
  saveCategory(category); savePaymentMethod(item.paymentMethod); saveSubscriptions(); closeForm(); render();
}

function removeSubscription(id) {
  const item = subscriptions.find((entry) => entry.id === id);
  if (!item || !window.confirm(`「${item.name}」を本当に削除しますか？`)) return;
  subscriptions = subscriptions.filter((entry) => entry.id !== id); saveSubscriptions(); render();
}

const tabScrollPositions = { list: 0, category: 0 };
let activeTab = "list";

function selectTab(tabName, moveFocus = false) {
  if (tabName === activeTab) return;
  tabScrollPositions[activeTab] = window.scrollY;
  activeTab = tabName;
  const isList = tabName === "list";
  elements.listPanel.hidden = !isList;
  elements.categoryPanel.hidden = isList;
  elements.fab.hidden = !isList;
  elements.listTab.classList.toggle("active", isList);
  elements.categoryTab.classList.toggle("active", !isList);
  elements.listTab.setAttribute("aria-selected", String(isList));
  elements.categoryTab.setAttribute("aria-selected", String(!isList));
  elements.listTab.tabIndex = isList ? 0 : -1;
  elements.categoryTab.tabIndex = isList ? -1 : 0;
  if (!isList) renderCategories();
  requestAnimationFrame(() => {
    window.scrollTo({ top: tabScrollPositions[tabName], behavior: "auto" });
    if (moveFocus) (isList ? elements.listTab : elements.categoryTab).focus();
  });
}

function dateForFilename() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function downloadFile(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function showDataMessage(message, isError = false) {
  elements.dataMessage.textContent = message;
  elements.dataMessage.classList.toggle("error", isError);
}

function saveBackup() {
  const backup = { version: 1, createdAt: new Date().toISOString(), subscriptions, exchangeRate, categories: savedCategories, paymentMethods: savedPaymentMethods };
  downloadFile(JSON.stringify(backup, null, 2), "application/json;charset=utf-8", `tanusuku-backup-${dateForFilename()}.json`);
  showDataMessage("バックアップを保存しました。");
}

function isValidBackupItem(item) {
  return isValidSubscription(item) && Number(item.price) >= 0 && typeof item.nextRenewal === "string" &&
    typeof item.category === "string" && (item.paymentMethod === undefined || typeof item.paymentMethod === "string");
}

async function restoreBackup(event) {
  const file = event.target.files[0];
  event.target.value = ""; // 同じファイルを続けて選べるようにする
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    const restoredRate = Number(backup?.exchangeRate);
    if (!backup || typeof backup !== "object" || backup.version !== 1 || typeof backup.createdAt !== "string" || !Array.isArray(backup.subscriptions) ||
        !backup.subscriptions.every(isValidBackupItem) || !Number.isFinite(restoredRate) || restoredRate <= 0) {
      throw new Error("必要なデータが不足しているか、形式が正しくありません。");
    }
    if (backup.categories !== undefined && (!Array.isArray(backup.categories) || !backup.categories.every((item) => typeof item === "string"))) {
      throw new Error("カテゴリ候補の形式が正しくありません。");
    }
    if (backup.paymentMethods !== undefined && (!Array.isArray(backup.paymentMethods) || !backup.paymentMethods.every((item) => typeof item === "string"))) {
      throw new Error("支払方法候補の形式が正しくありません。");
    }
    if (!window.confirm("現在のデータをバックアップファイルの内容で置き換えます。よろしいですか？")) {
      showDataMessage("復元をキャンセルしました。"); return;
    }
    // 検証と確認が完了した後にだけ、現在データを書き換える。
    subscriptions = backup.subscriptions.map((item) => ({ ...item }));
    exchangeRate = restoredRate;
    const restoredCategories = subscriptions.map((item) => typeof item.category === "string" ? item.category.trim() : "").filter(Boolean);
    const restoredPaymentMethods = subscriptions.map((item) => typeof item.paymentMethod === "string" ? item.paymentMethod.trim() : "").filter(Boolean);
    savedCategories = [...new Set((backup.categories || restoredCategories).map((item) => item.trim()).filter((item) => item && !DEFAULT_CATEGORIES.includes(item) && !RESERVED_CATEGORIES.includes(item)))];
    savedPaymentMethods = [...new Set((backup.paymentMethods || restoredPaymentMethods).map((item) => item.trim()).filter((item) => item && !DEFAULT_PAYMENT_METHODS.includes(item)))];
    localStorage.setItem(STORAGE_KEYS.subscriptions, JSON.stringify(subscriptions));
    localStorage.setItem(STORAGE_KEYS.rate, String(exchangeRate));
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(savedCategories));
    localStorage.setItem(STORAGE_KEYS.paymentMethods, JSON.stringify(savedPaymentMethods));
    localStorage.setItem(STORAGE_KEYS.candidatesMigrated, "1");
    elements.rateInput.value = exchangeRate;
    render(); showDataMessage("バックアップから復元しました。");
  } catch (error) {
    showDataMessage(`復元できませんでした：${error instanceof SyntaxError ? "JSONファイルとして読み込めません。" : error.message}`, true);
  }
}

function csvCell(value) {
  let text = String(value ?? "");
  // Excelで数式として実行される可能性がある先頭文字を無害化する。
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const headers = ["サービス名", "料金", "通貨", "更新周期", "次回更新日", "支払方法", "カテゴリ", "月額換算額（円）", "年額換算額（円）"];
  const rows = subscriptions.map((item) => {
    const calculated = amounts(item);
    return [item.name, item.price, item.currency, item.cycle === "monthly" ? "毎月" : "毎年", item.nextRenewal,
      item.paymentMethod || "", item.category, Math.round(calculated.monthly), Math.round(calculated.yearly)];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadFile(`\uFEFF${csv}`, "text/csv;charset=utf-8", `tanusuku-list-${dateForFilename()}.csv`);
  showDataMessage("CSVを書き出しました。");
}

elements.rateForm.addEventListener("submit", (event) => {
  event.preventDefault(); const value = Number(elements.rateInput.value);
  if (!Number.isFinite(value) || value <= 0) return;
  exchangeRate = value; localStorage.setItem(STORAGE_KEYS.rate, String(value)); render();
  elements.rateMessage.textContent = `1 USD = ${value.toLocaleString("ja-JP")}円で保存しました。`;
  setTimeout(() => { elements.rateMessage.textContent = ""; }, 2500);
});
$("open-form-button").addEventListener("click", () => openForm());
elements.listTab.addEventListener("click", () => selectTab("list"));
elements.categoryTab.addEventListener("click", () => selectTab("category"));
elements.listTab.addEventListener("keydown", (event) => { if (event.key === "ArrowRight") selectTab("category", true); });
elements.categoryTab.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft") selectTab("list", true); });
elements.monthlyPeriod.addEventListener("click", () => selectCategoryPeriod("monthly"));
elements.yearlyPeriod.addEventListener("click", () => selectCategoryPeriod("yearly"));
elements.monthlyPeriod.addEventListener("keydown", (event) => { if (event.key === "ArrowRight") selectCategoryPeriod("yearly", true); });
elements.yearlyPeriod.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft") selectCategoryPeriod("monthly", true); });
elements.categoryFilter.addEventListener("change", () => { selectedCategory = elements.categoryFilter.value; renderSubscriptions(); });
$("open-menu-button").addEventListener("click", () => elements.settingsDialog.showModal());
$("open-readme").addEventListener("click", () => { elements.settingsDialog.close(); elements.readmeDialog.showModal(); });
$("close-readme").addEventListener("click", () => elements.readmeDialog.close());
$("open-candidate-manager").addEventListener("click", () => { elements.settingsDialog.close(); renderCandidateManager(); elements.candidateDialog.showModal(); });
$("close-candidate-manager").addEventListener("click", () => elements.candidateDialog.close());
$("close-menu-button").addEventListener("click", () => elements.settingsDialog.close());
$("close-form-button").addEventListener("click", closeForm);
$("cancel-button").addEventListener("click", closeForm);
elements.form.addEventListener("submit", submitSubscription);
[[elements.payment, elements.paymentMethodOptions], [elements.category, elements.categoryOptions]].forEach(([input, panel]) => {
  input.addEventListener("focus", () => openInputCandidates(input, panel));
  input.addEventListener("input", () => openInputCandidates(input, panel));
});
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".candidate-combobox")) closeInputCandidates();
});
document.addEventListener("focusin", (event) => {
  if (event.target !== elements.payment && event.target !== elements.category && !event.target.closest(".input-candidate-list")) closeInputCandidates();
});
elements.dialog.addEventListener("close", closeInputCandidates);
elements.dialog.addEventListener("click", (event) => { if (event.target === elements.dialog) closeForm(); });
elements.settingsDialog.addEventListener("click", (event) => { if (event.target === elements.settingsDialog) elements.settingsDialog.close(); });
elements.readmeDialog.addEventListener("click", (event) => { if (event.target === elements.readmeDialog) elements.readmeDialog.close(); });
elements.candidateDialog.addEventListener("click", (event) => { if (event.target === elements.candidateDialog) elements.candidateDialog.close(); });
elements.backupButton.addEventListener("click", saveBackup);
elements.restoreButton.addEventListener("click", () => elements.restoreFile.click());
elements.restoreFile.addEventListener("change", restoreBackup);
elements.csvButton.addEventListener("click", exportCsv);
window.addEventListener("resize", renderCategories);

elements.rateInput.value = exchangeRate;
render();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" }).catch(console.error));
