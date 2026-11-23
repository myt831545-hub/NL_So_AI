/**
 * calculator.js -- Nguồn số liệu kế toán duy nhất của SmartPost AI.
 * Hỗ trợ đầy đủ công thức giá khuyến mãi, chi phí phát sinh (đóng gói, ship, khác),
 * lãi gộp, lợi nhuận sau chi phí khai báo, biên lợi nhuận và mức giảm hòa vốn.
 */

const PROMO_TYPES = ['khong', 'phan_tram', 'tien_co_dinh', 'phan_tram_theo_so_luong'];
const PLATFORMS = ['facebook', 'zalo'];
const STYLES = ['chuyen_nghiep', 'than_thien', 'hai_huoc', 'tre_trung', 'thu_hut'];
const LENGTHS = ['ngan', 'vua', 'dai'];

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * Kiểm tra giá trị có phải số nguyên hợp lệ hay không (không chấp nhận số thập phân hoặc chữ).
 */
function parseStrictInteger(value) {
  if (typeof value === 'number') {
    if (Number.isInteger(value) && Number.isSafeInteger(value)) {
      return { valid: true, value };
    }
    return { valid: false };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      if (Number.isSafeInteger(parsed)) {
        return { valid: true, value: parsed };
      }
    }
  }
  return { valid: false };
}

/**
 * Kiểm tra số thực không âm (dùng cho ngưỡng % cảnh báo biên lợi nhuận).
 */
function parseNonNegativeNumber(value, fallback = 10) {
  if (isBlank(value)) return { valid: true, value: fallback };
  const num = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    return { valid: false, value: fallback };
  }
  return { valid: true, value: num };
}

/**
 * Kiểm tra ngày định dạng YYYY-MM-DD có tồn tại thực tế trên lịch hay không.
 */
function isValidIsoDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() + 1 === m && utc.getUTCDate() === d;
}

function roundToDecimals(num, decimals = 1) {
  const factor = 10 ** decimals;
  const sign = num < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(num) * factor)) / factor;
}

/**
 * Định dạng số nguyên thành chuỗi ngăn cách hàng nghìn bằng dấu chấm (VD: 199000 -> "199.000").
 */
