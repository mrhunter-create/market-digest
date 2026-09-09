// Các tín hiệu suy ra bằng CÔNG THỨC CỐ ĐỊNH từ số liệu chốt phiên.
// Cố ý không để LLM tự tính hay tự diễn giải: mọi con số và mọi nhãn trạng thái
// ở đây đều tái lập được, nên có thể dùng làm bằng chứng để kiểm tra lập luận.

const pick = (market, sym) => market.find(m => m.symbol === sym && m.ok) || null;
const pct = m => (m && Number.isFinite(m.changePct) ? m.changePct : null);

const fmtBp  = v => `${v > 0 ? "+" : ""}${Math.round(v)} bp`;
const fmtPp  = v => `${v > 0 ? "+" : ""}${v.toFixed(2)} đpt`;   // điểm phần trăm
const fmtLvl = v => `${v > 0 ? "+" : ""}${v.toFixed(2)}`;

/** So sánh A với B theo % thay đổi trong phiên; trả về chênh lệch điểm phần trăm. */
function relative(market, a, b) {
  const x = pct(pick(market, a)), y = pct(pick(market, b));
  return x == null || y == null ? null : x - y;
}

export function computeSignals(market) {
  const out = [];
  const add = s => { if (s) out.push(s); };

  // 1. Độ dốc đường cong 2–10 năm. Đảo ngược = thị trường trái phiếu định giá
  //    tăng trưởng yếu đi; dốc lên nhanh = kỳ vọng lạm phát hoặc nguồn cung nợ.
  const y2 = pick(market, "US2Y"), y10 = pick(market, "US10Y");
  if (y2 && y10) {
    const spread = (y10.price - y2.price) * 100;                 // bp
    const prevSpread = (y10.prev - y2.prev) * 100;
    const d = spread - prevSpread;
    add({
      id: "curve",
      label: "Đường cong 2–10 năm",
      value: fmtBp(spread),
      delta: fmtBp(d),
      dir: d > 1 ? "up" : d < -1 ? "down" : "flat",
      state: spread < 0 ? "đảo ngược" : spread < 50 ? "phẳng" : "dốc lên",
      tone: spread < 0 ? "alert" : spread < 50 ? "watch" : "calm",
      note: spread < 0
        ? "Lợi suất ngắn cao hơn dài — thị trường trái phiếu định giá tăng trưởng suy yếu."
        : `Chênh lệch ${Math.round(spread)}bp, ${d > 1 ? "dốc thêm" : d < -1 ? "phẳng lại" : "gần như không đổi"} so với phiên trước.`,
      inputs: `10 năm ${y10.price}% − 2 năm ${y2.price}%`,
    });
  }

  // 2. Cấu trúc kỳ hạn biến động. VIX 9 ngày vượt VIX 30 ngày = lo ngại dồn vào
  //    sát trước mắt, thường quanh một sự kiện cụ thể.
  const v9 = pick(market, ".VIX9D"), v30 = pick(market, ".VIX");
  if (v9 && v30) {
    const gap = v9.price - v30.price;
    add({
      id: "vixterm",
      label: "Cấu trúc biến động",
      value: fmtLvl(gap),
      delta: null,
      dir: gap > 0 ? "up" : "down",
      state: gap > 0.5 ? "căng ngắn hạn" : gap < -1 ? "bình lặng" : "trung tính",
      tone: gap > 0.5 ? "alert" : gap < -1 ? "calm" : "watch",
      note: gap > 0.5
        ? "Biến động kỳ hạn ngắn đắt hơn kỳ hạn dài — thị trường đang phòng hộ cho một sự kiện gần."
        : "Không có dấu hiệu phòng hộ dồn vào ngắn hạn.",
      inputs: `VIX 9 ngày ${v9.price} − VIX ${v30.price}`,
    });
  }

  // 3. Phòng thủ so với thị trường chung. Điện nước + tiêu dùng thiết yếu vượt
  //    S&P 500 = dòng tiền chuyển sang thế phòng ngự.
  const xlu = pct(pick(market, "XLU")), xlp = pct(pick(market, "XLP")), spx = pct(pick(market, ".SPX"));
  if (xlu != null && xlp != null && spx != null) {
    const d = (xlu + xlp) / 2 - spx;
    add({
      id: "defensive",
      label: "Phòng thủ vs thị trường",
      value: fmtPp(d),
      delta: null,
      dir: d > 0 ? "up" : "down",
      state: d > 0.3 ? "phòng ngự" : d < -0.3 ? "chấp nhận rủi ro" : "trung tính",
      tone: d > 0.3 ? "alert" : d < -0.3 ? "calm" : "watch",
      note: d > 0.3
        ? "Nhóm phòng thủ vượt trội — dòng tiền rút khỏi tài sản rủi ro cao."
        : d < -0.3
          ? "Nhóm phòng thủ tụt lại — nhà đầu tư vẫn ưu tiên tài sản rủi ro."
          : "Không có sự dịch chuyển rõ giữa phòng thủ và rủi ro.",
      inputs: `(Điện nước ${xlu.toFixed(2)}% + Thiết yếu ${xlp.toFixed(2)}%) / 2 − S&P 500 ${spx.toFixed(2)}%`,
    });
  }

  // 4. Bán dẫn dẫn dắt hay tụt lại. Đây là đại diện gần nhất cho chu kỳ và cho
  //    kỳ vọng chi tiêu AI, thường đi trước chỉ số chung.
  const soxx = relative(market, "SOXX", ".SPX");
  if (soxx != null) {
    add({
      id: "semis",
      label: "Bán dẫn vs S&P 500",
      value: fmtPp(soxx),
      delta: null,
      dir: soxx > 0 ? "up" : "down",
      state: soxx > 0.5 ? "dẫn dắt" : soxx < -0.5 ? "tụt lại" : "cùng nhịp",
      tone: soxx < -0.5 ? "alert" : soxx > 0.5 ? "calm" : "watch",
      note: soxx > 0.5
        ? "Bán dẫn vượt chỉ số chung — kỳ vọng chu kỳ và chi tiêu AI còn được giữ."
        : soxx < -0.5
          ? "Bán dẫn tụt lại — nhóm dẫn dắt chu kỳ mất động lực trước chỉ số chung."
          : "Bán dẫn đi cùng nhịp chỉ số chung.",
      inputs: `SOXX − S&P 500`,
    });
  }

  // 5. Độ rộng thị trường. Cổ phiếu nhỏ tụt lại nhiều = đà tăng chỉ dựa vào
  //    một nhóm hẹp, dễ đổ khi nhóm đó quay đầu.
  const iwm = relative(market, "IWM", ".SPX");
  if (iwm != null) {
    add({
      id: "breadth",
      label: "Cổ phiếu nhỏ vs S&P 500",
      value: fmtPp(iwm),
      delta: null,
      dir: iwm > 0 ? "up" : "down",
      state: iwm < -0.5 ? "hẹp" : iwm > 0.5 ? "lan rộng" : "trung tính",
      tone: iwm < -0.5 ? "alert" : iwm > 0.5 ? "calm" : "watch",
      note: iwm < -0.5
        ? "Cổ phiếu nhỏ tụt lại đáng kể — đà thị trường phụ thuộc vào một nhóm hẹp."
        : iwm > 0.5
          ? "Cổ phiếu nhỏ vượt trội — mức tăng lan rộng hơn ra ngoài nhóm dẫn dắt."
          : "Độ rộng không lệch rõ về phía nào.",
      inputs: `Cổ phiếu nhỏ − S&P 500`,
    });
  }

  // 6. Khẩu vị rủi ro tín dụng. Trái phiếu rủi ro cao yếu hơn hạng đầu tư là
  //    tín hiệu căng thẳng sớm, thường xuất hiện trước khi cổ phiếu phản ứng.
  const credit = relative(market, "HYG", "LQD");
  if (credit != null) {
    add({
      id: "credit",
      label: "Tín dụng rủi ro cao vs hạng đầu tư",
      value: fmtPp(credit),
      delta: null,
      dir: credit > 0 ? "up" : "down",
      state: credit < -0.3 ? "chớm căng" : credit > 0.3 ? "thuận lợi" : "trung tính",
      tone: credit < -0.3 ? "alert" : credit > 0.3 ? "calm" : "watch",
      note: credit < -0.3
        ? "Trái phiếu rủi ro cao yếu hơn hạng đầu tư — căng thẳng tín dụng thường xuất hiện trước cổ phiếu."
        : credit > 0.3
          ? "Trái phiếu rủi ro cao vượt hạng đầu tư — khẩu vị rủi ro tín dụng còn tốt."
          : "Chênh lệch tín dụng không đáng kể.",
      inputs: `HYG − LQD`,
    });
  }

  return out;
}
