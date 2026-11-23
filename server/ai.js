/**
 * ai.js -- Kết nối Gemini API để:
 *  1) Tạo bài đơn lẻ (/api/tao-bai) -- tuyệt đối không truyền giá vốn (BR-08).
 *  2) Tạo bộ nội dung 3 kênh (Facebook, Zalo, 3 Mẫu tư vấn) + Chiến lược 6 góc (/api/tao-bo-bai).
 *  3) Trò chuyện tư vấn kế toán / lợi nhuận / bán hàng (/api/chat).
 */

const { formatVndNumber, calculatePricing } = require('./calculator');

const STYLE_LABELS = {
  chuyen_nghiep: 'Chuyên nghiệp, rõ ràng, đáng tin cậy',
  than_thien: 'Thân thiện, gần gũi như chủ quán trò chuyện với khách',
  hai_huoc: 'Hài hước, duyên dáng, vui vẻ',
  tre_trung: 'Trẻ trung, năng động, bắt kịp xu hướng',
  thu_hut: 'Thu hút, nhấn mạnh lợi ích và tạo sự chú ý'
};

const LENGTH_GUIDES = {
  ngan: 'Ngắn (khoảng 40-70 từ)',
  vua: 'Vừa (khoảng 80-150 từ)',
  dai: 'Dài (khoảng 150-250 từ)'
};

function formatDateVn(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function describePromotion(khuyenMai, congKhai) {
  if (!khuyenMai || khuyenMai.loai === 'khong' || (khuyenMai.loai === 'phan_tram' && khuyenMai.gia_tri === 0)) {
    return 'Không có khuyến mãi (bán đúng giá niêm yết)';
  }
  if (khuyenMai.loai === 'phan_tram') {
    return `Giảm ${khuyenMai.gia_tri}%`;
  }
  if (khuyenMai.loai === 'tien_co_dinh') {
    return `Giảm ${formatVndNumber(khuyenMai.gia_tri)}đ`;
  }
  if (khuyenMai.loai === 'phan_tram_theo_so_luong') {
    const note = congKhai.duoc_ap_dung_km
      ? 'đã đạt điều kiện áp dụng cho ví dụ này'
      : `lưu ý: ví dụ này chưa đủ ${khuyenMai.so_luong_toi_thieu} sản phẩm nên tiền giảm = 0đ, bài viết cần nêu rõ điều kiện mua từ ${khuyenMai.so_luong_toi_thieu} sản phẩm mới được giảm`;
    return `Giảm ${khuyenMai.gia_tri}% khi mua từ ${khuyenMai.so_luong_toi_thieu} sản phẩm (${note})`;
  }
  return 'Không có khuyến mãi';
}

function buildPrompt(publicInput, congKhai) {
  const km = publicInput.khuyen_mai || { loai: 'khong' };
  const hasPromo = km.loai !== 'khong' && !(km.loai === 'phan_tram' && km.gia_tri === 0);
  const thoiGian =
    hasPromo && km.ngay_bat_dau && km.ngay_ket_thuc
      ? `${formatDateVn(km.ngay_bat_dau)} đến ${formatDateVn(km.ngay_ket_thuc)}`
      : 'Không có (bán giá niêm yết thường ngày)';

  const platformLabel = publicInput.nen_tang === 'zalo' ? 'Zalo' : 'Facebook';
  const styleLabel = STYLE_LABELS[publicInput.phong_cach] || publicInput.phong_cach;
  const lengthLabel = LENGTH_GUIDES[publicInput.do_dai] || publicInput.do_dai;

  return `Bạn là chuyên viên viết nội dung bán hàng tiếng Việt cho hộ kinh doanh nhỏ.

QUY TẮC BẮT BUỘC:
1. Chỉ được dùng các con số trong khối "SỐ LIỆU ĐÃ XÁC THỰC" bên dưới (và các thông số vốn có trong tên/mô tả sản phẩm).
2. Không tự thêm giá, tỷ lệ giảm, quà tặng, thời hạn, số lượng giới hạn.
3. Không dùng lời cam kết tuyệt đối không có căn cứ (ví dụ "rẻ nhất", "số 1", "cam kết 100%", "tốt nhất thị trường").
4. Nếu có "Ghi chú giá" (khác "Không có") thì phải giữ nguyên nội dung ghi chú đó trong bài.
5. Nếu có khuyến mãi thì phải nêu rõ điều kiện và thời gian áp dụng (nếu có ngày).
6. Thiếu thông tin thì bỏ qua, không tự bịa thêm.
7. Nền tảng: ${platformLabel}. Phong cách: ${styleLabel}. Độ dài: ${lengthLabel}.
8. Chỉ trả về JSON hợp lệ đúng cấu trúc:
{"tieu_de": "...", "noi_dung": "...", "hashtag": ["#...", "#..."]}

THÔNG TIN SẢN PHẨM:
Tên: ${publicInput.ten_san_pham}
Đặc điểm: ${publicInput.mo_ta || 'Không có'}
Ghi chú giá: ${publicInput.ghi_chu_gia || 'Không có'}
Liên hệ: ${publicInput.lien_he || 'Không có'}

SỐ LIỆU ĐÃ XÁC THỰC:
Đơn giá niêm yết: ${formatVndNumber(publicInput.don_gia)}đ | Số lượng ví dụ: ${publicInput.so_luong}
Khuyến mãi: ${describePromotion(km, congKhai)}
Thời gian áp dụng: ${thoiGian}
Tổng tiền hàng: ${formatVndNumber(congKhai.tong_tien_hang)}đ | Tiền giảm: ${formatVndNumber(congKhai.tien_giam)}đ
Thành tiền phải trả: ${formatVndNumber(congKhai.thanh_tien)}đ | Giá bình quân mỗi sản phẩm: ${formatVndNumber(congKhai.gia_binh_quan)}đ`;
}

function parseJsonSafe(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('EMPTY_AI_RESPONSE');
  }
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  return JSON.parse(cleaned);
}

