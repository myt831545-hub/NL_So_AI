const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateCalcInput,
  validatePostInput,
  calculatePricing
} = require('../server/calculator');

test('A1: Ví dụ chuẩn -- Giá 199.000, SL 2, giảm 20% khi mua từ 2, vốn 120.000', () => {
  const val = validateCalcInput({
    don_gia: 199000,
    so_luong: 2,
    khuyen_mai: { loai: 'phan_tram_theo_so_luong', gia_tri: 20, so_luong_toi_thieu: 2 },
    gia_von: 120000
  });
  assert.equal(val.hop_le, true);
  const res = calculatePricing(val.data);
  assert.deepEqual(res.cong_khai, {
    tong_tien_hang: 398000,
    tien_giam: 79600,
    thanh_tien: 318400,
    gia_binh_quan: 159200,
    phan_tram_giam_thuc_te: 20,
    duoc_ap_dung_km: true
  });
  assert.deepEqual(res.noi_bo, {
    co_gia_von: true,
    tong_gia_von: 240000,
    chi_phi_phat_sinh: 0,
    tong_chi_phi_khai_bao: 240000,
    lai_gop: 78400,
    loi_nhuan_sau_chi_phi: 78400,
    bien_lai_gop_phan_tram: 24.6,
    bien_loi_nhuan_phan_tram: 24.62,
    giam_toi_da_khong_lo_phan_tram: 39.7,
    giam_toi_da_hoa_von_phan_tram: 39.7,
    giam_toi_da_hoa_von_tien: 158000,
    gia_hoa_von: 240000,
    canh_bao_lo: false,
    canh_bao_bien_thap: false,
    trang_thai_loi_nhuan: 'co_lai',
    lo_moi_san_pham: 0
  });
});

test('A2: Chưa đủ số lượng tối thiểu -- Giá 199.000, SL 1, giảm 20% từ 2 sp, vốn 120.000', () => {
  const val = validateCalcInput({
    don_gia: 199000,
    so_luong: 1,
    khuyen_mai: { loai: 'phan_tram_theo_so_luong', gia_tri: 20, so_luong_toi_thieu: 2 },
    gia_von: 120000
  });
  assert.equal(val.hop_le, true);
  const res = calculatePricing(val.data);
  assert.equal(res.cong_khai.tien_giam, 0);
  assert.equal(res.cong_khai.thanh_tien, 199000);
  assert.equal(res.cong_khai.duoc_ap_dung_km, false);
  assert.equal(res.noi_bo.lai_gop, 79000);
  assert.equal(res.noi_bo.bien_lai_gop_phan_tram, 39.7);
});

test('A3: Giảm tiền cố định -- Giá 199.000, SL 1, giảm 30.000, vốn 120.000', () => {
  const val = validateCalcInput({
    don_gia: 199000,
    so_luong: 1,
    khuyen_mai: { loai: 'tien_co_dinh', gia_tri: 30000 },
    gia_von: 120000
  });
  assert.equal(val.hop_le, true);
  const res = calculatePricing(val.data);
  assert.equal(res.cong_khai.tien_giam, 30000);
  assert.equal(res.cong_khai.thanh_tien, 169000);
  assert.equal(res.noi_bo.lai_gop, 49000);
  assert.equal(res.noi_bo.bien_lai_gop_phan_tram, 29.0);
});

test('A4: Cảnh báo bán lỗ -- Giá 199.000, SL 1, giảm 50%, vốn 120.000', () => {
  const val = validateCalcInput({
    don_gia: 199000,
    so_luong: 1,
    khuyen_mai: { loai: 'phan_tram', gia_tri: 50 },
    gia_von: 120000
  });
  assert.equal(val.hop_le, true);
  const res = calculatePricing(val.data);
  assert.equal(res.cong_khai.tien_giam, 99500);
  assert.equal(res.cong_khai.thanh_tien, 99500);
  assert.equal(res.noi_bo.lai_gop, -20500);
  assert.equal(res.noi_bo.bien_lai_gop_phan_tram, -20.6);
  assert.equal(res.noi_bo.canh_bao_lo, true);
  assert.equal(res.noi_bo.lo_moi_san_pham, 20500);
});

