// =====================================================================
// BỘ CÂU LỆNH TRUY VẤN MONGODB — PHIÊN BẢN NÂNG CẤP
// Database: quanlybaohanhdienthoai
// Đồ án: Quản lý bảo hành điện thoại — Bước 4 (Truy vấn)
// Chạy sau khi đã chạy nosqlbooster_setup.js
// =====================================================================

use quanlybaohanhdienthoai;

// #####################################################################
// # 0. HÀM TIỆN ÍCH & INDEX (NÂNG CẤP MỚI)
// #####################################################################

// ---- Escape ký tự đặc biệt trong regex để tìm kiếm an toàn ----
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---- Tạo index để tăng tốc các truy vấn hay dùng ----
db.hangsanxuat.createIndex({ ten_hang: 1 }, { unique: true, name: "idx_ten_hang" });

db.sanpham.createIndex({ hang_id: 1 }, { name: "idx_sp_hang_id" });
db.sanpham.createIndex({ ten_san_pham: 1 }, { name: "idx_sp_ten" });
db.sanpham.createIndex({ thoi_han_bao_hanh_thang: 1 }, { name: "idx_sp_bao_hanh" });

db.phieubaohanh.createIndex({ imei: 1 }, { unique: true, name: "idx_pbh_imei" });
db.phieubaohanh.createIndex({ khach_hang_id: 1 }, { name: "idx_pbh_khach_hang" });
db.phieubaohanh.createIndex({ san_pham_id: 1 }, { name: "idx_pbh_san_pham" });
db.phieubaohanh.createIndex({ ngay_het_han_bao_hanh: 1 }, { name: "idx_pbh_het_han" });
db.phieubaohanh.createIndex({ ngay_mua: 1 }, { name: "idx_pbh_ngay_mua" });

// #####################################################################
// # A. HANGSANXUAT
// #####################################################################

// ---- HSX01 — Xem hãng (tất cả, có phân trang) ----
const HSX01_trang = 1;      // số trang, bắt đầu từ 1
const HSX01_soDong = 20;    // số dòng mỗi trang
db.hangsanxuat.find()
  .sort({ ten_hang: 1 })
  .skip((HSX01_trang - 1) * HSX01_soDong)
  .limit(HSX01_soDong)
  .pretty();

// ---- HSX02 — Tìm hãng (theo tên, an toàn hơn dùng _id lồng nhau) ----
db.hangsanxuat.findOne({ ten_hang: "Apple" });

// ---- HSX03 — Thêm hãng (kiểm tra trùng tên trước khi thêm) ----
(function themHang(tenHang) {
  const daTonTai = db.hangsanxuat.findOne({ ten_hang: tenHang });
  if (daTonTai) {
    print(`⚠️  Hãng "${tenHang}" đã tồn tại, không thêm nữa.`);
    return;
  }
  try {
    const kq = db.hangsanxuat.insertOne({ ten_hang: tenHang });
    printjson(kq);
  } catch (err) {
    print(`❌ Lỗi khi thêm hãng: ${err.message}`);
  }
})("Vivo");

// ---- HSX04 — Sửa hãng (đổi tên hãng, kiểm tra tồn tại) ----
(function suaTenHang(tenCu, tenMoi) {
  try {
    const kq = db.hangsanxuat.updateOne(
      { ten_hang: tenCu },
      { $set: { ten_hang: tenMoi } }
    );
    if (kq.matchedCount === 0) {
      print(`⚠️  Không tìm thấy hãng "${tenCu}" để sửa.`);
    } else {
      printjson(kq);
    }
  } catch (err) {
    print(`❌ Lỗi khi sửa hãng: ${err.message}`);
  }
})("Vivo", "vivo");