function parseAiJsonResponse(rawText) {
  const parsed = parseJsonSafe(rawText);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof parsed.tieu_de !== 'string' ||
    typeof parsed.noi_dung !== 'string'
  ) {
    throw new Error('INVALID_AI_JSON_SHAPE');
  }

  const hashtags = Array.isArray(parsed.hashtag)
    ? parsed.hashtag.filter((item) => typeof item === 'string' && item.trim() !== '').map((s) => s.trim())
    : [];

  return {
    tieu_de: parsed.tieu_de.trim(),
    noi_dung: parsed.noi_dung.trim(),
    hashtag: hashtags
  };
}

class AiServiceError extends Error {
  constructor(statusCode, userMessage) {
    super(userMessage);
    this.statusCode = statusCode;
    this.userMessage = userMessage;
  }
}

async function callGemini({ prompt, responseMimeType = 'application/json', temperature = 0.7 }) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();

  if (!apiKey) {
    throw new AiServiceError(
      502,
      'Hệ thống AI chưa có API Key. Vui lòng kiểm tra cấu hình GEMINI_API_KEY trong file .env.'
    );
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const generationConfig = { temperature };
  if (responseMimeType) {
    generationConfig.responseMimeType = responseMimeType;
  }
  if (model.includes('2.5-flash')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      }),
      signal: AbortSignal.timeout(45000)
    });
  } catch (err) {
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new AiServiceError(504, 'Kết nối tới hệ thống AI quá thời gian chờ, vui lòng thử lại.');
    }
    throw new AiServiceError(502, 'Không kết nối được tới hệ thống AI, vui lòng kiểm tra mạng và thử lại.');
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new AiServiceError(502, 'Hệ thống AI đang quá tải hoặc tạm hết hạn mức miễn phí, vui lòng thử lại sau.');
    }
    throw new AiServiceError(502, 'Hệ thống AI đang bận hoặc cấu hình chưa hợp lệ, vui lòng thử lại.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AiServiceError(502, 'Hệ thống AI trả về dữ liệu chưa hợp lệ, vui lòng thử lại.');
  }

  return payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
}