test('A5: Làm tròn 0,5 lên & không nhập giá vốn -- Giá 99.990, SL 3, giảm 15%', () => {
  const val = validateCalcInput({
    don_gia: 99990,
    so_luong: 3,
    khuyen_mai: { loai: 'phan_tram', gia_tri: 15 },
    gia_von: null
  });
  assert.equal(val.hop_le, true);
  const res = calculatePricing(val.data);
  assert.equal(res.cong_khai.tong_tien_hang, 299970);
  assert.equal(res.cong_khai.tien_giam, 44996);
  assert.equal(res.cong_khai.thanh_tien, 254974);
  assert.equal(res.cong_khai.gia_binh_quan, 84991);
  assert.equal(res.noi_bo.co_gia_von, false);
  assert.equal(res.noi_bo.canh_bao_lo, false);
});

test('A6: Không khuyến mãi -- Giá 199.000, SL 1', () => {
  const val = validateCalcInput({
    don_gia: 199000,
    so_luong: 1,
    khuyen_mai: { loai: 'khong' }
  });
  assert.equal(val.hop_le, true);
  const res = calculatePricing(val.data);
  assert.equal(res.cong_khai.tien_giam, 0);
  assert.equal(res.cong_khai.thanh_tien, 199000);
});

test('A7: Giảm tiền cố định >= tổng tiền hàng phải báo lỗi (BR-05)', () => {
  const over = validateCalcInput({
    don_gia: 199000,
    so_luong: 1,
    khuyen_mai: { loai: 'tien_co_dinh', gia_tri: 500000 }
  });
  assert.equal(over.hop_le, false);
  assert.ok(over.loi.some((e) => e.truong === 'gia_tri_km'));

  const equal = validateCalcInput({
    don_gia: 199000,
    so_luong: 1,
    khuyen_mai: { loai: 'tien_co_dinh', gia_tri: 199000 }
  });
  assert.equal(equal.hop_le, false);
});

test('A8: Giá vốn = 0 hợp lệ và tính lãi gộp bình thường (BR-09)', () => {
  const val = validateCalcInput({
    don_gia: 199000,
    so_luong: 1,
    khuyen_mai: { loai: 'khong' },
    gia_von: 0
  });
  assert.equal(val.hop_le, true);
  const res = calculatePricing(val.data);
  assert.equal(res.noi_bo.co_gia_von, true);
  assert.equal(res.noi_bo.tong_gia_von, 0);
  assert.equal(res.noi_bo.lai_gop, 199000);
  assert.equal(res.noi_bo.bien_lai_gop_phan_tram, 100);
  assert.equal(res.noi_bo.canh_bao_lo, false);
});

test('B1-B8: Kiểm tra từ chối dữ liệu đầu vào sai quy tắc', () => {
  // B1: Đơn giá = 0 hoặc trống
  assert.equal(validateCalcInput({ don_gia: 0, so_luong: 1 }).hop_le, false);
  assert.equal(validateCalcInput({ don_gia: '', so_luong: 1 }).hop_le, false);

  // B2: Đơn giá là chữ
  assert.equal(validateCalcInput({ don_gia: 'hai trăm', so_luong: 1 }).hop_le, false);

  // B3: Số lượng = 0 hoặc thập phân 1.5
  assert.equal(validateCalcInput({ don_gia: 100000, so_luong: 0 }).hop_le, false);
  assert.equal(validateCalcInput({ don_gia: 100000, so_luong: 1.5 }).hop_le, false);

  // B4: Giảm 120%
  assert.equal(
    validateCalcInput({ don_gia: 100000, so_luong: 1, khuyen_mai: { loai: 'phan_tram', gia_tri: 120 } }).hop_le,
    false
  );

  // B5 & B6: Có KM nhưng thiếu ngày hoặc ngày kết thúc < ngày bắt đầu
  const basePost = {
    ten_san_pham: 'Áo sơ mi',
    don_gia: 199000,
    so_luong: 2,
    nen_tang: 'facebook',
    phong_cach: 'tre_trung',
    do_dai: 'vua'
  };
  assert.equal(
    validatePostInput({
      ...basePost,
      khuyen_mai: { loai: 'phan_tram', gia_tri: 10, ngay_bat_dau: '', ngay_ket_thuc: '' }
    }).hop_le,
    false
  );
  assert.equal(
    validatePostInput({
      ...basePost,
      khuyen_mai: { loai: 'phan_tram', gia_tri: 10, ngay_bat_dau: '2026-11-30', ngay_ket_thuc: '2026-11-22' }
    }).hop_le,
    false
  );

  // B7: SL tối thiểu = 1
  assert.equal(
    validateCalcInput({
      don_gia: 199000,
      so_luong: 2,
      khuyen_mai: { loai: 'phan_tram_theo_so_luong', gia_tri: 20, so_luong_toi_thieu: 1 }
    }).hop_le,
    false
  );

  // B8: Tên sản phẩm quá ngắn hoặc quá dài
  assert.equal(
    validatePostInput({ ...basePost, ten_san_pham: 'A', khuyen_mai: { loai: 'khong' } }).hop_le,
    false
  );
  assert.equal(
    validatePostInput({ ...basePost, ten_san_pham: 'A'.repeat(101), khuyen_mai: { loai: 'khong' } }).hop_le,
    false
  );
});