// ---- HSX05 — Xóa hãng (chặn xóa nếu còn sản phẩm liên kết) ----
(function xoaHang(tenHang) {
  const hang = db.hangsanxuat.findOne({ ten_hang: tenHang });
  if (!hang) {
    print(`⚠️  Không tìm thấy hãng "${tenHang}".`);
    return;
  }
  const soSanPham = db.sanpham.countDocuments({ hang_id: hang._id });
  if (soSanPham > 0) {
    print(`⚠️  Không thể xóa: hãng "${tenHang}" còn ${soSanPham} sản phẩm liên kết.`);
    return;
  }
  try {
    const kq = db.hangsanxuat.deleteOne({ _id: hang._id });
    printjson(kq);
  } catch (err) {
    print(`❌ Lỗi khi xóa hãng: ${err.message}`);
  }
})("vivo");

// ---- HSX06 — Tìm hãng theo tên (không phân biệt hoa/thường, gần đúng, an toàn regex) ----
const tuKhoaHang = escapeRegex("sam");
db.hangsanxuat.find({
  ten_hang: { $regex: tuKhoaHang, $options: "i" }
}).pretty();

// ---- HSX07 — Sắp xếp hãng theo tên (A → Z, có collation cho tiếng Việt) ----
db.hangsanxuat.find()
  .collation({ locale: "vi", strength: 1 })
  .sort({ ten_hang: 1 })
  .pretty();

// ---- HSX08 — $lookup hãng với sản phẩm (có sắp xếp con) ----
db.hangsanxuat.aggregate([
  {
    $lookup: {
      from: "sanpham",
      let: { hangId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$hang_id", "$$hangId"] } } },
        { $sort: { ten_san_pham: 1 } }
      ],
      as: "danh_sach_san_pham"
    }
  }
]);

// ---- HSX09 — Đếm số sản phẩm của từng hãng (gồm cả hãng chưa có sản phẩm) ----
db.hangsanxuat.aggregate([
  {
    $lookup: {
      from: "sanpham",
      localField: "_id",
      foreignField: "hang_id",
      as: "san_pham"
    }
  },
  {
    $project: {
      _id: 0,
      ten_hang: 1,
      so_luong_san_pham: { $size: "$san_pham" }
    }
  },
  { $sort: { so_luong_san_pham: -1, ten_hang: 1 } }
]);

// #####################################################################
// # B. SANPHAM
// #####################################################################

// ---- SP01 — Xem tất cả sản phẩm (có phân trang) ----
const SP01_trang = 1;
const SP01_soDong = 20;
db.sanpham.find()
  .sort({ ten_san_pham: 1 })
  .skip((SP01_trang - 1) * SP01_soDong)
  .limit(SP01_soDong)
  .pretty();

// ---- SP02 — Tìm sản phẩm (theo tên, trực tiếp) ----
db.sanpham.findOne({ ten_san_pham: "iPhone 15 Pro" });

// ---- SP03 — Thêm sản phẩm (kiểm tra hãng tồn tại + không trùng tên) ----
(function themSanPham(tenSP, tenHang, baoHanhThang) {
  const hang = db.hangsanxuat.findOne({ ten_hang: tenHang });
  if (!hang) {
    print(`⚠️  Không tìm thấy hãng "${tenHang}", hủy thêm sản phẩm.`);
    return;
  }
  if (db.sanpham.findOne({ ten_san_pham: tenSP })) {
    print(`⚠️  Sản phẩm "${tenSP}" đã tồn tại.`);
    return;
  }
  try {
    const kq = db.sanpham.insertOne({
      ten_san_pham: tenSP,
      hang_id: hang._id,
      thoi_han_bao_hanh_thang: NumberInt(baoHanhThang)
    });
    printjson(kq);
  } catch (err) {
    print(`❌ Lỗi khi thêm sản phẩm: ${err.message}`);
  }
})("iPhone 16", "Apple", 12);