async function generatePost({ publicInput, congKhai }) {
  const prompt = buildPrompt(publicInput, congKhai);
  const rawText = await callGemini({ prompt, responseMimeType: 'application/json', temperature: 0.7 });
  try {
    return parseAiJsonResponse(rawText);
  } catch {
    throw new AiServiceError(502, 'Hệ thống AI trả về định dạng chưa chuẩn, vui lòng bấm Tạo lại.');
  }
}

/**
 * Tạo nội dung dự phòng theo quy tắc (khi chưa có API Key hoặc AI bận) để không bị treo luồng.
 */
function buildOfflineKitFallback({ publicInput, congKhai, storeProfile, customInstruction }) {
  const storeName = storeProfile?.ten_cua_hang || 'Cửa hàng của bạn';
  const targetCustomer = storeProfile?.khach_hang_muc_tieu || 'Khách hàng khu vực lân cận';
  const storeHighlights = storeProfile?.diem_noi_bat || 'Chất lượng đảm bảo, giá niêm yết rõ ràng';
  const km = publicInput.khuyen_mai || { loai: 'khong' };
  const hasPromo = km.loai !== 'khong' && !(km.loai === 'phan_tram' && km.gia_tri === 0);
  const timeText =
    km.ngay_bat_dau && km.ngay_ket_thuc
      ? `${formatDateVn(km.ngay_bat_dau)} - ${formatDateVn(km.ngay_ket_thuc)}`
      : 'Áp dụng theo thông báo của cửa hàng';

  const priceLine = hasPromo
    ? `• Giá niêm yết: ${formatVndNumber(publicInput.don_gia)}đ\n• Ưu đãi hiện tại: ${describePromotion(km, congKhai)} -> Giá sau giảm chỉ còn: ${formatVndNumber(congKhai.thanh_tien)}đ${publicInput.so_luong > 1 ? ` (cho ${publicInput.so_luong} sản phẩm, bình quân ${formatVndNumber(congKhai.gia_binh_quan)}đ/sp)` : ''}`
    : `• Giá bán niêm yết: ${formatVndNumber(congKhai.thanh_tien)}đ`;

  const noteLine = publicInput.ghi_chu_gia ? `\n• Lưu ý giá: ${publicInput.ghi_chu_gia}` : '';
  const contactLine = publicInput.lien_he ? `• Liên hệ đặt hàng: ${publicInput.lien_he}` : '• Nhắn tin trực tiếp cho shop để được tư vấn nhanh!';

  const fbPost = `[${storeName.toUpperCase()}] ${publicInput.ten_san_pham}${hasPromo ? ' - ƯU ĐÃI MINH BẠCH' : ''}
${customInstruction ? `\n(Yêu cầu thêm: ${customInstruction})\n` : ''}
Bạn đang tìm ${publicInput.ten_san_pham} vừa rõ chất lượng, vừa minh bạch giá bán? ${storeName} xin gửi thông tin chi tiết để bạn dễ dàng lựa chọn:

✨ CHI TIẾT SẢN PHẨM / DỊCH VỤ:
• Tên sản phẩm: ${publicInput.ten_san_pham}
${publicInput.mo_ta ? `• Đặc điểm thực tế: ${publicInput.mo_ta}\n` : ''}• Điểm nổi bật tại cửa hàng: ${storeHighlights}

🏷️ THÔNG TIN GIÁ & CHƯƠNG TRÌNH ƯU ĐÃI:
${priceLine}${hasPromo ? `\n• Thời gian áp dụng: ${timeText}` : ''}${noteLine}

📌 HƯỚNG DẪN ĐẶT HÀNG / LIÊN HỆ:
${contactLine}

#SmartPostAI #BanHangMinhBach #HoKinhDoanh`;

  const zaloMsg = `Chào anh/chị, ${storeName} gửi anh/chị thông tin mới về "${publicInput.ten_san_pham}" ạ:
- ${publicInput.mo_ta || storeHighlights}
- ${hasPromo ? `Giá gốc ${formatVndNumber(publicInput.don_gia)}đ, đang áp dụng ${describePromotion(km, congKhai)} còn ${formatVndNumber(congKhai.thanh_tien)}đ (${timeText}).` : `Giá bán niêm yết: ${formatVndNumber(congKhai.thanh_tien)}đ.`}
${publicInput.ghi_chu_gia ? `- ${publicInput.ghi_chu_gia}\n` : ''}Anh/chị cần đặt hoặc hỏi thêm cứ nhắn lại em ngay tại đây nhé!`;

  const mauTuVan = [
    {
      tieu_de: 'Mẫu 1: Trả lời khách hỏi giá & khuyến mãi',
      noi_dung: `Dạ chào anh/chị! "${publicInput.ten_san_pham}" bên em có giá niêm yết ${formatVndNumber(publicInput.don_gia)}đ. ${hasPromo ? `Hiện đang có ưu đãi ${describePromotion(km, congKhai)}, thành tiền còn ${formatVndNumber(congKhai.thanh_tien)}đ (áp dụng ${timeText}).` : ''} ${publicInput.ghi_chu_gia ? publicInput.ghi_chu_gia + '.' : ''} Anh/chị muốn lấy số lượng mấy phần để em lên đơn ạ?`
    },
    {
      tieu_de: 'Mẫu 2: Trả lời khách hỏi giao hàng / thời gian',
      noi_dung: `Dạ bên em nhận đơn và xác nhận thời gian giao/phục vụ ngay khi chốt ạ. ${publicInput.ghi_chu_gia || 'Chi phí giao hàng sẽ báo rõ trước khi xác nhận đơn.'} ${publicInput.lien_he ? 'Hoặc anh/chị liên hệ: ' + publicInput.lien_he : ''}`
    },
    {
      tieu_de: 'Mẫu 3: Kịch bản chốt đơn lịch sự',
      noi_dung: `Dạ em xác nhận đơn "${publicInput.ten_san_pham}" (SL: ${publicInput.so_luong}), tổng thanh toán ${formatVndNumber(congKhai.thanh_tien)}đ${hasPromo ? ` (đã giảm ${formatVndNumber(congKhai.tien_giam)}đ)` : ''}. Anh/chị cho em xin địa chỉ nhận và khung giờ thuận tiện nhé!`
    }
  ];

  return {
    bai_facebook: fbPost,
    tin_nhan_zalo: zaloMsg,
    mau_tu_van: mauTuVan
  };
}