test('B9: Máy chủ API từ chối dữ liệu sai (HTTP 400) và tính đúng ví dụ chuẩn (HTTP 200)', async () => {
  const app = require('../server/server');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    // Kiểm tra trang chủ phục vụ giao diện HTML
    const homeRes = await fetch(`${baseUrl}/`);
    assert.equal(homeRes.status, 200);
    const homeHtml = await homeRes.text();
    assert.ok(homeHtml.includes('SmartPost AI'));

    // B9: Gửi dữ liệu sai thẳng tới API phải trả mã 400
    const badRes = await fetch(`${baseUrl}/api/tinh-gia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ don_gia: -5000, so_luong: 1.5 })
    });
    assert.equal(badRes.status, 400);
    const badJson = await badRes.json();
    assert.equal(badJson.hop_le, false);

    const badPostRes = await fetch(`${baseUrl}/api/tao-bai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ten_san_pham: 'A', don_gia: 0 })
    });
    assert.equal(badPostRes.status, 400);

    // Gửi đúng ví dụ chuẩn A1 tới /api/tinh-gia
    const okRes = await fetch(`${baseUrl}/api/tinh-gia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        don_gia: 199000,
        so_luong: 2,
        khuyen_mai: { loai: 'phan_tram_theo_so_luong', gia_tri: 20, so_luong_toi_thieu: 2 },
        gia_von: 120000
      })
    });
    assert.equal(okRes.status, 200);
    const okJson = await okRes.json();
    assert.equal(okJson.hop_le, true);
    assert.equal(okJson.cong_khai.thanh_tien, 318400);
    assert.equal(okJson.noi_bo.lai_gop, 78400);

    // Kiểm tra chi phí phát sinh C (Mẫu Mẹt Bún Đậu 20k/40k/10%/2.5k)
    const bunDauRes = await fetch(`${baseUrl}/api/tinh-gia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        don_gia: 40000,
        so_luong: 1,
        gia_von: 20000,
        chi_phi: { dong_goi: 2500, ho_tro_ship: 0, chi_phi_khac: 0 },
        khuyen_mai: { loai: 'phan_tram', gia_tri: 10 }
      })
    });
    assert.equal(bunDauRes.status, 200);
    const bdJson = await bunDauRes.json();
    assert.equal(bdJson.cong_khai.thanh_tien, 36000);
    assert.equal(bdJson.noi_bo.lai_gop, 16000);
    assert.equal(bdJson.noi_bo.tong_chi_phi_khai_bao, 22500);
    assert.equal(bdJson.noi_bo.loi_nhuan_sau_chi_phi, 13500);
    assert.equal(bdJson.noi_bo.bien_loi_nhuan_phan_tram, 37.5);
    assert.equal(bdJson.noi_bo.giam_toi_da_hoa_von_phan_tram, 43.75);
    assert.equal(bdJson.noi_bo.giam_toi_da_hoa_von_tien, 17500);
    assert.equal(bdJson.noi_bo.trang_thai_loi_nhuan, 'co_lai');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('A9: Cảnh báo biên lợi nhuận thấp khi nhỏ hơn ngưỡng tham khảo', () => {
  const val = validateCalcInput({
    don_gia: 100000,
    so_luong: 1,
    gia_von: 85000,
    chi_phi: { dong_goi: 5000, ho_tro_ship: 0, chi_phi_khac: 0 },
    nguong_bien_ln_thap: 10,
    khuyen_mai: { loai: 'phan_tram', gia_tri: 5 }
  });
  assert.equal(val.hop_le, true);
  const res = calculatePricing(val.data);
  assert.equal(res.cong_khai.thanh_tien, 95000);
  assert.equal(res.noi_bo.loi_nhuan_sau_chi_phi, 5000);
  assert.equal(res.noi_bo.bien_loi_nhuan_phan_tram, 5.26);
  assert.equal(res.noi_bo.canh_bao_lo, false);
  assert.equal(res.noi_bo.canh_bao_bien_thap, true);
  assert.equal(res.noi_bo.trang_thai_loi_nhuan, 'bien_thap');
});