// ---- SP04 — Cập nhật sản phẩm ----
(function suaThoiHanBaoHanh(tenSP, thangMoi) {
  const kq = db.sanpham.updateOne(
    { ten_san_pham: tenSP },
    { $set: { thoi_han_bao_hanh_thang: NumberInt(thangMoi) } }
  );
  kq.matchedCount === 0
    ? print(`⚠️  Không tìm thấy sản phẩm "${tenSP}".`)
    : printjson(kq);
})("iPhone 16", 15);

// ---- SP05 — Xóa sản phẩm (chặn xóa nếu còn phiếu bảo hành liên kết) ----
(function xoaSanPham(tenSP) {
  const sp = db.sanpham.findOne({ ten_san_pham: tenSP });
  if (!sp) {
    print(`⚠️  Không tìm thấy sản phẩm "${tenSP}".`);
    return;
  }
  const soPhieu = db.phieubaohanh.countDocuments({ san_pham_id: sp._id });
  if (soPhieu > 0) {
    print(`⚠️  Không thể xóa: sản phẩm "${tenSP}" còn ${soPhieu} phiếu bảo hành.`);
    return;
  }
  const kq = db.sanpham.deleteOne({ _id: sp._id });
  printjson(kq);
})("iPhone 16");

// ---- SP06 — Tìm theo hãng (bằng tên hãng, không cần biết _id trước) ----
db.sanpham.aggregate([
  {
    $lookup: {
      from: "hangsanxuat",
      localField: "hang_id",
      foreignField: "_id",
      as: "hang"
    }
  },
  { $unwind: "$hang" },
  { $match: { "hang.ten_hang": "Samsung" } },
  { $project: { hang: 0 } }
]);

// ---- SP07 — Tìm theo tên (regex an toàn) ----
db.sanpham.find({
  ten_san_pham: { $regex: escapeRegex("redmi"), $options: "i" }
}).pretty();

// ---- SP08 — Tìm sản phẩm có thời hạn bảo hành ≥ X tháng ----
const X = 12;
db.sanpham.find({
  thoi_han_bao_hanh_thang: { $gte: NumberInt(X) }
}).sort({ thoi_han_bao_hanh_thang: -1 }).pretty();

// ---- SP09 — Sắp xếp theo thời hạn bảo hành (giảm dần, có phân trang) ----
db.sanpham.find()
  .sort({ thoi_han_bao_hanh_thang: -1 })
  .limit(20)
  .pretty();

// ---- SP10 — $lookup sản phẩm với hãng ----
db.sanpham.aggregate([
  {
    $lookup: {
      from: "hangsanxuat",
      localField: "hang_id",
      foreignField: "_id",
      as: "hang"
    }
  },
  { $unwind: "$hang" },
  {
    $project: {
      ten_san_pham: 1,
      thoi_han_bao_hanh_thang: 1,
      ten_hang: "$hang.ten_hang"
    }
  },
  { $sort: { ten_hang: 1, ten_san_pham: 1 } }
]);

// ---- SP11 — Thống kê số sản phẩm theo hãng ----
db.sanpham.aggregate([
  {
    $group: {
      _id: "$hang_id",
      so_luong_san_pham: { $sum: 1 }
    }
  },
  {
    $lookup: {
      from: "hangsanxuat",
      localField: "_id",
      foreignField: "_id",
      as: "hang"
    }
  },
  { $unwind: "$hang" },
  {
    $project: {
      _id: 0,
      ten_hang: "$hang.ten_hang",
      so_luong_san_pham: 1
    }
  },
  { $sort: { so_luong_san_pham: -1 } }
]);

