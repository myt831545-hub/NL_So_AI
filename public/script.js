/**
 * script.js -- Điều phối toàn bộ 4 bước SmartPost AI (đơn giản, dễ hiểu cho sinh viên Kế toán):
 *  - Bước 1: Chọn ngành hàng kinh doanh (6 ngành đầy đủ mặt hàng)
 *  - Bước 2: Danh sách mặt hàng & Thông tin cửa hàng
 *  - Bước 3: Góc Kế Toán (Giá vốn, Giá bán, Mức giảm, Chi phí phụ, Tiền lãi & Điểm hòa vốn)
 *  - Bước 4: Hỏi đáp với Trợ lý AI & Viết bài Facebook / Zalo / 3 mẫu trả lời khách + Xuất Excel (CSV)
 */

const STORAGE_STATE_KEY = 'smartpost_ai_workspace_v2';
const STORAGE_HISTORY_KEY = 'smartpost_ai_history_v2';
const MAX_HISTORY = 50;

function formatVnd(num) {
  if (typeof num !== 'number' || !Number.isFinite(num)) return '--';
  const sign = num < 0 ? '-' : '';
  const absStr = String(Math.abs(Math.trunc(num)));
  return sign + absStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
}

function formatPct(num) {
  if (typeof num !== 'number' || !Number.isFinite(num)) return '--';
  return String(num).replace('.', ',') + '%';
}

function parseStrictInt(raw) {
  const s = String(raw ?? '').trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

function nowTimeLabel() {
  const d = new Date();
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function buildInitialWorkspace() {
  const industries = {};
  (window.SMARTPOST_INDUSTRIES || []).forEach((ind) => {
    industries[ind.id] = {
      store: deepClone(ind.store),
      products: deepClone(ind.products),
      activeProductId: ind.products[0]?.id || null,
      chat: [
        {
          role: 'ai',
          time: nowTimeLabel(),
          content: `Xin chào! Tôi là Trợ lý của ngành "${ind.name}". Bạn chọn mặt hàng ở Bước 2 rồi hỏi tôi xem giảm giá như vậy có lãi không, hoặc bấm "Viết / Sửa bài đăng" nhé!`
        }
      ]
    };
  });

  return {
    activeIndustryId: 'an_uong',
    industries
  };
}

let workspace = loadWorkspace();
let historyItems = loadHistory();
let activeChannel = 'facebook';
let currentKit = {
  bai_facebook: '',
  tin_nhan_zalo: '',
  mau_tu_van: [
    { tieu_de: 'Mẫu 1: Trả lời khách hỏi giá & khuyến mãi', noi_dung: '' },
    { tieu_de: 'Mẫu 2: Trả lời khách hỏi giao hàng / thời gian', noi_dung: '' },
    { tieu_de: 'Mẫu 3: Mẫu chốt đơn lịch sự', noi_dung: '' }
  ],
  doi_soat: null,
  ban_goc_snapshot: null
};
let lastCalcResult = null;
let editingProductId = null;
let calcDebounceTimer = null;
let isAiBusy = false;

function loadWorkspace() {
  try {
    const raw = localStorage.getItem(STORAGE_STATE_KEY);
    if (!raw) return buildInitialWorkspace();
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.industries || !parsed.activeIndustryId) {
      return buildInitialWorkspace();
    }
    return parsed;
  } catch {
    return buildInitialWorkspace();
  }
}

function saveWorkspace() {
  localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(workspace));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  historyItems = historyItems.slice(0, MAX_HISTORY);
  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(historyItems));
  renderHistory();
}

function getIndustryMeta(id = workspace.activeIndustryId) {
  return (window.SMARTPOST_INDUSTRIES || []).find((i) => i.id === id) || window.SMARTPOST_INDUSTRIES[0];
}

function getIndustryState(id = workspace.activeIndustryId) {
  return workspace.industries[id];
}

function getActiveProduct() {
  const st = getIndustryState();
  return st.products.find((p) => p.id === st.activeProductId) || st.products[0] || null;
}

// ---- DOM Elements ----
const aiModePill = document.getElementById('aiModePill');
const industryTabsEl = document.getElementById('industryTabs');
const scenarioTitleEl = document.getElementById('scenarioTitle');
const activeStoreCaptionEl = document.getElementById('activeStoreCaption');

const tabProductsBtn = document.getElementById('tabProductsBtn');
const tabStoreBtn = document.getElementById('tabStoreBtn');
const productsPanel = document.getElementById('productsPanel');
const storeProfilePanel = document.getElementById('storeProfilePanel');
const productListEl = document.getElementById('productList');

const calcActiveProductName = document.getElementById('calcActiveProductName');
const calcGiaVon = document.getElementById('calc_gia_von');
const calcGiaBan = document.getElementById('calc_gia_ban');
const calcGiaTriKm = document.getElementById('calc_gia_tri_km');
const calcKmLabel = document.getElementById('calcKmValueLabel');
const calcKmUnit = document.getElementById('calcKmUnit');
const calcLoaiKm = document.getElementById('calc_loai_km');
const calcSoLuong = document.getElementById('calc_so_luong');
const calcSlToiThieu = document.getElementById('calc_sl_toi_thieu');
const calcMinQtyWrap = document.getElementById('calcMinQtyWrap');
const calcNgayBatDau = document.getElementById('calc_ngay_bat_dau');
const calcNgayKetThuc = document.getElementById('calc_ngay_ket_thuc');
const calcDongGoi = document.getElementById('calc_dong_goi');
const calcHoTroShip = document.getElementById('calc_ho_tro_ship');
const calcChiPhiKhac = document.getElementById('calc_chi_phi_khac');
const calcNguongLn = document.getElementById('calc_nguong_ln');

const kpiGiaSauGiam = document.getElementById('kpi_gia_sau_giam');
const kpiTietKiem = document.getElementById('kpi_tiet_kiem');
const kpiProfitCard = document.getElementById('kpiProfitCard');
const kpiLoiNhuan = document.getElementById('kpi_loi_nhuan');
const kpiLaiGop = document.getElementById('kpi_lai_gop');
const kpiTongChiPhi = document.getElementById('kpi_tong_chi_phi');
const kpiChiPhiC = document.getElementById('kpi_chi_phi_c');
const kpiBienLn = document.getElementById('kpi_bien_ln');
const kpiGiamHoaVon = document.getElementById('kpi_giam_hoa_von');
const kpiGiamHoaVonTien = document.getElementById('kpi_giam_hoa_von_tien');
const profitStatusBanner = document.getElementById('profitStatusBanner');

