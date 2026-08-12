"use strict";

const STORAGE_KEYS = { subscriptions: "subscription-manager.items.v1", rate: "subscription-manager.usd-jpy.v1" };
const DEFAULT_RATE = 150;
const COLORS = ["#315c53", "#d18b47", "#537fa3", "#8d6b9f", "#6f9256", "#bd5e63", "#787878", "#3f9b94"];

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
  monthlyPeriod: $("monthly-period"), yearlyPeriod: $("yearly-period")
};

let subscriptions = loadSubscriptions();
let exchangeRate = loadRate();
let categoryPeriod = "monthly";

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
function yen(value) { return `${Math.round(value).toLocaleString("ja-JP")}円`; }
function originalPrice(item) { return item.currency === "JPY" ? `${Number(item.price).toLocaleString("ja-JP")}円` : `$${Number(item.price).toLocaleString("en-US")}`; }
function baseYen(item) { return Number(item.price) * (item.currency === "USD" ? exchangeRate : 1); }
function amounts(item) {
  const base = baseYen(item);
  return item.cycle === "monthly" ? { monthly: base, yearly: base * 12 } : { monthly: base / 12, yearly: base };
}
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContentでユーザー入力のXSSを防ぐ
  return node;
}

function getCategoryTotals() {
  const totals = new Map();
  subscriptions.forEach((item) => {
    const category = item.category.trim() || "その他";
    const current = totals.get(category) || { monthly: 0, yearly: 0 };
    const calculated = amounts(item);
    current.monthly += calculated.monthly;
    current.yearly += calculated.yearly;
    totals.set(category, current);
  });
  return [...totals.entries()].sort((a, b) => b[1].monthly - a[1].monthly);
}

function render() {
  const calculated = subscriptions.map(amounts);
  elements.monthlyTotal.textContent = yen(calculated.reduce((sum, value) => sum + value.monthly, 0));
  elements.yearlyTotal.textContent = yen(calculated.reduce((sum, value) => sum + value.yearly, 0));
  elements.count.textContent = `${subscriptions.length}件`;
  renderSubscriptions();
  renderCategories();
}

function renderSubscriptions() {
  elements.list.replaceChildren();
  if (subscriptions.length === 0) {
    const empty = make("div", "empty-state");
    empty.append(make("strong", "", "まだ登録がありません"), make("p", "", "「＋ 追加」から最初のサブスクリプションを登録してください。"));
    elements.list.append(empty);
    return;
  }
  const sorted = [...subscriptions].sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal));
  sorted.forEach((item) => elements.list.append(createSubscriptionCard(item)));
}

function createSubscriptionCard(item) {
  const card = make("article", "subscription-card");
  const top = make("div", "card-top");
  const titleArea = make("div");
  titleArea.append(make("h3", "", item.name), make("span", "category-badge", item.category || "その他"));
  top.append(titleArea, make("span", "registered-price", originalPrice(item)));
  const value = amounts(item);
  const conversion = make("div", "conversion-grid");
  [["月額換算", yen(value.monthly)], ["年額換算", yen(value.yearly)]].forEach(([label, amount]) => {
    const box = make("div"); box.append(make("span", "", label), make("strong", "", amount)); conversion.append(box);
  });
  const details = make("dl", "details");
  [["更新周期", item.cycle === "monthly" ? "毎月" : "毎年"], ["次回更新日", formatDate(item.nextRenewal)], ["支払方法", item.paymentMethod || "未設定"]].forEach(([term, description]) => {
    const row = make("div"); row.append(make("dt", "", term), make("dd", "", description)); details.append(row);
  });
  const actions = make("div", "card-actions");
  const edit = make("button", "card-action", "編集"); edit.type = "button"; edit.addEventListener("click", () => openForm(item));
  const remove = make("button", "card-action danger", "削除"); remove.type = "button"; remove.addEventListener("click", () => removeSubscription(item.id));
  actions.append(edit, remove); card.append(top, conversion, details, actions); return card;
}

function formatDate(value) {
  if (!value) return "未設定";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric", weekday: "short" }).format(date);
}