function formatVndNumber(num) {
  if (typeof num !== 'number' || !Number.isFinite(num)) return '';
  const sign = num < 0 ? '-' : '';
  const absStr = String(Math.abs(Math.trunc(num)));
  return sign + absStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Kiểm tra dữ liệu đầu vào cho API tính giá (BR-01 đến BR-06, BR-10 + chi phí phát sinh).
 */
function validateCalcInput(body, options = { requireDatesForPromo: false }) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      hop_le: false,
      loi: [{ truong: 'chung', thong_bao: 'Dữ liệu gửi lên không đúng định dạng.' }],
      data: null
    };
  }

  // 1. Đơn giá (BR-02)
  const donGiaRes = parseStrictInteger(body.don_gia);
  if (isBlank(body.don_gia) || !donGiaRes.valid || donGiaRes.value <= 0) {
    errors.push({
      truong: 'don_gia',
      thong_bao: 'Đơn giá phải là số nguyên lớn hơn 0.'
    });
  }

  // 2. Số lượng (BR-02, mặc định 1 nếu bỏ qua trong API)
  let soLuongVal = 1;
  if (body.so_luong !== undefined) {
    const soLuongRes = parseStrictInteger(body.so_luong);
    if (isBlank(body.so_luong) || !soLuongRes.valid || soLuongRes.value < 1) {
      errors.push({
        truong: 'so_luong',
        thong_bao: 'Số lượng phải là số nguyên từ 1 trở lên.'
      });
    } else {
      soLuongVal = soLuongRes.value;
    }
  }

  // 3. Giá vốn (tùy chọn, BR-09)
  let giaVonVal = null;
  if (!isBlank(body.gia_von)) {
    const giaVonRes = parseStrictInteger(body.gia_von);
    if (!giaVonRes.valid || giaVonRes.value < 0) {
      errors.push({
        truong: 'gia_von',
        thong_bao: 'Giá vốn phải là số nguyên từ 0 trở lên.'
      });
    } else {
      giaVonVal = giaVonRes.value;
    }
  }

  // 4. Chi phí phát sinh trên mỗi đơn: đóng gói + hỗ trợ ship + chi phí khác
  const rawChiPhi = body.chi_phi && typeof body.chi_phi === 'object' ? body.chi_phi : {};
  const costFields = [
    ['dong_goi', 'Chi phí đóng gói / hộp'],
    ['ho_tro_ship', 'Chi phí hỗ trợ ship'],
    ['chi_phi_khac', 'Chi phí khác']
  ];
  const chiPhiVal = { dong_goi: 0, ho_tro_ship: 0, chi_phi_khac: 0 };
  for (const [key, label] of costFields) {
    if (!isBlank(rawChiPhi[key])) {
      const parsed = parseStrictInteger(rawChiPhi[key]);
      if (!parsed.valid || parsed.value < 0) {
        errors.push({
          truong: key,
          thong_bao: `${label} phải là số nguyên từ 0 trở lên.`
        });
      } else {
        chiPhiVal[key] = parsed.value;
      }
    }
  }

  // 5. Ngưỡng cảnh báo biên lợi nhuận thấp (%)
  const nguongRes = parseNonNegativeNumber(body.nguong_bien_ln_thap, 10);
  if (!nguongRes.valid) {
    errors.push({
      truong: 'nguong_bien_ln_thap',
      thong_bao: 'Ngưỡng cảnh báo biên lợi nhuận phải từ 0 đến 100 (%).'
    });
  }

  // 6. Khuyến mãi (BR-03, BR-04, BR-05, BR-06, BR-10)
  const rawKm = body.khuyen_mai === undefined ? { loai: 'khong' } : body.khuyen_mai;
  let loaiKm = 'khong';
  let giaTriKm = null;
  let slToiThieu = null;
  let ngayBatDau = '';
  let ngayKetThuc = '';

  if (!rawKm || typeof rawKm !== 'object' || Array.isArray(rawKm)) {
    errors.push({
      truong: 'loai_km',
      thong_bao: 'Thông tin khuyến mãi không hợp lệ.'
    });
  } else {
    loaiKm = isBlank(rawKm.loai) ? 'khong' : String(rawKm.loai).trim();
    if (!PROMO_TYPES.includes(loaiKm)) {
      errors.push({
        truong: 'loai_km',
        thong_bao: 'Loại khuyến mãi không được hỗ trợ.'
      });
    }

    if (loaiKm === 'phan_tram' || loaiKm === 'phan_tram_theo_so_luong') {
      // Cho phép 0% khi người dùng chọn thử nhanh mức giảm 0%
      const allowZero = loaiKm === 'phan_tram' && rawKm.cho_phep_0 === true;
      const pctRes = parseStrictInteger(rawKm.gia_tri);
      const minPct = allowZero ? 0 : 1;
      if (isBlank(rawKm.gia_tri) || !pctRes.valid || pctRes.value < minPct || pctRes.value > 99) {
        errors.push({
          truong: 'gia_tri_km',
          thong_bao: `Tỷ lệ giảm phải là số nguyên từ ${minPct} đến 99 (%).`
        });
      } else {
        giaTriKm = pctRes.value;
      }
    }

    if (loaiKm === 'tien_co_dinh') {
      const moneyRes = parseStrictInteger(rawKm.gia_tri);
      if (isBlank(rawKm.gia_tri) || !moneyRes.valid || moneyRes.value <= 0) {
        errors.push({
          truong: 'gia_tri_km',
          thong_bao: 'Số tiền giảm phải là số nguyên lớn hơn 0.'
        });
      } else {
        giaTriKm = moneyRes.value;
        if (donGiaRes.valid && donGiaRes.value > 0 && soLuongVal >= 1) {
          const tongTam = donGiaRes.value * soLuongVal;
          if (giaTriKm >= tongTam) {
            errors.push({
              truong: 'gia_tri_km',
              thong_bao: `Số tiền giảm phải nhỏ hơn tổng tiền hàng (${formatVndNumber(tongTam)}đ).`
            });
          }
        }
      }
    }

    if (loaiKm === 'phan_tram_theo_so_luong') {
      const minQtyRes = parseStrictInteger(rawKm.so_luong_toi_thieu);
      if (isBlank(rawKm.so_luong_toi_thieu) || !minQtyRes.valid || minQtyRes.value < 2) {
        errors.push({
          truong: 'sl_toi_thieu',
          thong_bao: 'Số lượng tối thiểu để được giảm phải là số nguyên từ 2 trở lên.'
        });
      } else {
        slToiThieu = minQtyRes.value;
      }
    }

    if (loaiKm !== 'khong' && !(loaiKm === 'phan_tram' && giaTriKm === 0)) {
      const rawStart = typeof rawKm.ngay_bat_dau === 'string' ? rawKm.ngay_bat_dau.trim() : '';
      const rawEnd = typeof rawKm.ngay_ket_thuc === 'string' ? rawKm.ngay_ket_thuc.trim() : '';

      const startProvided = rawStart !== '';
      const endProvided = rawEnd !== '';

      if (options.requireDatesForPromo && !startProvided) {
        errors.push({
          truong: 'ngay_bat_dau',
          thong_bao: 'Khi có khuyến mãi, vui lòng chọn ngày bắt đầu áp dụng.'
        });
      } else if (startProvided && !isValidIsoDate(rawStart)) {
        errors.push({
          truong: 'ngay_bat_dau',
          thong_bao: 'Ngày bắt đầu không hợp lệ.'
        });
      }

      if (options.requireDatesForPromo && !endProvided) {
        errors.push({
          truong: 'ngay_ket_thuc',
          thong_bao: 'Khi có khuyến mãi, vui lòng chọn ngày kết thúc áp dụng.'
        });
      } else if (endProvided && !isValidIsoDate(rawEnd)) {
        errors.push({
          truong: 'ngay_ket_thuc',
          thong_bao: 'Ngày kết thúc không hợp lệ.'
        });
      }

      if (isValidIsoDate(rawStart) && isValidIsoDate(rawEnd) && rawEnd < rawStart) {
        errors.push({
          truong: 'ngay_ket_thuc',
          thong_bao: 'Ngày kết thúc không được trước ngày bắt đầu.'
        });
      }

      ngayBatDau = isValidIsoDate(rawStart) ? rawStart : '';
      ngayKetThuc = isValidIsoDate(rawEnd) ? rawEnd : '';
    }
  }

  if (errors.length > 0) {
    return { hop_le: false, loi: errors, data: null };
  }

  return {
    hop_le: true,
    loi: [],
    data: {
      don_gia: donGiaRes.value,
      so_luong: soLuongVal,
      gia_von: giaVonVal,
      chi_phi: chiPhiVal,
      nguong_bien_ln_thap: nguongRes.value,
      khuyen_mai: {
        loai: loaiKm,
        gia_tri: giaTriKm,
        so_luong_toi_thieu: slToiThieu,
        ngay_bat_dau: ngayBatDau,
        ngay_ket_thuc: ngayKetThuc
      }
    }
  };
}