const chatIndustryName = document.getElementById('chatIndustryName');
const chatMessagesEl = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const generateKitBtn = document.getElementById('generateKitBtn');
const regenerateKitBtn = document.getElementById('regenerateKitBtn');

const channelEditor = document.getElementById('channelEditor');
const singleEditorPane = document.getElementById('singleEditorPane');
const consultEditorPane = document.getElementById('consultEditorPane');
const consult1 = document.getElementById('consult_1');
const consult2 = document.getElementById('consult_2');
const consult3 = document.getElementById('consult_3');
const copyActiveChannelBtn = document.getElementById('copyActiveChannelBtn');
const kitAuditBanner = document.getElementById('kitAuditBanner');
const copyFeedback = document.getElementById('copyFeedback');

const historyCountNum = document.getElementById('historyCountNum');
const historyEmptyMsg = document.getElementById('historyEmptyMsg');
const historyListEl = document.getElementById('historyList');

// ---- Kiểm tra trạng thái AI ----
async function checkServerHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.has_gemini_key) {
      aiModePill.className = 'toolbar-pill pill-status online';
      aiModePill.textContent = '● Trợ lý AI đang sẵn sàng';
    } else {
      aiModePill.className = 'toolbar-pill pill-status offline';
      aiModePill.textContent = '● Chế độ mẫu (chưa có khóa AI)';
    }
  } catch {
    aiModePill.className = 'toolbar-pill pill-status offline';
    aiModePill.textContent = '● Chưa kết nối được máy chủ';
  }
}

// ---- Bước 1: 6 ngành hàng ----
function renderIndustries() {
  const meta = getIndustryMeta();
  const st = getIndustryState();
  scenarioTitleEl.textContent = meta.scenarioTitle;
  activeStoreCaptionEl.textContent = `${st.store.ten_cua_hang} • ${meta.name}`;
  chatIndustryName.textContent = meta.name;

  industryTabsEl.innerHTML = '';
  (window.SMARTPOST_INDUSTRIES || []).forEach((ind) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `industry-tab ${ind.id === workspace.activeIndustryId ? 'active' : ''}`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'industry-icon';
    iconSpan.textContent = ind.icon;

    const textWrap = document.createElement('span');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'industry-name';
    nameSpan.textContent = ind.name;
    const subSpan = document.createElement('span');
    subSpan.className = 'industry-sub';
    subSpan.textContent = ind.shortDesc;

    textWrap.appendChild(nameSpan);
    textWrap.appendChild(subSpan);
    btn.appendChild(iconSpan);
    btn.appendChild(textWrap);

    btn.addEventListener('click', () => {
      workspace.activeIndustryId = ind.id;
      saveWorkspace();
      renderAllForActiveIndustry(true);
    });
    industryTabsEl.appendChild(btn);
  });
}

// ---- Bước 2: Danh sách mặt hàng & Thông tin cửa hàng ----
function renderStoreForm() {
  const st = getIndustryState();
  document.getElementById('store_ten').value = st.store.ten_cua_hang || '';
  document.getElementById('store_khach').value = st.store.khach_hang_muc_tieu || '';
  document.getElementById('store_diem_noi_bat').value = st.store.diem_noi_bat || '';
  document.getElementById('store_lien_he').value = st.store.lien_he || '';
  document.getElementById('store_ghi_chu_gia').value = st.store.ghi_chu_gia || '';
}