function renderCategories() {
  const categories = getCategoryTotals();
  elements.categorySummary.replaceChildren();
  if (categories.length === 0) elements.categorySummary.append(make("p", "empty-state", "登録するとカテゴリ別の集計とグラフが表示されます。"));
  categories.filter(([, value]) => value[categoryPeriod] > 0).forEach(([name, value], index) => {
    const row = make("div", "category-row");
    const dot = make("span", "category-color"); dot.style.backgroundColor = COLORS[index % COLORS.length];
    row.append(dot, make("strong", "", name), make("span", "category-amount", `${yen(value[categoryPeriod])} / ${categoryPeriod === "monthly" ? "月" : "年"}`));
    elements.categorySummary.append(row);
  });
  const canvas = $("category-chart");
  canvas.setAttribute("aria-label", `カテゴリ別${categoryPeriod === "monthly" ? "月額換算" : "年間総額"}の円グラフ`);
  drawChart(canvas, categories, categoryPeriod);
}

// 外部ライブラリなしのため、PWAをオフラインで開いても円グラフを描画できる。
function drawChart(canvas, categories, key) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = 360; const height = 340; const centerX = 180; const centerY = 168; const radius = 106;
  canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const visible = categories.filter(([, value]) => value[key] > 0);
  const total = visible.reduce((sum, [, value]) => sum + value[key], 0);
  if (!total) {
    ctx.fillStyle = "#dbe4e0"; ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(centerX, centerY, 56, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#64746f"; ctx.font = "14px system-ui"; ctx.textAlign = "center"; ctx.fillText("データなし", centerX, centerY + 5); return;
  }
  let start = -Math.PI / 2; const labels = [];
  visible.forEach(([name, value], index) => {
    const angle = value[key] / total * Math.PI * 2;
    const middle = start + angle / 2; const percentage = value[key] / total * 100;
    ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius, start, start + angle); ctx.closePath(); ctx.fillStyle = COLORS[index % COLORS.length]; ctx.fill();
    labels.push({ name, percentage, middle, inside: percentage >= 8 }); start += angle;
  });
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(centerX, centerY, 55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#19302b"; ctx.font = "700 15px system-ui"; ctx.textAlign = "center"; ctx.fillText(key === "monthly" ? "月額合計" : "年額合計", centerX, centerY - 5);
  ctx.font = "700 14px system-ui"; ctx.fillText(yen(total), centerX, centerY + 18);
  drawChartLabels(ctx, labels, centerX, centerY, radius);
}

function shortLabel(name, max = 7) { return name.length > max ? `${name.slice(0, max)}…` : name; }

function drawChartLabels(ctx, labels, centerX, centerY, radius) {
  ctx.font = "700 12px system-ui"; ctx.lineWidth = 3; ctx.lineJoin = "round";
  labels.filter((label) => label.inside).forEach((label) => {
    const x = centerX + Math.cos(label.middle) * 81; const y = centerY + Math.sin(label.middle) * 81;
    const text = `${shortLabel(label.name, 5)} ${label.percentage.toFixed(0)}%`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.strokeStyle = "rgba(25,48,43,.55)"; ctx.strokeText(text, x, y); ctx.fillStyle = "#fff"; ctx.fillText(text, x, y);
  });
  ["left", "right"].forEach((side) => {
    const sideLabels = labels.filter((label) => !label.inside && (Math.cos(label.middle) < 0 ? "left" : "right") === side)
      .map((label) => ({ ...label, targetY: centerY + Math.sin(label.middle) * (radius + 25) })).sort((a, b) => a.targetY - b.targetY);
    const gap = 22; const top = 18; const bottom = 322;
    sideLabels.forEach((label, index) => { label.y = Math.max(label.targetY, index ? sideLabels[index - 1].y + gap : top); });
    for (let index = sideLabels.length - 1; index >= 0; index -= 1) sideLabels[index].y = Math.min(sideLabels[index].y, index < sideLabels.length - 1 ? sideLabels[index + 1].y - gap : bottom);
    sideLabels.forEach((label) => {
      const direction = side === "left" ? -1 : 1; const edgeX = centerX + Math.cos(label.middle) * radius; const edgeY = centerY + Math.sin(label.middle) * radius;
      const bendX = centerX + direction * (radius + 14); const textX = centerX + direction * 153;
      ctx.beginPath(); ctx.moveTo(edgeX, edgeY); ctx.lineTo(bendX, label.y); ctx.lineTo(textX - direction * 3, label.y); ctx.strokeStyle = "#8b9a95"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#19302b"; ctx.textAlign = side === "left" ? "left" : "right"; ctx.textBaseline = "middle";
      ctx.fillText(`${shortLabel(label.name)} ${label.percentage.toFixed(1)}%`, textX, label.y);
    });
  });
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
  elements.formTitle.textContent = item ? "サブスクリプションを編集" : "サブスクリプションを追加";
  elements.id.value = item?.id || ""; elements.name.value = item?.name || ""; elements.price.value = item?.price ?? "";
  elements.currency.value = item?.currency || "JPY"; elements.cycle.value = item?.cycle || "monthly";
  elements.renewal.value = item?.nextRenewal || todayString(); elements.payment.value = item?.paymentMethod || ""; elements.category.value = item?.category || "";
  elements.dialog.showModal(); setTimeout(() => elements.name.focus(), 0);
}
function todayString() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function closeForm() { elements.dialog.close(); }