/**
 * Kiểm tra đầy đủ dữ liệu đầu vào cho API tạo bài (mục 2.2 + 2.4).
 */
function validatePostInput(body, options = { requireDatesForPromo: true }) {
  const calcValidation = validateCalcInput(body, options);
  const errors = [...calcValidation.loi];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return calcValidation;
  }

  const tenSanPham = typeof body.ten_san_pham === 'string' ? body.ten_san_pham.trim() : '';
  if (tenSanPham.length < 2 || tenSanPham.length > 100) {
    errors.push({
      truong: 'ten_san_pham',
      thong_bao: 'Tên sản phẩm/dịch vụ phải từ 2 đến 100 ký tự.'
    });
  }

  const moTa = typeof body.mo_ta === 'string' ? body.mo_ta.trim() : '';
  if (moTa.length > 500) {
    errors.push({
      truong: 'mo_ta',
      thong_bao: 'Đặc điểm nổi bật tối đa 500 ký tự.'
    });
  }

  const ghiChuGia = typeof body.ghi_chu_gia === 'string' ? body.ghi_chu_gia.trim() : '';
  if (ghiChuGia.length > 150) {
    errors.push({
      truong: 'ghi_chu_gia',
      thong_bao: 'Ghi chú về giá tối đa 150 ký tự.'
    });
  }

  const lienHe = typeof body.lien_he === 'string' ? body.lien_he.trim() : '';
  if (lienHe.length > 150) {
    errors.push({
      truong: 'lien_he',
      thong_bao: 'Thông tin liên hệ tối đa 150 ký tự.'
    });
  }

  const nenTang = typeof body.nen_tang === 'string' ? body.nen_tang.trim() : 'facebook';
  if (!PLATFORMS.includes(nenTang)) {
    errors.push({
      truong: 'nen_tang',
      thong_bao: 'Vui lòng chọn nền tảng Facebook hoặc Zalo.'
    });
  }

  const phongCach = typeof body.phong_cach === 'string' ? body.phong_cach.trim() : 'than_thien';
  if (!STYLES.includes(phongCach)) {
    errors.push({
      truong: 'phong_cach',
      thong_bao: 'Phong cách bài viết không hợp lệ.'
    });
  }

  const doDai = typeof body.do_dai === 'string' ? body.do_dai.trim() : 'vua';
  if (!LENGTHS.includes(doDai)) {
    errors.push({
      truong: 'do_dai',
      thong_bao: 'Độ dài bài viết không hợp lệ.'
    });
  }

  if (errors.length > 0) {
    return { hop_le: false, loi: errors, data: null };
  }

  return {
    hop_le: true,
    loi: [],
    data: {
      ...calcValidation.data,
      ten_san_pham: tenSanPham,
      mo_ta: moTa,
      ghi_chu_gia: ghiChuGia,
      lien_he: lienHe,
      nen_tang: nenTang,
      phong_cach: phongCach,
      do_dai: doDai
    }
  };
}

