const test = require('node:test');
const assert = require('node:assert/strict');

const { checkPost, checkContentKit, checkBannedWords } = require('../server/checker');
const { buildPrompt, parseAiJsonResponse } = require('../server/ai');
const { calculatePricing, extractPublicData, validatePostInput } = require('../server/calculator');

const sampleValidation = validatePostInput({
  ten_san_pham: 'Áo sơ mi nữ lụa mềm',
  mo_ta: 'Chất lụa thoáng mát, đủ size S-M-L',
  don_gia: 199000,
  so_luong: 2,
  khuyen_mai: {
    loai: 'phan_tram_theo_so_luong',
    gia_tri: 20,
    so_luong_toi_thieu: 2,
    ngay_bat_dau: '2026-11-22',
    ngay_ket_thuc: '2026-11-30'
  },
  ghi_chu_gia: 'Giá chưa gồm phí vận chuyển',
  lien_he: '0912.345.678 - Số 10 Nguyễn Văn Linh',
  gia_von: 120000,
  nen_tang: 'facebook',
  phong_cach: 'tre_trung',
  do_dai: 'vua'
});

const sampleData = sampleValidation.data;
const samplePricing = calculatePricing(sampleData);
const samplePublic = extractPublicData(sampleData);

test('BR-08: Prompt gửi cho AI tuyệt đối không chứa giá vốn hay lãi gộp', () => {
  const prompt = buildPrompt(samplePublic, samplePricing.cong_khai);
  assert.equal(prompt.includes('120.000'), false);
  assert.equal(prompt.includes('240.000'), false);
  assert.equal(prompt.includes('78.400'), false);
  assert.equal(prompt.includes('318.400'), true);
});

test('C1: Bài viết khớp toàn bộ số liệu công khai -> đối soát đạt', () => {
  const result = checkPost({
    baiViet: {
      tieu_de: 'Áo sơ mi nữ lụa mềm giảm 20%',
      noi_dung:
        'Giá niêm yết 199.000đ. Mua từ 2 sản phẩm (tổng 398.000đ) được giảm ngay 79.600đ, chỉ còn 318.400đ (trung bình 159.200đ/áo). Áp dụng từ 22/11/2026 đến 30/11/2026. Giá chưa gồm phí vận chuyển. Liên hệ 0912.345.678 - Số 10 Nguyễn Văn Linh.',
      hashtag: ['#aosomi', '#khuyenmai']
    },
    publicInput: samplePublic,
    congKhai: samplePricing.cong_khai,
    noiBo: samplePricing.noi_bo,
    giaVon: sampleData.gia_von
  });

  assert.equal(result.dat, true);
  assert.deepEqual(result.so_la, []);
  assert.deepEqual(result.lo_noi_bo, []);
  assert.equal(result.thieu_ghi_chu_gia, false);
});

test('C3: Bài AI giả có số lạ "giảm còn 150.000đ" -> cảnh báo số lạ', () => {
  const result = checkPost({
    baiViet: {
      tieu_de: 'Ưu đãi đặc biệt',
      noi_dung: 'Hôm nay giảm còn 150.000đ cho mỗi áo! Áp dụng 22/11 đến 30/11. Giá chưa gồm phí vận chuyển.',
      hashtag: []
    },
    publicInput: samplePublic,
    congKhai: samplePricing.cong_khai,
    noiBo: samplePricing.noi_bo,
    giaVon: sampleData.gia_von
  });

  assert.equal(result.dat, false);
  assert.ok(result.so_la.includes('150.000'));
});

test('C4: Bài AI giả lộ số nội bộ "giá vốn chỉ 120.000đ" -> cảnh báo mức cao', () => {
  const result = checkPost({
    baiViet: {
      tieu_de: 'Bán giá gốc',
      noi_dung: 'Bật mí giá vốn chỉ 120.000đ thôi ạ! Giá chưa gồm phí vận chuyển.',
      hashtag: []
    },
    publicInput: samplePublic,
    congKhai: samplePricing.cong_khai,
    noiBo: samplePricing.noi_bo,
    giaVon: sampleData.gia_von
  });

  assert.equal(result.dat, false);
  assert.ok(result.lo_noi_bo.includes('120.000'));
});

