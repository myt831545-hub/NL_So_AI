/**
 * server.js -- Máy chủ Express của SmartPost AI.
 * Phục vụ giao diện trong public/ và cung cấp API tính giá, tạo bộ bài đăng, chat tư vấn & đối soát.
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  validateCalcInput,
  validatePostInput,
  calculatePricing,
  extractPublicData
} = require('./calculator');
const {
  generatePost,
  generateContentKit,
  chatWithAssistant,
  AiServiceError
} = require('./ai');
const { checkPost, checkContentKit, checkBannedWords } = require('./checker');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      hop_le: false,
      loi: [{ truong: 'chung', thong_bao: 'Dữ liệu JSON gửi lên không hợp lệ.' }]
    });
  }
  return next(err);
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// Giới hạn tần suất gọi API AI (25 lần/phút mỗi IP -- đủ thoải mái khi demo 6 ngành và tránh spam)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      hop_le: false,
      thong_bao: 'Bạn thao tác hơi nhanh, hãy thử lại sau ít phút.'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    has_gemini_key: Boolean((process.env.GEMINI_API_KEY || '').trim()),
    model: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim()
  });
});

/**
 * API tính giá và phân tích lợi nhuận kế toán chi tiết (không gọi AI).
 */
app.post('/api/tinh-gia', (req, res) => {
  const validation = validateCalcInput(req.body, { requireDatesForPromo: false });
  if (!validation.hop_le) {
    return res.status(400).json({
      hop_le: false,
      loi: validation.loi
    });
  }

  const { cong_khai, noi_bo } = calculatePricing(validation.data);
  return res.json({
    hop_le: true,
    cong_khai,
    noi_bo
  });
});

/**
 * API tạo 1 bài viết (tương thích bản đơn giản).
 */
app.post('/api/tao-bai', aiLimiter, async (req, res) => {
  const validation = validatePostInput(req.body, { requireDatesForPromo: true });
  if (!validation.hop_le) {
    return res.status(400).json({
      hop_le: false,
      loi: validation.loi
    });
  }

  const validData = validation.data;
  const { cong_khai, noi_bo } = calculatePricing(validData);
  const publicInput = extractPublicData(validData);

  try {
    const bai_viet = await generatePost({ publicInput, congKhai: cong_khai });
    const doi_soat = checkPost({
      baiViet: bai_viet,
      publicInput,
      congKhai: cong_khai,
      noiBo: noi_bo,
      giaVon: validData.gia_von
    });

    return res.json({
      hop_le: true,
      bai_viet,
      cong_khai,
      noi_bo,
      doi_soat
    });
  } catch (err) {
    if (err instanceof AiServiceError) {
      return res.status(err.statusCode).json({
        hop_le: false,
        thong_bao: err.userMessage
      });
    }
    return res.status(502).json({
      hop_le: false,
      thong_bao: 'Hệ thống AI đang bận, vui lòng thử lại.'
    });
  }
});

/**
 * API tạo trọn bộ 3 kênh (Facebook, Zalo, 3 Mẫu tư vấn) + Chiến lược 6 góc + Đối soát.
 */
app.post('/api/tao-bo-bai', aiLimiter, async (req, res) => {
  const validation = validatePostInput(req.body, { requireDatesForPromo: false });
  if (!validation.hop_le) {
    return res.status(400).json({
      hop_le: false,
      loi: validation.loi
    });
  }

  const validData = validation.data;
  const { cong_khai, noi_bo } = calculatePricing(validData);
  const publicInput = extractPublicData(validData);
  const storeProfile = req.body.store_profile && typeof req.body.store_profile === 'object' ? req.body.store_profile : {};
  const customInstruction = typeof req.body.yeu_cau_them === 'string' ? req.body.yeu_cau_them.trim().slice(0, 400) : '';

  const kit = await generateContentKit({
    publicInput,
    congKhai: cong_khai,
    noiBo: noi_bo,
    storeProfile,
    customInstruction,
    nguongBienThap: validData.nguong_bien_ln_thap
  });

  const extraValidText = [
    storeProfile.ten_cua_hang || '',
    storeProfile.diem_noi_bat || '',
    storeProfile.khach_hang_muc_tieu || '',
    customInstruction
  ].join(' ');

  const doi_soat = checkContentKit({
    kit,
    publicInput,
    congKhai: cong_khai,
    noiBo: noi_bo,
    giaVon: validData.gia_von,
    extraValidText
  });

  return res.json({
    hop_le: true,
    mode: kit.mode,
    bo_bai: {
      bai_facebook: kit.bai_facebook,
      tin_nhan_zalo: kit.tin_nhan_zalo,
      mau_tu_van: kit.mau_tu_van
    },
    cong_khai,
    noi_bo,
    doi_soat
  });
});

/**
 * API trò chuyện hỏi đáp tư vấn lợi nhuận & bán hàng với Trợ lý AI.
 */
app.post('/api/chat', aiLimiter, async (req, res) => {
  const validation = validatePostInput(req.body, { requireDatesForPromo: false });
  if (!validation.hop_le) {
    return res.status(400).json({
      hop_le: false,
      loi: validation.loi
    });
  }

  const validData = validation.data;
  const pricing = calculatePricing(validData);
  const storeProfile = req.body.store_profile && typeof req.body.store_profile === 'object' ? req.body.store_profile : {};
  const messages = Array.isArray(req.body.messages) ? req.body.messages : [];

  const chatRes = await chatWithAssistant({
    messages,
    storeProfile,
    validData,
    pricing
  });

  return res.json({
    hop_le: true,
    mode: chatRes.mode,
    reply: chatRes.reply,
    cong_khai: pricing.cong_khai,
    noi_bo: pricing.noi_bo
  });
});

/**
 * API kiểm tra nhanh từ vi phạm & lộ số nội bộ cho văn bản người dùng nhập.
 */
app.post('/api/kiem-tra-vi-pham', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const tu_vi_pham = checkBannedWords(text);
  return res.json({
    hop_le: true,
    tu_vi_pham
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SmartPost AI dang chay tai http://localhost:${PORT}`);
  });
}

module.exports = app;