// ---- SP12 — Thống kê thời hạn bảo hành (nhỏ nhất / lớn nhất / trung bình, lọc null) ----
db.sanpham.aggregate([
  { $match: { thoi_han_bao_hanh_thang: { $ne: null } } },
  {
    $group: {
      _id: null,
      bao_hanh_thap_nhat: { $min: "$thoi_han_bao_hanh_thang" },
      bao_hanh_cao_nhat: { $max: "$thoi_han_bao_hanh_thang" },
      bao_hanh_trung_binh: { $avg: "$thoi_han_bao_hanh_thang" },
      tong_so_san_pham: { $sum: 1 }
    }
  },
  {
    $project: {
      _id: 0,
      bao_hanh_thap_nhat: 1,
      bao_hanh_cao_nhat: 1,
      bao_hanh_trung_binh: { $round: ["$bao_hanh_trung_binh", 1] },
      tong_so_san_pham: 1
    }
  }
]);

// ---- SP13 (MỚI) — Dashboard sản phẩm: nhiều thống kê trong 1 lần gọi ($facet) ----
db.sanpham.aggregate([
  {
    $facet: {
      thong_ke_bao_hanh: [
        { $match: { thoi_han_bao_hanh_thang: { $ne: null } } },
        {
          $group: {
            _id: null,
            min: { $min: "$thoi_han_bao_hanh_thang" },
            max: { $max: "$thoi_han_bao_hanh_thang" },
            avg: { $avg: "$thoi_han_bao_hanh_thang" }
          }
        }
      ],
      top5_bao_hanh_dai_nhat: [
        { $sort: { thoi_han_bao_hanh_thang: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, ten_san_pham: 1, thoi_han_bao_hanh_thang: 1 } }
      ],
      tong_so_san_pham: [
        { $count: "tong" }
      ]
    }
  }
]);

// #####################################################################
// # C. PHIEUBAOHANH
// #####################################################################

// ---- PBH01 — Xem tất cả phiếu bảo hành (có phân trang) ----
const PBH01_trang = 1;
const PBH01_soDong = 20;
db.phieubaohanh.find()
  .sort({ ngay_mua: -1 })
  .skip((PBH01_trang - 1) * PBH01_soDong)
  .limit(PBH01_soDong)
  .pretty();

// ---- PBH02 — Tìm phiếu theo IMEI ----
db.phieubaohanh.findOne({ imei: "356789012345671" });

// ---- PBH03 — Thêm phiếu bảo hành (kiểm tra khách hàng/sản phẩm tồn tại + IMEI không trùng) ----
(function themPhieuBaoHanh(imei, tenKhachHang, tenSanPham, ngayMua, giaBan, soThangBaoHanh) {
  if (db.phieubaohanh.findOne({ imei })) {
    print(`⚠️  IMEI "${imei}" đã tồn tại.`);
    return;
  }
  const khachHang = db.khachhang.findOne({ ho_ten: tenKhachHang });
  if (!khachHang) {
    print(`⚠️  Không tìm thấy khách hàng "${tenKhachHang}".`);
    return;
  }
  const sanPham = db.sanpham.findOne({ ten_san_pham: tenSanPham });
  if (!sanPham) {
    print(`⚠️  Không tìm thấy sản phẩm "${tenSanPham}".`);
    return;
  }
  const ngayHetHan = new Date(ngayMua);
  ngayHetHan.setMonth(ngayHetHan.getMonth() + soThangBaoHanh);
  try {
    const kq = db.phieubaohanh.insertOne({
      imei: imei,
      khach_hang_id: khachHang._id,
      san_pham_id: sanPham._id,
      ngay_mua: ngayMua,
      gia_ban: NumberDecimal(String(giaBan)),
      ngay_het_han_bao_hanh: ngayHetHan
    });
    printjson(kq);
  } catch (err) {
    print(`❌ Lỗi khi thêm phiếu bảo hành: ${err.message}`);
  }
})(
  "356789012349999",
  "Nguyễn Văn A",
  "Galaxy S24",
  ISODate("2026-09-20"),
  21500000,
  12
);

// ---- PBH04 — Cập nhật phiếu bảo hành ----
(function suaGiaBan(imei, giaMoi) {
  const kq = db.phieubaohanh.updateOne(
    { imei: imei },
    { $set: { gia_ban: NumberDecimal(String(giaMoi)) } }
  );
  kq.matchedCount === 0
    ? print(`⚠️  Không tìm thấy IMEI "${imei}".`)
    : printjson(kq);
})("356789012349999", 21000000);

