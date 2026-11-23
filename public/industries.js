/**
 * industries.js -- Bộ dữ liệu mẫu đầy đủ cho 6 ngành kinh doanh hộ gia đình.
 * Người dùng có thể chỉnh sửa, thêm mới hoặc xóa từng mặt hàng ở bất kỳ ngành nào.
 */

window.SMARTPOST_INDUSTRIES = [
  {
    id: 'an_uong',
    icon: '🍜',
    name: 'Ăn uống / Đồ uống',
    shortDesc: 'Bún đậu & Trà tắc',
    scenarioTitle: 'Quán Bún Đậu & Trà Tắc Mẹt Tre -- Ưu đãi giờ trưa (Bộ số chuẩn 28k / 55k / 15% / 5k)',
    store: {
      ten_cua_hang: 'Quán Bún Đậu & Trà Tắc Mẹt Tre',
      khach_hang_muc_tieu: 'Nhân viên văn phòng, sinh viên và cư dân bán kính 3km cần bữa trưa đủ món, sạch sẽ, rõ giá',
      diem_noi_bat: 'Đậu mơ rán nóng khi khách đặt, chả cốm và thịt chân giò chuẩn bị mới mỗi sáng, đóng hộp giấy phân ngăn sạch sẽ',
      lien_he: '0912.345.678 - Số 18 Ngõ 12 Thái Hà (Nhận đặt qua Zalo/Hotline)',
      ghi_chu_gia: 'Giá chưa gồm phí ship ngoài bán kính 2km'
    },
    products: [
      {
        id: 'au_1',
        ten_san_pham: 'Combo Mẹt Bún Đậu Đặc Biệt + 1 Trà Tắc Lớn',
        mo_ta: 'Mẹt đầy đủ bún lá, đậu rán giòn, thịt chân giò luộc, chả cốm, nem rán kèm 1 ly trà tắc mật ong size lớn',
        gia_von: 28000,
        don_gia: 55000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 15,
        sl_toi_thieu: 2,
        dong_goi: 3000,
        ho_tro_ship: 2000,
        chi_phi_khac: 0
      },
      {
        id: 'au_2',
        ten_san_pham: 'Mẹt Bún Đậu Truyền Thống (Bún + Đậu + Thịt + Chả Cốm)',
        mo_ta: 'Suất tiêu chuẩn gồm bún lá, đậu rán nóng, thịt chân giò và chả cốm kèm rau thơm, mắm tôm pha sẵn',
        gia_von: 20000,
        don_gia: 40000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 10,
        sl_toi_thieu: 2,
        dong_goi: 2500,
        ho_tro_ship: 0,
        chi_phi_khac: 0
      },
      {
        id: 'au_3',
        ten_san_pham: 'Combo 2 Mẹt Đặc Biệt + 2 Trà Tắc + Thêm Chả Cốm',
        mo_ta: 'Combo 2 người ăn no căng, tặng thêm phần chả cốm nóng giòn và 2 ly trà tắc mát lạnh',
        gia_von: 56000,
        don_gia: 110000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 12,
        sl_toi_thieu: 2,
        dong_goi: 5000,
        ho_tro_ship: 3000,
        chi_phi_khac: 0
      }
    ]
  },
  {
    id: 'thuc_pham',
    icon: '🥬',
    name: 'Thực phẩm sạch',
    shortDesc: 'Trái cây & Rau củ',
    scenarioTitle: 'Nông Sản Sạch Vườn Nhà -- Giao tươi mỗi sáng theo mùa',
    store: {
      ten_cua_hang: 'Nông Sản Sạch Vườn Nhà',
      khach_hang_muc_tieu: 'Các gia đình trẻ, nội trợ quan tâm thực phẩm tươi sạch, nguồn gốc rõ ràng và giá cân ký minh bạch',
      diem_noi_bat: 'Cắt hái trong ngày tại vườn, không chất bảo quản, bao ăn từng quả, cân đúng đủ trọng lượng',
      lien_he: '0987.654.321 - Chợ Xanh Ngõ 45 Cầu Giấy',
      ghi_chu_gia: 'Hỗ trợ kiểm tra hàng trước khi thanh toán'
    },
    products: [
      {
        id: 'tp_1',
        ten_san_pham: 'Set 2kg Bơ Sáp Đắk Lắk Loại 1',
        mo_ta: 'Bơ sáp già quả, cơm vàng dẻo béo, size 3-4 quả/kg, hái tại vườn Đắk Lắk',
        gia_von: 58000,
        don_gia: 95000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 10,
        sl_toi_thieu: 2,
        dong_goi: 4000,
        ho_tro_ship: 4000,
        chi_phi_khac: 0
      },
      {
        id: 'tp_2',
        ten_san_pham: 'Thùng 5kg Cam Sành Hàm Yên Tươi Mới',
        mo_ta: 'Cam mọng nước, ngọt thanh tự nhiên, thích hợp vắt nước hoặc ăn trực tiếp cho cả gia đình',
        gia_von: 75000,
        don_gia: 125000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 12,
        sl_toi_thieu: 2,
        dong_goi: 7000,
        ho_tro_ship: 5000,
        chi_phi_khac: 0
      },
      {
        id: 'tp_3',
        ten_san_pham: 'Combo Rau Củ Hữu Cơ 5 Món Theo Mùa (2,5kg)',
        mo_ta: 'Gồm rau cải ngọt, cà chua bi, bí xanh, dưa chuột và rau gia vị thu hoạch sáng sớm',
        gia_von: 48000,
        don_gia: 85000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 15,
        sl_toi_thieu: 2,
        dong_goi: 4000,
        ho_tro_ship: 2000,
        chi_phi_khac: 0
      }
    ]
  },
  {
    id: 'thoi_trang',
    icon: '👗',
    name: 'Thời trang / Phụ kiện',
    shortDesc: 'Đồ công sở & Váy',
    scenarioTitle: 'Tiệm Thời Trang Công Sở Nàng Thơ -- Bộ số chuẩn Áo sơ mi 199k',
    store: {
      ten_cua_hang: 'Tiệm Thời Trang Công Sở Nàng Thơ',
      khach_hang_muc_tieu: 'Nữ nhân viên văn phòng, sinh viên chuẩn bị thực tập cần trang phục thanh lịch, dễ mặc, giá vừa túi tiền',
      diem_noi_bat: 'Đường may kỹ, chất vải mát ít nhăn, được kiểm tra hàng và hỗ trợ đổi size trong 7 ngày',
      lien_he: '0912.345.678 - Số 10 Nguyễn Văn Linh',
      ghi_chu_gia: 'Giá chưa gồm phí vận chuyển'
    },
    products: [
      {
        id: 'tt_1',
        ten_san_pham: 'Áo Sơ Mi Nữ Lụa Mềm Form Công Sở',
        mo_ta: 'Chất lụa thoáng mát, ít nhăn, đủ size S-M-L, dễ phối cùng quần tây hoặc chân váy',
        gia_von: 120000,
        don_gia: 199000,
        so_luong: 2,
        loai_km: 'phan_tram_theo_so_luong',
        gia_tri_km: 20,
        sl_toi_thieu: 2,
        dong_goi: 5000,
        ho_tro_ship: 0,
        chi_phi_khac: 0
      },
      {
        id: 'tt_2',
        ten_san_pham: 'Chân Váy Chữ A Cạp Cao Dáng Dài',
        mo_ta: 'Vải tuyết mưa đứng dáng, có lớp lót quần trong kín đáo, tôn dáng cho nàng công sở',
        gia_von: 135000,
        don_gia: 249000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 15,
        sl_toi_thieu: 2,
        dong_goi: 5000,
        ho_tro_ship: 10000,
        chi_phi_khac: 0
      },
      {
        id: 'tt_3',
        ten_san_pham: 'Set Bộ Công Sở Áo Kiểu + Quần Tây Ống Suông',
        mo_ta: 'Set 2 món đồng bộ lịch sự, mặc đi làm hay đi gặp khách hàng đều gọn gàng sang trọng',
        gia_von: 230000,
        don_gia: 420000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 18,
        sl_toi_thieu: 2,
        dong_goi: 8000,
        ho_tro_ship: 12000,
        chi_phi_khac: 0
      }
    ]
  },
  {
    id: 'spa',
    icon: '💆',
    name: 'Spa / Tóc / Nail',
    shortDesc: 'Gội đầu dưỡng sinh',
    scenarioTitle: 'Mộc Spa & Chăm Sóc Tóc -- Đặt lịch khung giờ vàng',
    store: {
      ten_cua_hang: 'Mộc Spa & Chăm Sóc Tóc',
      khach_hang_muc_tieu: 'Chị em văn phòng và khách khu vực gần tiệm cần thư giãn cổ vai gáy, chăm sóc tóc và làm đẹp cuối tuần',
      diem_noi_bat: 'Dùng dầu gội thảo dược nấu mới mỗi ngày, không gian yên tĩnh sạch sẽ, báo giá trọn gói trước khi làm',
      lien_he: '0933.222.111 - 24 Lê Lợi (Đặt lịch trước giữ chỗ)',
      ghi_chu_gia: 'Áp dụng cho khách đặt lịch trước qua Zalo hoặc Hotline'
    },
    products: [
      {
        id: 'sp_1',
        ten_san_pham: 'Gói Gội Đầu Dưỡng Sinh Thảo Dược 60 Phút',
        mo_ta: 'Gồm rửa mặt, massage đầu cổ vai gáy thư giãn, gội nước bồ kết thảo dược và sấy dưỡng tóc',
        gia_von: 45000,
        don_gia: 149000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 20,
        sl_toi_thieu: 2,
        dong_goi: 0,
        ho_tro_ship: 0,
        chi_phi_khac: 10000
      },
      {
        id: 'sp_2',
        ten_san_pham: 'Combo Làm Nail Sơn Gel Trơn + Nhặt Da Chăm Sóc Móng',
        mo_ta: 'Làm sạch biểu bì, tạo form móng, sơn gel bền màu bóng đẹp với bảng hơn 100 màu chọn tại tiệm',
        gia_von: 50000,
        don_gia: 160000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 15,
        sl_toi_thieu: 2,
        dong_goi: 0,
        ho_tro_ship: 0,
        chi_phi_khac: 12000
      },
      {
        id: 'sp_3',
        ten_san_pham: 'Liệu Trình Chăm Sóc Da Mặt Cấp Ẩm Thư Giãn 75 Phút',
        mo_ta: 'Làm sạch sâu, xông hơi, hút bã nhờn nhẹ nhàng, đắp mặt nạ cấp ẩm và massage nâng cơ',
        gia_von: 95000,
        don_gia: 290000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 25,
        sl_toi_thieu: 2,
        dong_goi: 0,
        ho_tro_ship: 0,
        chi_phi_khac: 15000
      }
    ]
  },
  {
    id: 'sua_chua',
    icon: '🔧',
    name: 'Sửa chữa / Kỹ thuật',
    shortDesc: 'Vệ sinh điều hòa',
    scenarioTitle: 'Điện Lạnh Minh Tâm -- Bảo dưỡng tại nhà báo giá minh bạch',
    store: {
      ten_san_pham_note: '',
      ten_cua_hang: 'Điện Lạnh Minh Tâm',
      khach_hang_muc_tieu: 'Hộ gia đình, chung cư, văn phòng nhỏ cần thợ vệ sinh điều hòa đúng hẹn và không phát sinh chi phí mập mờ',
      diem_noi_bat: 'Có mặt sau 30-45 phút, báo giá rõ trước khi làm, che chắn sạch sẽ trong quá trình xịt rửa',
      lien_he: '0909.888.777 - Phục vụ nội thành từ 8h00 - 20h00',
      ghi_chu_gia: 'Đã bao gồm công thợ kiểm tra áp suất gas; chưa gồm vật tư thay thế nếu hỏng'
    },
    products: [
      {
        id: 'sc_1',
        ten_san_pham: 'Gói Vệ Sinh & Bảo Dưỡng 1 Máy Điều Hòa Treo Tường',
        mo_ta: 'Xịt rửa dàn lạnh, dàn nóng, thông ống thoát nước và kiểm tra độ lạnh tổng quát',
        gia_von: 45000,
        don_gia: 180000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 15,
        sl_toi_thieu: 2,
        dong_goi: 0,
        ho_tro_ship: 20000,
        chi_phi_khac: 5000
      },
      {
        id: 'sc_2',
        ten_san_pham: 'Combo Vệ Sinh 2 Máy Điều Hòa Gia Đình',
        mo_ta: 'Vệ sinh đồng thời 2 máy trong cùng 1 lần di chuyển, tiết kiệm chi phí hơn so với gọi lẻ từng máy',
        gia_von: 85000,
        don_gia: 340000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 20,
        sl_toi_thieu: 2,
        dong_goi: 0,
        ho_tro_ship: 25000,
        chi_phi_khac: 15000
      },
      {
        id: 'sc_3',
        ten_san_pham: 'Kiểm Tra & Nạp Gas Bổ Sung Điều Hòa R32 / R410A',
        mo_ta: 'Đo áp suất thực tế bằng đồng hồ trước và sau khi nạp gas, khắc phục tình trạng máy kém lạnh',
        gia_von: 110000,
        don_gia: 280000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 10,
        sl_toi_thieu: 2,
        dong_goi: 0,
        ho_tro_ship: 20000,
        chi_phi_khac: 10000
      }
    ]
  },
  {
    id: 'khac',
    icon: '✨',
    name: 'Ngành nghề khác',
    shortDesc: 'Tự nhập linh hoạt',
    scenarioTitle: 'Cửa Hàng Tự Nhập -- Linh hoạt mọi mặt hàng / dịch vụ của bạn',
    store: {
      ten_cua_hang: 'Cửa Hàng Hộ Kinh Doanh',
      khach_hang_muc_tieu: 'Khách hàng cá nhân và gia đình quan tâm đến sản phẩm chất lượng, giá cả minh bạch',
      diem_noi_bat: 'Tư vấn tận tình, báo giá rõ ràng, giao hàng đúng hẹn',
      lien_he: '0900.123.456 - Nhập địa chỉ cửa hàng của bạn',
      ghi_chu_gia: 'Giá niêm yết rõ ràng theo đơn hàng'
    },
    products: [
      {
        id: 'kh_1',
        ten_san_pham: 'Sản Phẩm / Dịch Vụ Mẫu (Bấm Sửa để nhập mặt hàng của bạn)',
        mo_ta: 'Nhập đặc điểm thực tế, quy cách, kích thước hoặc lợi ích nổi bật của sản phẩm',
        gia_von: 100000,
        don_gia: 180000,
        so_luong: 1,
        loai_km: 'phan_tram',
        gia_tri_km: 10,
        sl_toi_thieu: 2,
        dong_goi: 5000,
        ho_tro_ship: 5000,
        chi_phi_khac: 0
      }
    ]
  }
];