test('C5 (BR-16): Thiếu ghi chú giá thì đánh dấu thieu_ghi_chu_gia = true', () => {
  const result = checkPost({
    baiViet: {
      tieu_de: 'Áo sơ mi nữ',
      noi_dung: 'Giá 199.000đ, giảm 20% còn 318.400đ khi mua 2 chiếc.',
      hashtag: []
    },
    publicInput: samplePublic,
    congKhai: samplePricing.cong_khai,
    noiBo: samplePricing.noi_bo,
    giaVon: sampleData.gia_von
  });

  assert.equal(result.thieu_ghi_chu_gia, true);
});

test('C6: parseAiJsonResponse xử lý tốt JSON bọc markdown và từ chối JSON hỏng', () => {
  const ok = parseAiJsonResponse('```json\n{"tieu_de":"Tieu de","noi_dung":"Noi dung","hashtag":["#a"]}\n```');
  assert.equal(ok.tieu_de, 'Tieu de');
  assert.deepEqual(ok.hashtag, ['#a']);

  assert.throws(() => parseAiJsonResponse('Đây không phải JSON'));
});

test('C7: Số sẵn có trong tên/mô tả sản phẩm không bị báo nhầm thành số lạ', () => {
  const v = validatePostInput({
    ten_san_pham: 'Áo thun 100% cotton Set 3 món',
    mo_ta: 'Form rộng 500g thoáng mát',
    don_gia: 250000,
    so_luong: 1,
    khuyen_mai: { loai: 'khong' },
    ghi_chu_gia: '',
    lien_he: '0988777666',
    gia_von: null,
    nen_tang: 'zalo',
    phong_cach: 'than_thien',
    do_dai: 'ngan'
  });
  const pricing = calculatePricing(v.data);
  const pub = extractPublicData(v.data);

  const result = checkPost({
    baiViet: {
      tieu_de: 'Áo thun 100% cotton Set 3 món',
      noi_dung: 'Chất 100% cotton, set 3 món nặng 500g, giá chỉ 250.000đ. Nhắn Zalo 0988777666 nhé!',
      hashtag: []
    },
    publicInput: pub,
    congKhai: pricing.cong_khai,
    noiBo: pricing.noi_bo,
    giaVon: null
  });

  assert.equal(result.dat, true);
  assert.deepEqual(result.so_la, []);
});

test('Bộ lọc từ vi phạm & Đối soát trọn bộ 3 kênh (checkBannedWords & checkContentKit)', () => {
  const banned = checkBannedWords('Cam kết 100% rẻ nhất thị trường, bật mí giá vốn 20.000đ');
  assert.ok(banned.includes('cam kết 100%'));
  assert.ok(banned.includes('rẻ nhất'));
  assert.ok(banned.includes('giá vốn'));

  const kitAudit = checkContentKit({
    kit: {
      bai_facebook: 'Áo sơ mi nữ lụa mềm chỉ 318.400đ cho 2 áo (giảm 20% từ 199.000đ). Giá chưa gồm phí vận chuyển.',
      tin_nhan_zalo: 'Chào chị, 2 áo còn 318.400đ ạ.',
      mau_tu_van: [
        { tieu_de: 'Mẫu 1', noi_dung: 'Giá vốn chỉ 120.000đ thôi ạ!' }
      ]
    },
    publicInput: samplePublic,
    congKhai: samplePricing.cong_khai,
    noiBo: samplePricing.noi_bo,
    giaVon: sampleData.gia_von
  });

  assert.equal(kitAudit.dat, false);
  assert.ok(kitAudit.lo_noi_bo.includes('120.000'));
  assert.equal(kitAudit.thieu_ghi_chu_gia, false);
});