// ---- PBH05 — Xóa phiếu bảo hành ----
(function xoaPhieuBaoHanh(imei) {
  const kq = db.phieubaohanh.deleteOne({ imei: imei });
  printjson(kq);
})("356789012349999");

// ---- PBH06 — Đếm số phiếu bảo hành ----
db.phieubaohanh.countDocuments();

// ---- PBH07 — Tìm theo khách hàng (bằng tên, không cần _id trước) ----
db.phieubaohanh.aggregate([
  {
    $lookup: {
      from: "khachhang",
      localField: "khach_hang_id",
      foreignField: "_id",
      as: "khach_hang"
    }
  },
  { $unwind: "$khach_hang" },
  { $match: { "khach_hang.ho_ten": "Nguyễn Văn A" } },
  { $project: { khach_hang: 0 } }
]);

// ---- PBH08 — Tìm theo sản phẩm (bằng tên, không cần _id trước) ----
db.phieubaohanh.aggregate([
  {
    $lookup: {
      from: "sanpham",
      localField: "san_pham_id",
      foreignField: "_id",
      as: "san_pham"
    }
  },
  { $unwind: "$san_pham" },
  { $match: { "san_pham.ten_san_pham": "iPhone 15 Pro" } },
  { $project: { san_pham: 0 } }
]);

// ---- PBH09 — Tìm máy còn bảo hành (kèm số ngày còn lại) ----
db.phieubaohanh.aggregate([
  { $match: { ngay_het_han_bao_hanh: { $gte: new Date() } } },
  {
    $addFields: {
      so_ngay_con_lai: {
        $dateDiff: { startDate: new Date(), endDate: "$ngay_het_han_bao_hanh", unit: "day" }
      }
    }
  },
  { $sort: { so_ngay_con_lai: 1 } }
]);

// ---- PBH10 — Tìm máy hết bảo hành (kèm số ngày đã hết hạn) ----
db.phieubaohanh.aggregate([
  { $match: { ngay_het_han_bao_hanh: { $lt: new Date() } } },
  {
    $addFields: {
      so_ngay_da_het_han: {
        $dateDiff: { startDate: "$ngay_het_han_bao_hanh", endDate: new Date(), unit: "day" }
      }
    }
  },
  { $sort: { so_ngay_da_het_han: -1 } }
]);

// ---- PBH11 — Tìm bảo hành theo khoảng ngày mua ----
db.phieubaohanh.find({
  ngay_mua: {
    $gte: ISODate("2026-01-01"),
    $lte: ISODate("2026-12-31")
  }
}).sort({ ngay_mua: -1 }).pretty();

// ---- PBH12 — Sắp xếp theo ngày mua (mới nhất trước, có phân trang) ----
db.phieubaohanh.find()
  .sort({ ngay_mua: -1 })
  .limit(20)
  .pretty();

// ---- PBH13 — $lookup với khách hàng ----
db.phieubaohanh.aggregate([
  {
    $lookup: {
      from: "khachhang",
      localField: "khach_hang_id",
      foreignField: "_id",
      as: "khach_hang"
    }
  },
  { $unwind: "$khach_hang" },
  {
    $project: {
      imei: 1,
      ngay_mua: 1,
      ten_khach_hang: "$khach_hang.ho_ten",
      so_dien_thoai_khach: "$khach_hang.so_dien_thoai"
    }
  }
]);

// ---- PBH14 — $lookup với sản phẩm ----
db.phieubaohanh.aggregate([
  {
    $lookup: {
      from: "sanpham",
      localField: "san_pham_id",
      foreignField: "_id",
      as: "san_pham"
    }
  },
  { $unwind: "$san_pham" },
  {
    $project: {
      imei: 1,
      ngay_mua: 1,
      ten_san_pham: "$san_pham.ten_san_pham",
      thoi_han_bao_hanh_thang: "$san_pham.thoi_han_bao_hanh_thang"
    }
  }
]);

