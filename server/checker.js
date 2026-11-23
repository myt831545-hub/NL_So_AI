/**
 * checker.js -- Bộ đối soát số liệu & lọc từ vi phạm trong bài viết AI (BR-08, BR-11, BR-12, BR-16).
 */

const { formatVndNumber } = require('./calculator');

const BANNED_PHRASES = [
  'rẻ nhất',
  'rẻ vô địch',
  'số 1',
  'cam kết 100%',
  'hiệu quả 100%',
  'tốt nhất thị trường',
  'duy nhất thị trường',
  'trị dứt điểm',
  'chữa khỏi hoàn toàn',
  'không đâu rẻ bằng',
  'giá gốc',
  'giá vốn',
  'giá nhập'
];

/**
 * Chuẩn hóa chuỗi ngày YYYY-MM-DD thành các biến thể tiếng Việt thường gặp.
 */
function buildDateVariants(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return [];
  const [y, m, d] = isoDate.split('-');
  const dNoPad = String(Number(d));
  const mNoPad = String(Number(m));
  return [
    `${d}/${m}/${y}`,
    `${dNoPad}/${mNoPad}/${y}`,
    `${d}/${m}`,
    `${dNoPad}/${mNoPad}`,
    `${d}-${m}-${y}`,
    `${dNoPad}-${mNoPad}-${y}`,
    `${d}-${m}`,
    `${dNoPad}-${mNoPad}`,
    isoDate
  ];
}

/**
 * Chuẩn hóa một token số về giá trị số học (hỗ trợ dấu chấm hàng nghìn và đơn vị k/nghìn/triệu).
 */
function parseVietnameseNumberToken(rawNumStr, unitStr = '') {
  const unit = (unitStr || '').toLowerCase();
  const trimmed = rawNumStr.trim();

  let numericValue;
  if (/^\d{1,3}([.,]\d{3})+$/.test(trimmed)) {
    numericValue = Number(trimmed.replace(/[.,]/g, ''));
  } else {
    numericValue = Number(trimmed.replace(',', '.'));
  }

  if (!Number.isFinite(numericValue)) return null;

  if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') {
    return Math.round(numericValue * 1000);
  }
  if (unit === 'tr' || unit === 'triệu') {
    return Math.round(numericValue * 1000000);
  }
  return numericValue;
}

/**
 * Trích xuất các số vốn có sẵn trong thông tin công khai do người dùng nhập để tránh báo nhầm.
 */
function extractWhitelistFromUserText(text, validNumberSet, validDateSet) {
  if (!text || typeof text !== 'string') return;

  const dateRegex = /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g;
  const cleanedText = text.replace(dateRegex, (match) => {
    validDateSet.add(match);
    return ' ';
  });

  const numRegex = /(-?\d+(?:[.,]\d{3})+|-?\d+(?:[.,]\d+)?)\s*(k|K|nghìn|ngàn|tr|triệu|%|đồng|đ|vnd|VND)?/g;
  let match;
  while ((match = numRegex.exec(cleanedText)) !== null) {
    const rawDigits = match[1].replace(/[.,]/g, '');
    if (/^\d{8,}$/.test(rawDigits)) continue;
    const val = parseVietnameseNumberToken(match[1], match[2] || '');
    if (val !== null) {
      validNumberSet.add(val);
    }
  }
}

function extractPhonePatterns(lienHe) {
  if (!lienHe || typeof lienHe !== 'string') return [];
  const matches = lienHe.match(/(?:\+?\d[\d.\-\s]{6,}\d)/g) || [];
  return matches
    .map((m) => m.replace(/\D/g, ''))
    .filter((digits) => digits.length >= 8);
}

function stripAllowedPhones(text, allowedPhoneDigits) {
  if (!allowedPhoneDigits.length) return text;
  return text.replace(/(?:\+?\d[\d.\-\s]{6,}\d)/g, (candidate) => {
    const digits = candidate.replace(/\D/g, '');
    if (digits.length >= 8 && allowedPhoneDigits.some((p) => p === digits || digits.endsWith(p) || p.endsWith(digits))) {
      return ' ';
    }
    return candidate;
  });
}