function submitSubscription(event) {
  event.preventDefault();
  const price = Number(elements.price.value); const category = elements.category.value.trim(); const name = elements.name.value.trim();
  if (!name || !category || !Number.isFinite(price) || price < 0 || !elements.renewal.value) { elements.formError.textContent = "必須項目と料金を正しく入力してください。"; return; }
  const id = elements.id.value || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const item = { id, name, price, currency: elements.currency.value, cycle: elements.cycle.value, nextRenewal: elements.renewal.value, paymentMethod: elements.payment.value.trim(), category };
  const index = subscriptions.findIndex((entry) => entry.id === id);
  if (index >= 0) subscriptions[index] = item; else subscriptions.push(item);
  saveSubscriptions(); closeForm(); render();
}

function removeSubscription(id) {
  const item = subscriptions.find((entry) => entry.id === id);
  if (!item || !window.confirm(`「${item.name}」を削除しますか？`)) return;
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
  const backup = { version: 1, createdAt: new Date().toISOString(), subscriptions, exchangeRate };
  downloadFile(JSON.stringify(backup, null, 2), "application/json;charset=utf-8", `fixed-cost-backup-${dateForFilename()}.json`);
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
    if (!window.confirm("現在のデータをバックアップファイルの内容で置き換えます。よろしいですか？")) {
      showDataMessage("復元をキャンセルしました。"); return;
    }
    // 検証と確認が完了した後にだけ、現在データを書き換える。
    subscriptions = backup.subscriptions.map((item) => ({ ...item }));
    exchangeRate = restoredRate;
    localStorage.setItem(STORAGE_KEYS.subscriptions, JSON.stringify(subscriptions));
    localStorage.setItem(STORAGE_KEYS.rate, String(exchangeRate));
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
  downloadFile(`\uFEFF${csv}`, "text/csv;charset=utf-8", `fixed-cost-list-${dateForFilename()}.csv`);
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
$("open-menu-button").addEventListener("click", () => elements.settingsDialog.showModal());
$("close-menu-button").addEventListener("click", () => elements.settingsDialog.close());
$("close-form-button").addEventListener("click", closeForm);
$("cancel-button").addEventListener("click", closeForm);
elements.form.addEventListener("submit", submitSubscription);
elements.dialog.addEventListener("click", (event) => { if (event.target === elements.dialog) closeForm(); });
elements.settingsDialog.addEventListener("click", (event) => { if (event.target === elements.settingsDialog) elements.settingsDialog.close(); });
elements.backupButton.addEventListener("click", saveBackup);
elements.restoreButton.addEventListener("click", () => elements.restoreFile.click());
elements.restoreFile.addEventListener("change", restoreBackup);
elements.csvButton.addEventListener("click", exportCsv);
window.addEventListener("resize", renderCategories);

elements.rateInput.value = exchangeRate;
render();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(console.error));
