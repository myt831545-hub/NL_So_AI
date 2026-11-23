# SmartPost AI

Website AI tạo bài đăng Facebook và Zalo cho hộ kinh doanh, có tính giá khuyến mãi, phân tích lãi gộp nội bộ và đối soát số liệu minh bạch.

## Cấu trúc thư mục

- `public/`: Giao diện người dùng (`index.html`, `style.css`, `script.js`)
- `server/`: Máy chủ Backend (`server.js`, `calculator.js`, `ai.js`, `checker.js`)
- `test/`: Kiểm thử tự động (`calculator.test.js`, `checker.test.js`)
- `.env`: Lưu biến môi trường và API Key bí mật (không đưa lên GitHub)
- `.env.example`: File mẫu cấu hình biến môi trường

## Cách chạy trên máy cá nhân

1. Cài đặt thư viện (chỉ cần chạy lần đầu):
   ```bash
   npm install
   ```
2. Mở file `.env` và điền khóa miễn phí lấy từ Google AI Studio (`https://aistudio.google.com/`):
   ```text
   PORT=3000
   GEMINI_API_KEY=dan_khoa_cua_ban_vao_day
   GEMINI_MODEL=gemini-2.5-flash
   ```
3. Khởi chạy website:
   ```bash
   npm start
   ```
   Sau đó mở trình duyệt vào địa chỉ: `http://localhost:3000`
4. Chạy kiểm thử tự động công thức tính giá và bộ đối soát:
   ```bash
   npm test
   ```

## Tài liệu kế hoạch

Xem chi tiết quy tắc nghiệp vụ (BR-01 đến BR-16), công thức và lộ trình trong `Ke_hoach_du_an_SmartPost_AI_hoan_thien.md`.