function formatTokenForDisplay(numericVal, rawToken) {
  if (Number.isInteger(numericVal) && numericVal >= 1000) {
    return formatVndNumber(numericVal);
  }
  return rawToken.trim();
}

/**
 * Kiểm tra từ ngữ vi phạm / phóng đại không căn cứ (BR-11).
 */
function checkBannedWords(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase));
}

/**
 * Thực hiện đối soát một bài viết AI (BR-08, BR-11, BR-12, BR-16).
 */
function checkPost({ baiViet, publicInput, congKhai, noiBo, giaVon, extraValidText = '' }) {
  const tieuDe = baiViet && typeof baiViet.tieu_de === 'string' ? baiViet.tieu_de : '';
  const noiDung = baiViet && typeof baiViet.noi_dung === 'string' ? baiViet.noi_dung : '';
  const hashtags = Array.isArray(baiViet && baiViet.hashtag) ? baiViet.hashtag.join(' ') : '';

  const mainText = `${tieuDe}\n${noiDung}`;

  const validNumbers = new Set([
    publicInput.don_gia,
    publicInput.so_luong,
    congKhai.tong_tien_hang,
    congKhai.tien_giam,
    congKhai.thanh_tien,
    congKhai.gia_binh_quan
  ]);

  if (publicInput.khuyen_mai && publicInput.khuyen_mai.loai !== 'khong') {
    if (publicInput.khuyen_mai.gia_tri !== null && publicInput.khuyen_mai.gia_tri !== undefined) {
      validNumbers.add(publicInput.khuyen_mai.gia_tri);
    }
    if (publicInput.khuyen_mai.so_luong_toi_thieu !== null && publicInput.khuyen_mai.so_luong_toi_thieu !== undefined) {
      validNumbers.add(publicInput.khuyen_mai.so_luong_toi_thieu);
    }
  }

  const validDates = new Set();
  if (publicInput.khuyen_mai) {
    for (const d of buildDateVariants(publicInput.khuyen_mai.ngay_bat_dau)) validDates.add(d);
    for (const d of buildDateVariants(publicInput.khuyen_mai.ngay_ket_thuc)) validDates.add(d);
  }

  extractWhitelistFromUserText(publicInput.ten_san_pham, validNumbers, validDates);
  extractWhitelistFromUserText(publicInput.mo_ta, validNumbers, validDates);
  extractWhitelistFromUserText(publicInput.ghi_chu_gia, validNumbers, validDates);
  extractWhitelistFromUserText(publicInput.lien_he, validNumbers, validDates);
  extractWhitelistFromUserText(extraValidText, validNumbers, validDates);

  const internalNumbers = new Set();
  if (noiBo && noiBo.co_gia_von) {
    const candidates = [
      giaVon,
      noiBo.tong_gia_von,
      noiBo.chi_phi_phat_sinh,
      noiBo.tong_chi_phi_khai_bao,
      noiBo.lai_gop,
      noiBo.loi_nhuan_sau_chi_phi,
      noiBo.bien_lai_gop_phan_tram,
      noiBo.bien_loi_nhuan_phan_tram,
      noiBo.giam_toi_da_khong_lo_phan_tram,
      noiBo.giam_toi_da_hoa_von_phan_tram,
      noiBo.giam_toi_da_hoa_von_tien
    ];
    for (const val of candidates) {
      if (typeof val === 'number' && Number.isFinite(val) && !validNumbers.has(val)) {
        internalNumbers.add(val);
      }
    }
  }

  const allowedPhones = extractPhonePatterns(publicInput.lien_he);
  const textWithoutPhones = stripAllowedPhones(mainText, allowedPhones);

  const soLaSet = new Set();
  const loNoiBoSet = new Set();

  const dateRegex = /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g;
  const textWithoutDates = textWithoutPhones.replace(dateRegex, (dateMatch) => {
    if (!validDates.has(dateMatch)) {
      soLaSet.add(dateMatch);
    }
    return ' ';
  });

  const numberRegex = /(\d+(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|K|nghìn|ngàn|tr|triệu|%|đồng|đ|vnd|VND)?/g;
  let match;
  while ((match = numberRegex.exec(textWithoutDates)) !== null) {
    const rawNumber = match[1];
    const unit = match[2] || '';
    const parsed = parseVietnameseNumberToken(rawNumber, unit);
    if (parsed === null) continue;

    if (internalNumbers.has(parsed)) {
      loNoiBoSet.add(formatTokenForDisplay(parsed, rawNumber));
    } else if (!validNumbers.has(parsed)) {
      soLaSet.add(formatTokenForDisplay(parsed, rawNumber));
    }
  }

  if (internalNumbers.size > 0 && hashtags) {
    const hashCleaned = stripAllowedPhones(hashtags, allowedPhones).replace(dateRegex, ' ');
    let hMatch;
    while ((hMatch = numberRegex.exec(hashCleaned)) !== null) {
      const parsed = parseVietnameseNumberToken(hMatch[1], hMatch[2] || '');
      if (parsed !== null && internalNumbers.has(parsed)) {
        loNoiBoSet.add(formatTokenForDisplay(parsed, hMatch[1]));
      }
    }
  }

  let thieuGhiChuGia = false;
  const ghiChu = (publicInput.ghi_chu_gia || '').trim();
  if (ghiChu !== '') {
    const normalizeWs = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalizeWs(mainText).includes(normalizeWs(ghiChu))) {
      thieuGhiChuGia = true;
    }
  }

  const tu_vi_pham = checkBannedWords(mainText);
  const so_la = Array.from(soLaSet);
  const lo_noi_bo = Array.from(loNoiBoSet);
  const dat = so_la.length === 0 && lo_noi_bo.length === 0;

  return {
    dat,
    so_la,
    lo_noi_bo,
    tu_vi_pham,
    thieu_ghi_chu_gia: thieuGhiChuGia
  };
}