/**
 * Tính toàn bộ chỉ tiêu công khai và nội bộ (mục 2.5, BR-07, BR-09 + Chi phí phát sinh C).
 */
function calculatePricing(validData) {
  const { don_gia, so_luong, gia_von, khuyen_mai } = validData;
  const chi_phi = validData.chi_phi || { dong_goi: 0, ho_tro_ship: 0, chi_phi_khac: 0 };
  const nguong_bien_ln_thap = validData.nguong_bien_ln_thap ?? 10;

  const tong_tien_hang = don_gia * so_luong;

  let tien_giam = 0;
  let duoc_ap_dung_km = false;

  if (khuyen_mai.loai === 'phan_tram') {
    duoc_ap_dung_km = khuyen_mai.gia_tri > 0;
    tien_giam = Math.floor((tong_tien_hang * khuyen_mai.gia_tri + 50) / 100);
  } else if (khuyen_mai.loai === 'tien_co_dinh') {
    duoc_ap_dung_km = true;
    tien_giam = khuyen_mai.gia_tri;
  } else if (khuyen_mai.loai === 'phan_tram_theo_so_luong') {
    if (so_luong >= khuyen_mai.so_luong_toi_thieu) {
      duoc_ap_dung_km = true;
      tien_giam = Math.floor((tong_tien_hang * khuyen_mai.gia_tri + 50) / 100);
    } else {
      duoc_ap_dung_km = false;
      tien_giam = 0;
    }
  }

  const thanh_tien = tong_tien_hang - tien_giam;
  const gia_binh_quan = Math.floor((thanh_tien * 2 + so_luong) / (2 * so_luong));
  const phan_tram_giam_thuc_te = roundToDecimals((tien_giam / tong_tien_hang) * 100, 1);

  const cong_khai = {
    tong_tien_hang,
    tien_giam,
    thanh_tien,
    gia_binh_quan,
    phan_tram_giam_thuc_te,
    duoc_ap_dung_km
  };

  const chi_phi_phat_sinh = chi_phi.dong_goi + chi_phi.ho_tro_ship + chi_phi.chi_phi_khac;

  if (gia_von === null || gia_von === undefined) {
    return {
      cong_khai,
      noi_bo: {
        co_gia_von: false,
        tong_gia_von: null,
        chi_phi_phat_sinh,
        tong_chi_phi_khai_bao: null,
        lai_gop: null,
        loi_nhuan_sau_chi_phi: null,
        bien_lai_gop_phan_tram: null,
        bien_loi_nhuan_phan_tram: null,
        giam_toi_da_khong_lo_phan_tram: null,
        giam_toi_da_hoa_von_phan_tram: null,
        giam_toi_da_hoa_von_tien: null,
        gia_hoa_von: null,
        canh_bao_lo: false,
        canh_bao_bien_thap: false,
        trang_thai_loi_nhuan: 'chua_co_von',
        lo_moi_san_pham: 0
      }
    };
  }

  const tong_gia_von = gia_von * so_luong;
  const lai_gop = thanh_tien - tong_gia_von;
  const tong_chi_phi_khai_bao = tong_gia_von + chi_phi_phat_sinh;
  const loi_nhuan_sau_chi_phi = thanh_tien - tong_chi_phi_khai_bao;

  const bien_lai_gop_phan_tram = roundToDecimals((lai_gop / thanh_tien) * 100, 1);
  const bien_loi_nhuan_phan_tram = roundToDecimals((loi_nhuan_sau_chi_phi / thanh_tien) * 100, 2);

  const giam_toi_da_khong_lo_phan_tram = roundToDecimals(((don_gia - gia_von) / don_gia) * 100, 1);
  const giam_toi_da_hoa_von_tien = tong_tien_hang - tong_chi_phi_khai_bao;
  const giam_toi_da_hoa_von_phan_tram = roundToDecimals(
    (giam_toi_da_hoa_von_tien / tong_tien_hang) * 100,
    2
  );
  const gia_hoa_von = tong_chi_phi_khai_bao;

  const canh_bao_lo = loi_nhuan_sau_chi_phi < 0;
  const canh_bao_bien_thap = !canh_bao_lo && bien_loi_nhuan_phan_tram < nguong_bien_ln_thap;
  const trang_thai_loi_nhuan = canh_bao_lo ? 'ban_lo' : canh_bao_bien_thap ? 'bien_thap' : 'co_lai';
  const lo_moi_san_pham = canh_bao_lo
    ? Math.floor(((tong_chi_phi_khai_bao - thanh_tien) * 2 + so_luong) / (2 * so_luong))
    : 0;

  return {
    cong_khai,
    noi_bo: {
      co_gia_von: true,
      tong_gia_von,
      chi_phi_phat_sinh,
      tong_chi_phi_khai_bao,
      lai_gop,
      loi_nhuan_sau_chi_phi,
      bien_lai_gop_phan_tram,
      bien_loi_nhuan_phan_tram,
      giam_toi_da_khong_lo_phan_tram,
      giam_toi_da_hoa_von_phan_tram,
      giam_toi_da_hoa_von_tien,
      gia_hoa_von,
      canh_bao_lo,
      canh_bao_bien_thap,
      trang_thai_loi_nhuan,
      lo_moi_san_pham
    }
  };
}

/**
 * Tách riêng phần dữ liệu công khai, tuyệt đối loại bỏ giá vốn và chi phí nội bộ trước khi đưa cho AI (BR-08).
 */
function extractPublicData(validData) {
  return {
    ten_san_pham: validData.ten_san_pham,
    mo_ta: validData.mo_ta || '',
    don_gia: validData.don_gia,
    so_luong: validData.so_luong,
    khuyen_mai: { ...validData.khuyen_mai },
    ghi_chu_gia: validData.ghi_chu_gia || '',
    lien_he: validData.lien_he || '',
    nen_tang: validData.nen_tang,
    phong_cach: validData.phong_cach,
    do_dai: validData.do_dai
  };
}

module.exports = {
  PROMO_TYPES,
  PLATFORMS,
  STYLES,
  LENGTHS,
  formatVndNumber,
  validateCalcInput,
  validatePostInput,
  calculatePricing,
  extractPublicData
};