function renderProducts() {
  const st = getIndustryState();
  productListEl.innerHTML = '';

  if (st.products.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted-small';
    empty.textContent = 'Chưa có mặt hàng nào. Bấm "+ Thêm mặt hàng mới" để thêm.';
    productListEl.appendChild(empty);
    return;
  }

  st.products.forEach((sp) => {
    const isActive = sp.id === st.activeProductId;
    const item = document.createElement('div');
    item.className = `product-item ${isActive ? 'active' : ''}`;

    const info = document.createElement('div');
    info.className = 'product-item-info';

    const title = document.createElement('div');
    title.className = 'product-item-title';
    title.textContent = sp.ten_san_pham;
    info.appendChild(title);

    if (isActive) {
      const badge = document.createElement('span');
      badge.className = 'badge-active-sp';
      badge.textContent = 'Đang chọn';
      info.appendChild(badge);
    }

    const meta = document.createElement('div');
    meta.className = 'product-item-meta';
    const cTotal = (sp.dong_goi || 0) + (sp.ho_tro_ship || 0) + (sp.chi_phi_khac || 0);
    const kmTxt =
      sp.loai_km === 'tien_co_dinh'
        ? `Giảm ${formatVnd(sp.gia_tri_km)}`
        : sp.loai_km === 'khong'
        ? 'Không giảm'
        : `Giảm ${sp.gia_tri_km}%`;
    meta.textContent = `Vốn: ${sp.gia_von !== null && sp.gia_von !== undefined ? formatVnd(sp.gia_von) : 'Chưa nhập'} | Bán: ${formatVnd(sp.don_gia)} | Chi phí phụ: ${formatVnd(cTotal)} | ${kmTxt}`;
    info.appendChild(meta);

    const btns = document.createElement('div');
    btns.className = 'product-item-btns';

    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = `btn btn-sm ${isActive ? 'btn-primary' : 'btn-white'}`;
    selectBtn.textContent = isActive ? 'Đang dùng' : 'Chọn tính & viết bài';
    selectBtn.addEventListener('click', () => {
      st.activeProductId = sp.id;
      saveWorkspace();
      renderProducts();
      loadProductIntoStep3(sp);
      runCalculateAndThen(() => requestGenerateKit(''));
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-white btn-sm';
    editBtn.textContent = 'Sửa';
    editBtn.addEventListener('click', () => openProductModal(sp));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-outline-danger btn-sm';
    delBtn.textContent = 'Xóa';
    delBtn.addEventListener('click', () => {
      if (st.products.length <= 1) {
        alert('Nên giữ ít nhất 1 mặt hàng trong danh sách (hoặc bấm Sửa để thay đổi).');
        return;
      }
      if (!confirm(`Xóa mặt hàng "${sp.ten_san_pham}"? (Bài viết đã lưu không bị mất)`)) return;
      st.products = st.products.filter((x) => x.id !== sp.id);
      if (st.activeProductId === sp.id) {
        st.activeProductId = st.products[0]?.id || null;
      }
      saveWorkspace();
      renderProducts();
      const nextSp = getActiveProduct();
      if (nextSp) {
        loadProductIntoStep3(nextSp);
        runCalculateOnly();
      }
    });

    btns.appendChild(selectBtn);
    btns.appendChild(editBtn);
    btns.appendChild(delBtn);

    item.appendChild(info);
    item.appendChild(btns);
    productListEl.appendChild(item);
  });
}

// ---- Bước 3: Tính giá & Lợi nhuận ----
function updateKmControlsUi() {
  const loai = calcLoaiKm.value;
  calcMinQtyWrap.classList.toggle('hidden', loai !== 'phan_tram_theo_so_luong');
  if (loai === 'tien_co_dinh') {
    calcKmLabel.innerHTML = 'Số tiền giảm (đ) <span class="req">*</span>';
    calcKmUnit.textContent = 'đ';
    calcGiaTriKm.disabled = false;
  } else if (loai === 'khong') {
    calcKmLabel.textContent = 'Giảm giá';
    calcKmUnit.textContent = '%';
    calcGiaTriKm.value = '0';
    calcGiaTriKm.disabled = true;
  } else {
    calcKmLabel.innerHTML = 'Mức giảm giá (%) <span class="req">*</span>';
    calcKmUnit.textContent = '%';
    calcGiaTriKm.disabled = false;
  }
}

function loadProductIntoStep3(sp) {
  if (!sp) return;
  calcActiveProductName.textContent = sp.ten_san_pham;
  calcGiaVon.value = sp.gia_von !== null && sp.gia_von !== undefined ? String(sp.gia_von) : '';
  calcGiaBan.value = String(sp.don_gia);
  calcSoLuong.value = String(sp.so_luong || 1);
  calcLoaiKm.value = sp.loai_km || 'phan_tram';
  calcGiaTriKm.value = String(sp.gia_tri_km ?? 0);
  calcSlToiThieu.value = String(sp.sl_toi_thieu || 2);
  calcDongGoi.value = String(sp.dong_goi ?? 0);
  calcHoTroShip.value = String(sp.ho_tro_ship ?? 0);
  calcChiPhiKhac.value = String(sp.chi_phi_khac ?? 0);

  if (!calcNgayBatDau.value || !calcNgayKetThuc.value) {
    const today = new Date();
    const next7 = new Date(today.getTime() + 7 * 86400000);
    calcNgayBatDau.value = today.toISOString().slice(0, 10);
    calcNgayKetThuc.value = next7.toISOString().slice(0, 10);
  }
  updateKmControlsUi();
}

function clearCalcErrors() {
  document.querySelectorAll('.field-error').forEach((el) => {
    el.textContent = '';
  });
}

function buildPayloadFromUi() {
  const st = getIndustryState();
  const meta = getIndustryMeta();
  const sp = getActiveProduct();

  const giaVonRaw = calcGiaVon.value.trim();
  const giaVonVal = giaVonRaw === '' ? null : parseStrictInt(giaVonRaw) ?? giaVonRaw;
  const donGiaVal = parseStrictInt(calcGiaBan.value) ?? calcGiaBan.value.trim();
  const soLuongVal = parseStrictInt(calcSoLuong.value) ?? calcSoLuong.value.trim();
  const giaTriKmVal = parseStrictInt(calcGiaTriKm.value) ?? calcGiaTriKm.value.trim();
  const slToiThieuVal = parseStrictInt(calcSlToiThieu.value) ?? calcSlToiThieu.value.trim();

  const dongGoiVal = calcDongGoi.value.trim() === '' ? 0 : parseStrictInt(calcDongGoi.value) ?? calcDongGoi.value;
  const shipVal = calcHoTroShip.value.trim() === '' ? 0 : parseStrictInt(calcHoTroShip.value) ?? calcHoTroShip.value;
  const khacVal = calcChiPhiKhac.value.trim() === '' ? 0 : parseStrictInt(calcChiPhiKhac.value) ?? calcChiPhiKhac.value;

  const nguongVal = calcNguongLn.value.trim() === '' ? 10 : Number(calcNguongLn.value.replace(',', '.'));

  return {
    ten_san_pham: sp?.ten_san_pham || 'Mặt hàng đang tính',
    mo_ta: sp?.mo_ta || '',
    don_gia: donGiaVal,
    so_luong: soLuongVal,
    gia_von: giaVonVal,
    chi_phi: {
      dong_goi: dongGoiVal,
      ho_tro_ship: shipVal,
      chi_phi_khac: khacVal
    },
    nguong_bien_ln_thap: nguongVal,
    ghi_chu_gia: st.store.ghi_chu_gia || '',
    lien_he: st.store.lien_he || '',
    nen_tang: 'facebook',
    phong_cach: 'than_thien',
    do_dai: 'vua',
    khuyen_mai: {
      loai: calcLoaiKm.value,
      gia_tri: giaTriKmVal,
      cho_phep_0: true,
      so_luong_toi_thieu: slToiThieuVal,
      ngay_bat_dau: calcNgayBatDau.value,
      ngay_ket_thuc: calcNgayKetThuc.value
    },
    store_profile: {
      ...st.store,
      nganh_label: meta.name
    }
  };
}

function renderPricingCards(congKhai, noiBo) {
  lastCalcResult = { cong_khai: congKhai, noi_bo: noiBo };
  kpiGiaSauGiam.textContent = formatVnd(congKhai.thanh_tien);
  kpiTietKiem.textContent = `Khách được giảm: ${formatVnd(congKhai.tien_giam)} (${formatPct(congKhai.phan_tram_giam_thuc_te)})`;

  kpiProfitCard.classList.remove('is-loss', 'is-low');
  profitStatusBanner.classList.remove('status-ok', 'status-warn', 'status-loss');

  if (!noiBo || !noiBo.co_gia_von) {
    kpiLoiNhuan.textContent = 'Chưa nhập vốn';
    kpiLaiGop.textContent = '--';
    kpiTongChiPhi.textContent = '--';
    kpiChiPhiC.textContent = `Chi phí phụ: ${formatVnd(noiBo?.chi_phi_phat_sinh || 0)}`;
    kpiBienLn.textContent = '--';
    kpiGiamHoaVon.textContent = '--';
    kpiGiamHoaVonTien.textContent = 'Nhập Giá vốn (V) để tính mức hòa vốn';
    profitStatusBanner.classList.add('status-warn');
    profitStatusBanner.innerHTML = '<strong>CHƯA NHẬP GIÁ VỐN</strong>Bạn vẫn viết bài bình thường; nếu muốn tính tiền lãi và kiểm tra bán lỗ, hãy nhập Giá vốn ở trên.';
    return;
  }

  const sign = noiBo.loi_nhuan_sau_chi_phi > 0 ? '+' : '';
  kpiLoiNhuan.textContent = formatVnd(noiBo.loi_nhuan_sau_chi_phi);
  kpiLaiGop.textContent = formatVnd(noiBo.lai_gop);
  kpiTongChiPhi.textContent = formatVnd(noiBo.tong_chi_phi_khai_bao);
  kpiChiPhiC.textContent = `Trong đó chi phí phụ: ${formatVnd(noiBo.chi_phi_phat_sinh)}`;
  kpiBienLn.textContent = formatPct(noiBo.bien_loi_nhuan_phan_tram);
  kpiGiamHoaVon.textContent = formatPct(noiBo.giam_toi_da_hoa_von_phan_tram);
  kpiGiamHoaVonTien.textContent = `Giảm tối đa ${formatVnd(noiBo.giam_toi_da_hoa_von_tien)}/đơn để hòa vốn`;

  if (noiBo.trang_thai_loi_nhuan === 'ban_lo') {
    kpiProfitCard.classList.add('is-loss');
    profitStatusBanner.classList.add('status-loss');
    profitStatusBanner.innerHTML = `<strong>CẢNH BÁO BÁN LỖ: ${formatVnd(noiBo.loi_nhuan_sau_chi_phi)}/đơn (Tỷ lệ lãi: ${formatPct(noiBo.bien_loi_nhuan_phan_tram)})</strong>Mức giảm này vượt quá giới hạn hòa vốn (${formatPct(noiBo.giam_toi_da_hoa_von_phan_tram)}). Hệ thống chỉ cảnh báo để bạn cân nhắc, không chặn quyền đăng bài.`;
  } else if (noiBo.trang_thai_loi_nhuan === 'bien_thap') {
    kpiProfitCard.classList.add('is-low');
    profitStatusBanner.classList.add('status-warn');
    profitStatusBanner.innerHTML = `<strong>CẢNH BÁO LÃI MỎNG: ${sign}${formatVnd(noiBo.loi_nhuan_sau_chi_phi)}/đơn (Tỷ lệ lãi: ${formatPct(noiBo.bien_loi_nhuan_phan_tram)})</strong>Tỷ lệ lãi đang thấp hơn mức cảnh báo ${calcNguongLn.value || 10}%. Mức giảm hòa vốn tối đa là ${formatPct(noiBo.giam_toi_da_hoa_von_phan_tram)}.`;
  } else {
    profitStatusBanner.classList.add('status-ok');
    profitStatusBanner.innerHTML = `<strong>CÓ LÃI AN TOÀN: ${sign}${formatVnd(noiBo.loi_nhuan_sau_chi_phi)}/đơn (Tỷ lệ lãi: ${formatPct(noiBo.bien_loi_nhuan_phan_tram)})</strong>Mức giảm hiện tại vẫn có lãi (mức giảm tối đa để không lỗ là ${formatPct(noiBo.giam_toi_da_hoa_von_phan_tram)}).`;
  }
}

async function runCalculateOnly() {
  clearCalcErrors();
  const payload = buildPayloadFromUi();
  try {
    const res = await fetch('/api/tinh-gia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.hop_le) {
      (data.loi || []).forEach((err) => {
        const errSpan = document.getElementById(`err_${err.truong}`);
        if (errSpan) errSpan.textContent = err.thong_bao;
      });
      return false;
    }
    renderPricingCards(data.cong_khai, data.noi_bo);
    return true;
  } catch {
    return false;
  }
}

async function runCalculateAndThen(cb) {
  const ok = await runCalculateOnly();
  if (ok && typeof cb === 'function') cb();
}

function scheduleCalculate() {
  clearTimeout(calcDebounceTimer);
  calcDebounceTimer = setTimeout(runCalculateOnly, 160);
}

// ---- Bước 4: Hỏi đáp AI & Viết bài ----
function renderChat() {
  const st = getIndustryState();
  chatMessagesEl.innerHTML = '';
  st.chat.forEach((msg) => {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`;

    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    meta.textContent = `${msg.role === 'user' ? 'Bạn' : 'Trợ lý AI'} • ${msg.time || ''}`;

    const body = document.createElement('div');
    body.textContent = msg.content;

    bubble.appendChild(meta);
    bubble.appendChild(body);
    chatMessagesEl.appendChild(bubble);
  });
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function appendChatMessage(role, content) {
  const st = getIndustryState();
  st.chat.push({ role, time: nowTimeLabel(), content });
  if (st.chat.length > 30) st.chat = st.chat.slice(-30);
  saveWorkspace();
  renderChat();
}

async function sendChatMessage(overrideText = null) {
  if (isAiBusy) return;
  const text = (overrideText !== null ? overrideText : chatInput.value).trim();
  if (!text) return;

  const ok = await runCalculateOnly();
  if (!ok) {
    alert('Vui lòng sửa các ô số liệu đang báo đỏ ở Bước 3 trước khi hỏi AI.');
    return;
  }

  if (overrideText === null) chatInput.value = '';
  appendChatMessage('user', text);

  isAiBusy = true;
  chatSendBtn.disabled = true;
  generateKitBtn.disabled = true;
  chatSendBtn.textContent = 'Đang trả lời...';

  try {
    const payload = buildPayloadFromUi();
    const st = getIndustryState();
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        messages: st.chat.map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))
      })
    });
    const data = await res.json();
    if (!res.ok || !data.hop_le) {
      appendChatMessage('ai', data.thong_bao || 'Xin lỗi, tôi chưa trả lời được câu hỏi này.');
    } else {
      appendChatMessage('ai', data.reply);
    }
  } catch {
    appendChatMessage('ai', 'Không kết nối được tới máy chủ.');
  } finally {
    isAiBusy = false;
    chatSendBtn.disabled = false;
    generateKitBtn.disabled = false;
    chatSendBtn.textContent = '💬 Hỏi đáp với AI';
  }
}

async function requestGenerateKit(customInstruction = null) {
  if (isAiBusy) return;
  const ok = await runCalculateOnly();
  if (!ok) {
    alert('Vui lòng kiểm tra lại các ô số liệu ở Bước 3 trước khi viết bài.');
    return;
  }

  const note = customInstruction !== null ? customInstruction : chatInput.value.trim();
  if (customInstruction === null && note) {
    appendChatMessage('user', `Nhờ viết lại bài: ${note}`);
    chatInput.value = '';
  }

  isAiBusy = true;
  generateKitBtn.disabled = true;
  regenerateKitBtn.disabled = true;
  generateKitBtn.textContent = 'Đang viết bài...';
  regenerateKitBtn.textContent = 'Đang viết...';

  try {
    const payload = buildPayloadFromUi();
    const res = await fetch('/api/tao-bo-bai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        yeu_cau_them: note
      })
    });
    const data = await res.json();
    if (!res.ok || !data.hop_le) {
      alert(data.thong_bao || 'Không thể viết bài lúc này, vui lòng kiểm tra lại số liệu.');
      return;
    }

    currentKit = {
      bai_facebook: data.bo_bai.bai_facebook,
      tin_nhan_zalo: data.bo_bai.tin_nhan_zalo,
      mau_tu_van: data.bo_bai.mau_tu_van,
      doi_soat: data.doi_soat,
      mode: data.mode,
      ban_goc_snapshot: deepClone(data.bo_bai)
    };

    renderPricingCards(data.cong_khai, data.noi_bo);
    renderKitEditors();
    renderAuditBanner(data.doi_soat);

    if (customInstruction === null && note) {
      appendChatMessage('ai', 'Đã cập nhật xong bài Facebook, tin nhắn Zalo và 3 mẫu trả lời khách ở cột bên phải!');
    }
  } catch {
    alert('Mất kết nối tới máy chủ khi viết bài.');
  } finally {
    isAiBusy = false;
    generateKitBtn.disabled = false;
    regenerateKitBtn.disabled = false;
    generateKitBtn.textContent = '✨ Viết / Sửa bài đăng';
    regenerateKitBtn.textContent = '↻ Viết lại';
  }
}

// ---- Cột phải: Soạn thảo 3 kênh & Đối soát ----
function syncEditorBackToState() {
  if (activeChannel === 'facebook') {
    currentKit.bai_facebook = channelEditor.value;
  } else if (activeChannel === 'zalo') {
    currentKit.tin_nhan_zalo = channelEditor.value;
  } else {
    currentKit.mau_tu_van[0].noi_dung = consult1.value;
    currentKit.mau_tu_van[1].noi_dung = consult2.value;
    currentKit.mau_tu_van[2].noi_dung = consult3.value;
  }
}

function renderKitEditors() {
  document.querySelectorAll('.channel-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.channel === activeChannel);
  });

  if (activeChannel === 'tuvan') {
    singleEditorPane.classList.add('hidden');
    consultEditorPane.classList.remove('hidden');
    consult1.value = currentKit.mau_tu_van[0]?.noi_dung || '';
    consult2.value = currentKit.mau_tu_van[1]?.noi_dung || '';
    consult3.value = currentKit.mau_tu_van[2]?.noi_dung || '';
    copyActiveChannelBtn.textContent = '📋 Sao chép 3 mẫu trả lời';
  } else {
    consultEditorPane.classList.add('hidden');
    singleEditorPane.classList.remove('hidden');
    channelEditor.value = activeChannel === 'facebook' ? currentKit.bai_facebook : currentKit.tin_nhan_zalo;
    copyActiveChannelBtn.textContent =
      activeChannel === 'facebook' ? '📋 Sao chép bài Facebook' : '📋 Sao chép tin nhắn Zalo';
  }
  copyFeedback.textContent = '';
}

function renderAuditBanner(doiSoat) {
  if (!doiSoat) {
    kitAuditBanner.classList.add('hidden');
    return;
  }

  kitAuditBanner.classList.remove('hidden', 'audit-ok', 'audit-warn', 'audit-danger');
  const msgs = [];
  let level = 'audit-ok';

  if (doiSoat.lo_noi_bo && doiSoat.lo_noi_bo.length > 0) {
    level = 'audit-danger';
    msgs.push(`CẢNH BÁO: Bài viết có nhắc số nội bộ (giá vốn/tiền lãi): ${doiSoat.lo_noi_bo.join(', ')}. Hãy xóa trước khi đăng!`);
  }
  if (doiSoat.so_la && doiSoat.so_la.length > 0) {
    if (level !== 'audit-danger') level = 'audit-warn';
    msgs.push(`Cảnh báo có số lạ chưa khớp bảng tính: ${doiSoat.so_la.join(', ')}.`);
  }
  if (doiSoat.tu_vi_pham && doiSoat.tu_vi_pham.length > 0) {
    if (level !== 'audit-danger') level = 'audit-warn';
    msgs.push(`Có từ ngữ quảng cáo quá đà cần cân nhắc sửa: "${doiSoat.tu_vi_pham.join('", "')}".`);
  }
  if (doiSoat.thieu_ghi_chu_gia) {
    if (level === 'audit-ok') level = 'audit-warn';
    msgs.push('Nhắc nhỏ: Bài Facebook chưa có ghi chú giá bạn đã nhập.');
  }

  if (msgs.length === 0) {
    msgs.push('✓ Kiểm tra số liệu đạt: Mọi con số trong bài đều khớp với bảng tính và không lộ giá vốn.');
  }

  kitAuditBanner.classList.add(level);
  kitAuditBanner.textContent = msgs.join(' ');
}

// ---- Lịch sử & Xuất Excel (CSV) ----
function renderHistory() {
  historyCountNum.textContent = String(historyItems.length);
  historyListEl.innerHTML = '';

  if (historyItems.length === 0) {
    historyEmptyMsg.classList.remove('hidden');
    historyListEl.classList.add('hidden');
    return;
  }

  historyEmptyMsg.classList.add('hidden');
  historyListEl.classList.remove('hidden');

  historyItems.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-item';

    const left = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'history-item-title';
    title.textContent = `${item.ten_san_pham} (${item.ten_cua_hang})`;

    const meta = document.createElement('div');
    meta.className = 'history-item-meta';
    meta.textContent = `${new Date(item.thoi_diem).toLocaleString('vi-VN')} | ${item.nganh_name} | Giá sau giảm: ${formatVnd(item.cong_khai?.thanh_tien)} | ${item.da_chinh_sua ? 'Đã sửa (vẫn giữ bản AI gốc)' : 'Bản AI gốc'}`;

    left.appendChild(title);
    left.appendChild(meta);

    const btns = document.createElement('div');
    btns.className = 'product-item-btns';

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'btn btn-outline btn-sm';
    loadBtn.textContent = 'Mở lại bài';
    loadBtn.addEventListener('click', () => {
      currentKit = {
        bai_facebook: item.ban_hien_tai.bai_facebook,
        tin_nhan_zalo: item.ban_hien_tai.tin_nhan_zalo,
        mau_tu_van: deepClone(item.ban_hien_tai.mau_tu_van),
        doi_soat: deepClone(item.doi_soat),
        mode: item.mode,
        ban_goc_snapshot: deepClone(item.ban_goc)
      };
      renderKitEditors();
      renderAuditBanner(item.doi_soat);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-outline-danger btn-sm';
    delBtn.textContent = 'Xóa';
    delBtn.addEventListener('click', () => {
      historyItems = historyItems.filter((x) => x.id !== item.id);
      saveHistory();
    });

    btns.appendChild(loadBtn);
    btns.appendChild(delBtn);
    row.appendChild(left);
    row.appendChild(btns);
    historyListEl.appendChild(row);
  });
}

function handleSaveToHistory() {
  syncEditorBackToState();
  const sp = getActiveProduct();
  const st = getIndustryState();
  const meta = getIndustryMeta();

  const banGoc = currentKit.ban_goc_snapshot || {
    bai_facebook: currentKit.bai_facebook,
    tin_nhan_zalo: currentKit.tin_nhan_zalo,
    mau_tu_van: deepClone(currentKit.mau_tu_van)
  };
  const banHienTai = {
    bai_facebook: currentKit.bai_facebook,
    tin_nhan_zalo: currentKit.tin_nhan_zalo,
    mau_tu_van: deepClone(currentKit.mau_tu_van)
  };
  const daChinhSua = JSON.stringify(banGoc) !== JSON.stringify(banHienTai);

  historyItems.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    thoi_diem: new Date().toISOString(),
    nganh_name: meta.name,
    ten_cua_hang: st.store.ten_cua_hang,
    ten_san_pham: sp?.ten_san_pham || calcActiveProductName.textContent,
    cong_khai: deepClone(lastCalcResult?.cong_khai || {}),
    noi_bo: deepClone(lastCalcResult?.noi_bo || {}),
    doi_soat: deepClone(currentKit.doi_soat || {}),
    mode: currentKit.mode || 'gemini',
    ban_goc: banGoc,
    ban_hien_tai: banHienTai,
    da_chinh_sua: daChinhSua
  });

  saveHistory();
  copyFeedback.textContent = '★ Đã lưu bài viết vào Lịch sử!';
}

function handleExportCsv() {
  if (historyItems.length === 0) {
    alert('Chưa có bài nào trong Lịch sử để xuất Excel.');
    return;
  }
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = [
    'Thoi diem',
    'Nganh hang',
    'Cua hang',
    'Mat hang',
    'Gia ban sau giam',
    'Tien lai sau chi phi',
    'Ty le lai (%)',
    'Da chinh sua',
    'Bai Facebook (ban AI goc)',
    'Bai Facebook (ban da sua)',
    'Tin nhan Zalo'
  ];
  const rows = historyItems.map((it) => [
    new Date(it.thoi_diem).toLocaleString('vi-VN'),
    it.nganh_name,
    it.ten_cua_hang,
    it.ten_san_pham,
    it.cong_khai?.thanh_tien ?? '',
    it.noi_bo?.loi_nhuan_sau_chi_phi ?? '',
    it.noi_bo?.bien_loi_nhuan_phan_tram ?? '',
    it.da_chinh_sua ? 'Co' : 'Khong',
    it.ban_goc?.bai_facebook || '',
    it.ban_hien_tai?.bai_facebook || '',
    it.ban_hien_tai?.tin_nhan_zalo || ''
  ]);
  const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smartpost_ai_lich_su_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Modals ----
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function openProductModal(sp = null) {
  editingProductId = sp ? sp.id : null;
  document.getElementById('productModalTitle').textContent = sp ? 'Sửa thông tin mặt hàng' : 'Thêm mặt hàng mới';
  document.getElementById('pm_ten').value = sp?.ten_san_pham || '';
  document.getElementById('pm_mo_ta').value = sp?.mo_ta || '';
  document.getElementById('pm_gia_von').value = sp?.gia_von ?? '';
  document.getElementById('pm_don_gia').value = sp?.don_gia ?? '';
  document.getElementById('pm_giam').value = sp?.gia_tri_km ?? 10;
  document.getElementById('pm_dong_goi').value = sp?.dong_goi ?? 0;
  document.getElementById('pm_ship').value = sp?.ho_tro_ship ?? 0;
  document.getElementById('pm_khac').value = sp?.chi_phi_khac ?? 0;
  document.getElementById('pm_error').textContent = '';
  openModal('productModal');
}

function saveProductFromModal() {
  const ten = document.getElementById('pm_ten').value.trim();
  const moTa = document.getElementById('pm_mo_ta').value.trim();
  const gvRaw = document.getElementById('pm_gia_von').value.trim();
  const gv = gvRaw === '' ? null : parseStrictInt(gvRaw);
  const dg = parseStrictInt(document.getElementById('pm_don_gia').value);
  const giam = parseStrictInt(document.getElementById('pm_giam').value);
  const dgCost = parseStrictInt(document.getElementById('pm_dong_goi').value || '0');
  const shipCost = parseStrictInt(document.getElementById('pm_ship').value || '0');
  const khacCost = parseStrictInt(document.getElementById('pm_khac').value || '0');
  const errEl = document.getElementById('pm_error');

  if (ten.length < 2 || ten.length > 100) {
    errEl.textContent = 'Tên mặt hàng phải từ 2 đến 100 ký tự.';
    return;
  }
  if (dg === null || dg <= 0) {
    errEl.textContent = 'Giá bán gốc phải là số nguyên lớn hơn 0.';
    return;
  }
  if (gvRaw !== '' && (gv === null || gv < 0)) {
    errEl.textContent = 'Giá vốn phải là số nguyên từ 0 trở lên (hoặc để trống).';
    return;
  }
  if (giam === null || giam < 0 || giam > 99) {
    errEl.textContent = 'Mức giảm phải từ 0 đến 99%.';
    return;
  }
  if (dgCost === null || dgCost < 0 || shipCost === null || shipCost < 0 || khacCost === null || khacCost < 0) {
    errEl.textContent = 'Chi phí phụ phải là số nguyên từ 0 trở lên.';
    return;
  }

  const st = getIndustryState();
  if (editingProductId) {
    const target = st.products.find((p) => p.id === editingProductId);
    if (target) {
      target.ten_san_pham = ten;
      target.mo_ta = moTa;
      target.gia_von = gv;
      target.don_gia = dg;
      target.gia_tri_km = giam;
      target.loai_km = giam === 0 ? 'khong' : 'phan_tram';
      target.dong_goi = dgCost;
      target.ho_tro_ship = shipCost;
      target.chi_phi_khac = khacCost;
      st.activeProductId = target.id;
    }
  } else {
    const newSp = {
      id: `sp_${Date.now()}`,
      ten_san_pham: ten,
      mo_ta: moTa,
      gia_von: gv,
      don_gia: dg,
      so_luong: 1,
      loai_km: giam === 0 ? 'khong' : 'phan_tram',
      gia_tri_km: giam,
      sl_toi_thieu: 2,
      dong_goi: dgCost,
      ho_tro_ship: shipCost,
      chi_phi_khac: khacCost
    };
    st.products.unshift(newSp);
    st.activeProductId = newSp.id;
  }

  saveWorkspace();
  closeModal('productModal');
  renderProducts();
  loadProductIntoStep3(getActiveProduct());
  runCalculateOnly();
}

async function openFormulaCheckModal() {
  openModal('formulaModal');
  const bodyEl = document.getElementById('formulaModalBody');
  bodyEl.innerHTML = '<p class="muted-small">Đang kiểm tra 2 ví dụ chuẩn để bạn so sánh với tính tay...</p>';

  try {
    const [r1, r2] = await Promise.all([
      fetch('/api/tinh-gia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          don_gia: 40000,
          so_luong: 1,
          gia_von: 20000,
          chi_phi: { dong_goi: 2500, ho_tro_ship: 0, chi_phi_khac: 0 },
          khuyen_mai: { loai: 'phan_tram', gia_tri: 10 }
        })
      }).then((r) => r.json()),
      fetch('/api/tinh-gia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          don_gia: 199000,
          so_luong: 2,
          gia_von: 120000,
          chi_phi: { dong_goi: 0, ho_tro_ship: 0, chi_phi_khac: 0 },
          khuyen_mai: { loai: 'phan_tram_theo_so_luong', gia_tri: 20, so_luong_toi_thieu: 2 }
        })
      }).then((r) => r.json())
    ]);

    bodyEl.innerHTML = `
      <p><strong>1. Ví dụ Mẹt Bún Đậu (Vốn 20.000đ | Bán 40.000đ | Giảm 10% | Đóng hộp 2.500đ):</strong></p>
      <table class="formula-table">
        <tr><th>Chỉ tiêu</th><th>Tính tay</th><th>Hệ thống tính</th></tr>
        <tr><td>Giá bán sau giảm</td><td>36.000đ</td><td>${formatVnd(r1.cong_khai.thanh_tien)}</td></tr>
        <tr><td>Lãi gộp (chưa trừ hộp)</td><td>16.000đ</td><td>${formatVnd(r1.noi_bo.lai_gop)}</td></tr>
        <tr><td>Tổng chi phí (Vốn + Hộp)</td><td>22.500đ</td><td>${formatVnd(r1.noi_bo.tong_chi_phi_khai_bao)}</td></tr>
        <tr><td>Tiền lãi sau chi phí</td><td>13.500đ</td><td>${formatVnd(r1.noi_bo.loi_nhuan_sau_chi_phi)}</td></tr>
        <tr><td>Tỷ lệ lãi trên giá bán</td><td>37,5%</td><td>${formatPct(r1.noi_bo.bien_loi_nhuan_phan_tram)}</td></tr>
        <tr><td>Giảm tối đa để không lỗ</td><td>43,75% (17.500đ)</td><td>${formatPct(r1.noi_bo.giam_toi_da_hoa_von_phan_tram)} (${formatVnd(r1.noi_bo.giam_toi_da_hoa_von_tien)})</td></tr>
      </table>
      <p style="margin-top:14px;"><strong>2. Ví dụ Áo Sơ Mi (Vốn 120.000đ | Bán 199.000đ | Mua 2 cái giảm 20%):</strong></p>
      <table class="formula-table">
        <tr><th>Chỉ tiêu</th><th>Tính tay</th><th>Hệ thống tính</th></tr>
        <tr><td>Tổng tiền hàng / Tiền giảm</td><td>398.000đ / 79.600đ</td><td>${formatVnd(r2.cong_khai.tong_tien_hang)} / ${formatVnd(r2.cong_khai.tien_giam)}</td></tr>
        <tr><td>Khách trả / Bình quân 1 cái</td><td>318.400đ / 159.200đ</td><td>${formatVnd(r2.cong_khai.thanh_tien)} / ${formatVnd(r2.cong_khai.gia_binh_quan)}</td></tr>
        <tr><td>Tiền lãi / Tỷ lệ lãi</td><td>78.400đ / 24,6%</td><td>${formatVnd(r2.noi_bo.lai_gop)} / ${formatPct(r2.noi_bo.bien_lai_gop_phan_tram)}</td></tr>
      </table>`;
  } catch {
    bodyEl.innerHTML = '<p class="inline-error">Không kết nối được máy chủ để kiểm tra.</p>';
  }
}

function renderAllForActiveIndustry(refreshKit = false) {
  renderIndustries();
  renderStoreForm();
  renderProducts();
  const sp = getActiveProduct();
  if (sp) loadProductIntoStep3(sp);
  renderChat();
  if (refreshKit) {
    runCalculateAndThen(() => requestGenerateKit(''));
  } else {
    runCalculateOnly();
  }
}

// ---- Sự kiện ----
document.querySelectorAll('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
});

tabProductsBtn.addEventListener('click', () => {
  tabProductsBtn.classList.add('active');
  tabStoreBtn.classList.remove('active');
  productsPanel.classList.remove('hidden');
  storeProfilePanel.classList.add('hidden');
});

tabStoreBtn.addEventListener('click', () => {
  tabStoreBtn.classList.add('active');
  tabProductsBtn.classList.remove('active');
  storeProfilePanel.classList.remove('hidden');
  productsPanel.classList.add('hidden');
});

document.getElementById('saveStoreBtn').addEventListener('click', () => {
  const st = getIndustryState();
  const ten = document.getElementById('store_ten').value.trim();
  if (ten.length < 2) {
    alert('Tên cửa hàng phải có ít nhất 2 ký tự.');
    return;
  }
  st.store.ten_cua_hang = ten;
  st.store.khach_hang_muc_tieu = document.getElementById('store_khach').value.trim();
  st.store.diem_noi_bat = document.getElementById('store_diem_noi_bat').value.trim();
  st.store.lien_he = document.getElementById('store_lien_he').value.trim();
  st.store.ghi_chu_gia = document.getElementById('store_ghi_chu_gia').value.trim();
  saveWorkspace();
  activeStoreCaptionEl.textContent = `${st.store.ten_cua_hang} • ${getIndustryMeta().name}`;
  const msgEl = document.getElementById('storeSaveMsg');
  msgEl.textContent = '✓ Đã lưu thông tin cửa hàng!';
  setTimeout(() => { msgEl.textContent = ''; }, 2500);
});

document.getElementById('addProductBtn').addEventListener('click', () => openProductModal(null));
document.getElementById('saveProductModalBtn').addEventListener('click', saveProductFromModal);

document.getElementById('reloadIndustryBtn').addEventListener('click', () => {
  const meta = getIndustryMeta();
  if (!confirm(`Nạp lại dữ liệu mẫu mặc định cho ngành "${meta.name}"? (Lịch sử bài đã lưu không bị mất)`)) return;
  workspace.industries[meta.id] = {
    store: deepClone(meta.store),
    products: deepClone(meta.products),
    activeProductId: meta.products[0]?.id || null,
    chat: [
      {
        role: 'ai',
        time: nowTimeLabel(),
        content: `Đã nạp lại dữ liệu mẫu cho "${meta.name}". Bạn có thể chọn mặt hàng hoặc hỏi tôi xem có lãi không nhé!`
      }
    ]
  };
  saveWorkspace();
  renderAllForActiveIndustry(true);
});

document.getElementById('resetDemoBtn').addEventListener('click', () => {
  if (!confirm('Làm mới lại toàn bộ dữ liệu mẫu 6 ngành về ban đầu?')) return;
  workspace = buildInitialWorkspace();
  saveWorkspace();
  renderAllForActiveIndustry(true);
});

document.getElementById('saveNumbersToProductBtn').addEventListener('click', () => {
  const sp = getActiveProduct();
  if (!sp) return;
  const gv = calcGiaVon.value.trim() === '' ? null : parseStrictInt(calcGiaVon.value);
  const dg = parseStrictInt(calcGiaBan.value);
  const kmVal = parseStrictInt(calcGiaTriKm.value);
  if (dg === null || dg <= 0) {
    alert('Giá bán gốc chưa hợp lệ.');
    return;
  }
  sp.gia_von = gv;
  sp.don_gia = dg;
  sp.so_luong = parseStrictInt(calcSoLuong.value) || 1;
  sp.loai_km = calcLoaiKm.value;
  sp.gia_tri_km = kmVal ?? 0;
  sp.sl_toi_thieu = parseStrictInt(calcSlToiThieu.value) || 2;
  sp.dong_goi = parseStrictInt(calcDongGoi.value || '0') ?? 0;
  sp.ho_tro_ship = parseStrictInt(calcHoTroShip.value || '0') ?? 0;
  sp.chi_phi_khac = parseStrictInt(calcChiPhiKhac.value || '0') ?? 0;
  saveWorkspace();
  renderProducts();
  alert(`Đã lưu số liệu mới vào mặt hàng "${sp.ten_san_pham}"!`);
});

document.getElementById('loadSample28kBtn').addEventListener('click', () => {
  workspace.activeIndustryId = 'an_uong';
  const st = getIndustryState('an_uong');
  st.activeProductId = st.products[0]?.id;
  saveWorkspace();
  renderAllForActiveIndustry(true);
});

document.getElementById('loadSample199kBtn').addEventListener('click', () => {
  workspace.activeIndustryId = 'thoi_trang';
  const st = getIndustryState('thoi_trang');
  st.activeProductId = st.products[0]?.id;
  saveWorkspace();
  renderAllForActiveIndustry(true);
});

document.querySelectorAll('.chip-btn[data-pct]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const pct = Number(btn.dataset.pct);
    if (calcLoaiKm.value === 'khong' || calcLoaiKm.value === 'tien_co_dinh') {
      calcLoaiKm.value = 'phan_tram';
      updateKmControlsUi();
    }
    calcGiaTriKm.value = String(pct);
    runCalculateOnly();
  });
});

[
  calcGiaVon,
  calcGiaBan,
  calcGiaTriKm,
  calcSoLuong,
  calcSlToiThieu,
  calcDongGoi,
  calcHoTroShip,
  calcChiPhiKhac,
  calcNguongLn
].forEach((el) => {
  el.addEventListener('input', scheduleCalculate);
});

calcLoaiKm.addEventListener('change', () => {
  updateKmControlsUi();
  runCalculateOnly();
});

chatSendBtn.addEventListener('click', () => sendChatMessage());
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

document.querySelectorAll('.suggest-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const prompt = chip.dataset.prompt;
    if (prompt.includes('Viết')) {
      requestGenerateKit(prompt);
    } else {
      sendChatMessage(prompt);
    }
  });
});

document.getElementById('clearChatBtn').addEventListener('click', () => {
  const st = getIndustryState();
  st.chat = [
    {
      role: 'ai',
      time: nowTimeLabel(),
      content: 'Đã xóa đoạn chat cũ. Bạn cần hỏi về tiền lãi hay nhờ viết lại bài đăng cho mặt hàng nào?'
    }
  ];
  saveWorkspace();
  renderChat();
});

generateKitBtn.addEventListener('click', () => requestGenerateKit(null));
regenerateKitBtn.addEventListener('click', () => requestGenerateKit('Viết lại phiên bản khác tự nhiên và dễ đọc hơn'));

document.querySelectorAll('.channel-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    syncEditorBackToState();
    activeChannel = tab.dataset.channel;
    renderKitEditors();
  });
});

copyActiveChannelBtn.addEventListener('click', async () => {
  syncEditorBackToState();
  let textToCopy = '';
  if (activeChannel === 'facebook') textToCopy = currentKit.bai_facebook;
  else if (activeChannel === 'zalo') textToCopy = currentKit.tin_nhan_zalo;
  else {
    textToCopy = currentKit.mau_tu_van
      .map((m) => `${m.tieu_de}\n${m.noi_dung}`)
      .join('\n\n');
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
    } else {
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    copyFeedback.textContent = '✓ Đã sao chép nội dung!';
  } catch {
    copyFeedback.textContent = 'Bạn vui lòng bôi đen chữ và bấm Ctrl+C để sao chép.';
  }
});

document.getElementById('saveHistoryBtn').addEventListener('click', handleSaveToHistory);
document.getElementById('exportCsvBtn').addEventListener('click', handleExportCsv);
document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  if (historyItems.length === 0) return;
  if (confirm('Xóa toàn bộ lịch sử bài đã lưu trên máy này?')) {
    historyItems = [];
    saveHistory();
  }
});

document.getElementById('checkFormulaBtn').addEventListener('click', openFormulaCheckModal);

// Khởi chạy ban đầu
checkServerHealth();
renderHistory();
renderAllForActiveIndustry(true);