/**
 * Đối soát toàn bộ bộ 3 nội dung công khai (Facebook, Zalo, 3 Mẫu tư vấn).
 */
function checkContentKit({ kit, publicInput, congKhai, noiBo, giaVon, extraValidText = '' }) {
  const mauList = Array.isArray(kit.mau_tu_van) ? kit.mau_tu_van.map((m) => m.noi_dung || '').join('\n') : '';
  const combinedPublic = {
    tieu_de: '',
    noi_dung: [
      kit.bai_facebook || '',
      kit.tin_nhan_zalo || '',
      mauList
    ].join('\n\n'),
    hashtag: []
  };

  // Đánh số thứ tự 1, 2, 3 của 3 mẫu trả lời vào whitelist nếu có tiêu đề Mẫu 1, Mẫu 2, Mẫu 3
  const baseAudit = checkPost({
    baiViet: combinedPublic,
    publicInput,
    congKhai,
    noiBo,
    giaVon,
    extraValidText: `${extraValidText} 1 2 3`
  });

  // Riêng kiểm tra ghi chú giá chỉ cần có trong bài Facebook chính
  let thieuGhiChuGia = false;
  const ghiChu = (publicInput.ghi_chu_gia || '').trim();
  if (ghiChu !== '') {
    const normalizeWs = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalizeWs(kit.bai_facebook || '').includes(normalizeWs(ghiChu))) {
      thieuGhiChuGia = true;
    }
  }

  return {
    ...baseAudit,
    thieu_ghi_chu_gia: thieuGhiChuGia
  };
}

module.exports = {
  BANNED_PHRASES,
  checkPost,
  checkContentKit,
  checkBannedWords,
  buildDateVariants,
  parseVietnameseNumberToken
};