/**
 * Tạo bộ nội dung 3 kênh (Facebook + Zalo + 3 mẫu trả lời khách) bằng Gemini.
 * Tuyệt đối KHÔNG truyền giá vốn, chi phí hay lợi nhuận vào prompt tạo nội dung công khai (BR-08).
 */
async function generateContentKit({ publicInput, congKhai, storeProfile, customInstruction = '' }) {
  const km = publicInput.khuyen_mai || { loai: 'khong' };
  const hasPromo = km.loai !== 'khong' && !(km.loai === 'phan_tram' && km.gia_tri === 0);
  const thoiGian =
    hasPromo && km.ngay_bat_dau && km.ngay_ket_thuc
      ? `${formatDateVn(km.ngay_bat_dau)} đến ${formatDateVn(km.ngay_ket_thuc)}`
      : 'Áp dụng theo thông báo của cửa hàng';

  const prompt = `Bạn là Trợ lý viết nội dung bán hàng tiếng Việt cho hộ kinh doanh nhỏ.

QUY TẮC BẮT BUỘC (BR-11, BR-16):
1. CHỈ dùng các con số có trong khối "SỐ LIỆU CÔNG KHAI ĐÃ XÁC THỰC" và thông số vốn có trong mô tả sản phẩm. KHÔNG tự bịa giá khác, không tự thêm quà tặng hay thời hạn không có thật.
2. KHÔNG dùng từ ngữ phóng đại như: "rẻ nhất", "số 1", "cam kết 100%", "tốt nhất thị trường", "trị dứt điểm".
3. Nếu có "Ghi chú giá" (khác "Không có") thì BẮT BUỘC giữ nguyên nội dung ghi chú đó trong bài Facebook.
4. Viết tiếng Việt tự nhiên, gần gũi, dễ hiểu (Facebook rõ ràng có hashtag; Zalo ngắn gọn thân tình; 3 mẫu trả lời khách lịch sự).
5. Chỉ trả về JSON hợp lệ đúng cấu trúc sau:
{
  "bai_facebook": "Nội dung bài đăng Facebook hoàn chỉnh kèm hashtag",
  "tin_nhan_zalo": "Tin nhắn Zalo gửi khách quen ngắn gọn",
  "mau_tu_van": [
    {"tieu_de": "Mẫu 1: Trả lời khách hỏi giá & ưu đãi", "noi_dung": "..."},
    {"tieu_de": "Mẫu 2: Trả lời khách hỏi giao hàng / thời gian", "noi_dung": "..."},
    {"tieu_de": "Mẫu 3: Mẫu chốt đơn lịch sự", "noi_dung": "..."}
  ]
}

THÔNG TIN CỬA HÀNG & SẢN PHẨM:
Tên cửa hàng: ${storeProfile?.ten_cua_hang || 'Cửa hàng hộ kinh doanh'}
Khách hàng mục tiêu: ${storeProfile?.khach_hang_muc_tieu || 'Khách mua lẻ'}
Điểm nổi bật cửa hàng: ${storeProfile?.diem_noi_bat || 'Bán hàng tận tâm, rõ ràng'}
Tên sản phẩm: ${publicInput.ten_san_pham}
Mô tả sản phẩm: ${publicInput.mo_ta || 'Không có'}
Ghi chú giá: ${publicInput.ghi_chu_gia || 'Không có'}
Liên hệ: ${publicInput.lien_he || 'Không có'}
Yêu cầu riêng của người bán: ${customInstruction || 'Viết bộ bài rõ ràng, dễ hiểu, đúng giá'}

SỐ LIỆU CÔNG KHAI ĐÃ XÁC THỰC:
Đơn giá niêm yết: ${formatVndNumber(publicInput.don_gia)}đ | Số lượng ví dụ: ${publicInput.so_luong}
Khuyến mãi: ${describePromotion(km, congKhai)} | Thời gian: ${thoiGian}
Tổng tiền hàng: ${formatVndNumber(congKhai.tong_tien_hang)}đ | Tiền giảm: ${formatVndNumber(congKhai.tien_giam)}đ
Thành tiền phải trả: ${formatVndNumber(congKhai.thanh_tien)}đ | Giá bình quân: ${formatVndNumber(congKhai.gia_binh_quan)}đ`;

  const hasKey = Boolean((process.env.GEMINI_API_KEY || '').trim());
  if (!hasKey) {
    const fallback = buildOfflineKitFallback({ publicInput, congKhai, storeProfile, customInstruction });
    return {
      mode: 'offline_demo',
      ...fallback
    };
  }

  try {
    const rawText = await callGemini({ prompt, responseMimeType: 'application/json', temperature: 0.7 });
    const parsed = parseJsonSafe(rawText);
    if (!parsed.bai_facebook || !parsed.tin_nhan_zalo || !Array.isArray(parsed.mau_tu_van)) {
      throw new Error('INVALID_KIT_SHAPE');
    }
    return {
      mode: 'gemini',
      bai_facebook: String(parsed.bai_facebook).trim(),
      tin_nhan_zalo: String(parsed.tin_nhan_zalo).trim(),
      mau_tu_van: parsed.mau_tu_van.slice(0, 3).map((m, idx) => ({
        tieu_de: String(m?.tieu_de || `Mẫu ${idx + 1}`),
        noi_dung: String(m?.noi_dung || '')
      }))
    };
  } catch {
    const fallback = buildOfflineKitFallback({ publicInput, congKhai, storeProfile, customInstruction });
    return {
      mode: 'offline_fallback',
      ...fallback
    };
  }
}