// ---- PBH15 — $lookup khách hàng + sản phẩm + hãng (kèm trạng thái bảo hành) ----
db.phieubaohanh.aggregate([
  {
    $lookup: {
      from: "khachhang",
      localField: "khach_hang_id",
      foreignField: "_id",
      as: "khach_hang"
    }
  },
  { $unwind: "$khach_hang" },
  {
    $lookup: {
      from: "sanpham",
      localField: "san_pham_id",
      foreignField: "_id",
      as: "san_pham"
    }
  },
  { $unwind: "$san_pham" },
  {
    $lookup: {
      from: "hangsanxuat",
      localField: "san_pham.hang_id",
      foreignField: "_id",
      as: "hang"
    }
  },
  { $unwind: "$hang" },
  {
    $addFields: {
      trang_thai_bao_hanh: {
        $cond: [{ $gte: ["$ngay_het_han_bao_hanh", new Date()] }, "Còn bảo hành", "Hết bảo hành"]
      }
    }
  },
  {
    $project: {
      imei: 1,
      ngay_mua: 1,
      ngay_het_han_bao_hanh: 1,
      trang_thai_bao_hanh: 1,
      ten_khach_hang: "$khach_hang.ho_ten",
      ten_san_pham: "$san_pham.ten_san_pham",
      ten_hang: "$hang.ten_hang"
    }
  },
  { $sort: { ngay_mua: -1 } }
]);

// ---- PBH16 — Thống kê số điện thoại (phiếu bảo hành) theo sản phẩm ----
db.phieubaohanh.aggregate([
  {
    $group: {
      _id: "$san_pham_id",
      so_luong_may: { $sum: 1 }
    }
  },
  {
    $lookup: {
      from: "sanpham",
      localField: "_id",
      foreignField: "_id",
      as: "san_pham"
    }
  },
  { $unwind: "$san_pham" },
  {
    $project: {
      _id: 0,
      ten_san_pham: "$san_pham.ten_san_pham",
      so_luong_may: 1
    }
  },
  { $sort: { so_luong_may: -1 } }
]);

// ---- PBH17 (MỚI) — Dashboard bảo hành tổng hợp ($facet: nhiều thống kê 1 lần) ----
db.phieubaohanh.aggregate([
  {
    $facet: {
      tong_quan: [
        {
          $group: {
            _id: null,
            tong_so_phieu: { $sum: 1 },
            con_bao_hanh: {
              $sum: { $cond: [{ $gte: ["$ngay_het_han_bao_hanh", new Date()] }, 1, 0] }
            },
            het_bao_hanh: {
              $sum: { $cond: [{ $lt: ["$ngay_het_han_bao_hanh", new Date()] }, 1, 0] }
            },
            doanh_thu_tong: { $sum: "$gia_ban" }
          }
        },
        { $project: { _id: 0 } }
      ],
      top5_san_pham_ban_chay: [
        { $group: { _id: "$san_pham_id", so_luong: { $sum: 1 } } },
        { $sort: { so_luong: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "sanpham",
            localField: "_id",
            foreignField: "_id",
            as: "sp"
          }
        },
        { $unwind: "$sp" },
        { $project: { _id: 0, ten_san_pham: "$sp.ten_san_pham", so_luong: 1 } }
      ],
      doanh_thu_theo_thang: [
        {
          $group: {
            _id: { nam: { $year: "$ngay_mua" }, thang: { $month: "$ngay_mua" } },
            doanh_thu: { $sum: "$gia_ban" },
            so_phieu: { $sum: 1 }
          }
        },
        { $sort: { "_id.nam": -1, "_id.thang": -1 } }
      ]
    }
  }
]);