/**
 * Tạo bảng mô phỏng các mức giảm 0%, 10%, 15%, 20%, 25%, 30% bằng calculator.js
 * để Trợ lý chat tư vấn chính xác tuyệt đối cho chủ shop.
 */
function buildSensitivitySummary(validData) {
  const levels = [0, 10, 15, 20, 25, 30];
  return levels
    .map((pct) => {
      const sim = calculatePricing({
        ...validData,
        khuyen_mai: { loai: 'phan_tram', gia_tri: pct }
      });
      if (sim.noi_bo.co_gia_von) {
        return `- Giảm ${pct}%: Giá bán ${formatVndNumber(sim.cong_khai.thanh_tien)}đ | Lãi sau chi phí: ${formatVndNumber(sim.noi_bo.loi_nhuan_sau_chi_phi)}đ (Biên: ${sim.noi_bo.bien_loi_nhuan_phan_tram}%)`;
      }
      return `- Giảm ${pct}%: Giá bán ${formatVndNumber(sim.cong_khai.thanh_tien)}đ`;
    })
    .join('\n');
}

function buildOfflineChatReply({ userMessage, validData, pricing, storeProfile }) {
  const msg = (userMessage || '').toLowerCase();
  const { cong_khai, noi_bo } = pricing;
  const sensitivity = buildSensitivitySummary(validData);

  if (msg.includes('lãi') || msg.includes('lỗ') || msg.includes('hòa vốn') || msg.includes('giảm') || msg.includes('%')) {
    if (!noi_bo.co_gia_von) {
      return `Hiện tại sản phẩm "${validData.ten_san_pham}" có giá sau giảm là ${formatVndNumber(cong_khai.thanh_tien)}đ, nhưng bạn chưa nhập Giá vốn nên hệ thống chưa tính được lãi/lỗ.\n\nBảng mô phỏng giá bán:\n${sensitivity}`;
    }
    const statusText = noi_bo.canh_bao_lo
      ? `ĐANG BÁN LỖ ${formatVndNumber(noi_bo.lo_moi_san_pham)}đ/sp`
      : `CÓ LÃI ${formatVndNumber(noi_bo.loi_nhuan_sau_chi_phi)}đ/đơn (Biên lợi nhuận ${noi_bo.bien_loi_nhuan_phan_tram}%)`;
    return `Phân tích cho "${validData.ten_san_pham}" (Giá gốc ${formatVndNumber(validData.don_gia)}đ, Giá vốn ${formatVndNumber(validData.gia_von)}đ, Chi phí phát sinh ${formatVndNumber(noi_bo.chi_phi_phat_sinh)}đ):\n• Tình trạng hiện tại: ${statusText}.\n• Mức giảm tối đa để hòa vốn: ${noi_bo.giam_toi_da_hoa_von_phan_tram}% (tương đương giảm tối đa ${formatVndNumber(noi_bo.giam_toi_da_hoa_von_tien)}đ/đơn).\n\nMô phỏng nhanh các mức giảm khác:\n${sensitivity}`;
  }

  return `Mình đã nắm số liệu của "${validData.ten_san_pham}" tại ${storeProfile?.ten_cua_hang || 'cửa hàng'}:\n• Giá sau giảm: ${formatVndNumber(cong_khai.thanh_tien)}đ\n${noi_bo.co_gia_von ? `• Lợi nhuận sau chi phí khai báo: ${formatVndNumber(noi_bo.loi_nhuan_sau_chi_phi)}đ/đơn (Biên ${noi_bo.bien_loi_nhuan_phan_tram}%, hòa vốn tối đa ${noi_bo.giam_toi_da_hoa_von_phan_tram}%).\n` : ''}Bạn có thể hỏi cụ thể như: "Giảm 15% có ổn không?" hoặc bấm "Soạn / Sửa Bộ Bài Đăng" để cập nhật ngay 3 mẫu bài bên phải nhé!`;
}

/**
 * Chat tương tác với Trợ lý Kinh doanh & Kế toán AI (nội bộ cho chủ shop).
 */
async function chatWithAssistant({ messages, storeProfile, validData, pricing }) {
  const latestUserMsg = [...(messages || [])].reverse().find((m) => m.role === 'user')?.content || '';
  const hasKey = Boolean((process.env.GEMINI_API_KEY || '').trim());

  if (!hasKey) {
    return {
      mode: 'offline_demo',
      reply: buildOfflineChatReply({ userMessage: latestUserMsg, validData, pricing, storeProfile })
    };
  }

  const sensitivity = buildSensitivitySummary(validData);
  const { cong_khai, noi_bo } = pricing;
  const historyText = (messages || [])
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Chủ cửa hàng' : 'Trợ lý'}: ${m.content}`)
    .join('\n');

  const prompt = `Bạn là Trợ lý Kinh doanh & Kế toán hộ kinh doanh trong ứng dụng SmartPost AI.
Hãy trả lời ngắn gọn, dễ hiểu bằng tiếng Việt (tối đa khoảng 150 từ), sử dụng ĐÚNG các con số đã tính bên dưới (không tự bịa số).
Nhắc nhở: Đây là cuộc trò chuyện TƯ VẤN NỘI BỘ với chủ shop (được phép phân tích giá vốn, chi phí, lãi/lỗ để chủ shop ra quyết định; đồng thời nhắc rằng giá vốn không được đưa vào bài quảng cáo công khai).

DỮ LIỆU ĐANG XEM:
- Cửa hàng: ${storeProfile?.ten_cua_hang || 'Chưa đặt tên'} | Khách mục tiêu: ${storeProfile?.khach_hang_muc_tieu || 'Chưa rõ'}
- Sản phẩm: ${validData.ten_san_pham} (SL: ${validData.so_luong})
- Giá gốc: ${formatVndNumber(validData.don_gia)}đ | Tiền giảm: ${formatVndNumber(cong_khai.tien_giam)}đ | Giá sau giảm: ${formatVndNumber(cong_khai.thanh_tien)}đ
${noi_bo.co_gia_von ? `- Giá vốn: ${formatVndNumber(validData.gia_von)}đ | Chi phí phát sinh C (đóng gói/ship/khác): ${formatVndNumber(noi_bo.chi_phi_phat_sinh)}đ | Tổng chi phí: ${formatVndNumber(noi_bo.tong_chi_phi_khai_bao)}đ
- Lãi gộp (chưa trừ C): ${formatVndNumber(noi_bo.lai_gop)}đ
- Lợi nhuận sau chi phí khai báo: ${formatVndNumber(noi_bo.loi_nhuan_sau_chi_phi)}đ (Biên lợi nhuận: ${noi_bo.bien_loi_nhuan_phan_tram}%)
- Giảm tối đa để hòa vốn: ${noi_bo.giam_toi_da_hoa_von_phan_tram}% (tối đa ${formatVndNumber(noi_bo.giam_toi_da_hoa_von_tien)}đ)` : '- Chưa nhập giá vốn.'}

BẢNG MÔ PHỎNG CÁC MỨC GIẢM (ĐÃ TÍNH BẰNG CÔNG THỨC):
${sensitivity}

LỊCH SỬ HỘI THOẠI:
${historyText}

Hãy trả lời câu hỏi mới nhất của chủ cửa hàng một cách thiết thực và chính xác.`;

  try {
    const reply = await callGemini({ prompt, responseMimeType: null, temperature: 0.6 });
    return {
      mode: 'gemini',
      reply: reply.trim() || buildOfflineChatReply({ userMessage: latestUserMsg, validData, pricing, storeProfile })
    };
  } catch {
    return {
      mode: 'offline_fallback',
      reply: buildOfflineChatReply({ userMessage: latestUserMsg, validData, pricing, storeProfile })
    };
  }
}

module.exports = {
  buildPrompt,
  parseAiJsonResponse,
  generatePost,
  generateContentKit,
  chatWithAssistant,
  AiServiceError
};
