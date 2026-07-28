import React, { useState, useEffect } from "react";

const INITIAL_BET = 10;
const STORAGE_KEY = "betting_tool_state_v4";

// === RÚT THANG (LADDER) ===
// "Mốc đang giữ" = mốc nghìn ngay DƯỚI cược hiện tại, nhưng không bao giờ cao hơn
// 10.000k (cược > 10.000k thì luôn giữ mốc 10.000k như bản cũ).
// Khi THẮNG: nếu số công thức rơi xuống DƯỚI mốc đang giữ -> về đúng mốc đó,
// phần dư vào "Lãi rút thang" = (mốc - số công thức) x 2. Nếu không thì giữ số công thức
// (thắng ít -> đi theo công thức, VD 10.000k thắng nhỏ -> 9.949k, chưa xuống 9.000k).
const LADDER_TOP = 10000; // trần giữ mốc = 10.000k
const LADDER_STEP = 1000; // mốc nghìn (1.000k)

function formatMoney(val) {
  return (
    (Number(val) || 0).toLocaleString("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + "k"
  );
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function calcNextBetOnWin(currentBet, wonAmount) {
  return (currentBet * 2 - wonAmount) / 1.99;
}

// Tổng quát hoá công thức thua: thua hết (mất 100% cược) -> x1.5,
// thua nửa (mất 50% cược) -> x1.25. Hai điểm này nằm trên 1 đường thẳng:
// lượt sau = cược hiện tại + 0.5 x (số tiền đã thua)
function calcNextBetOnLoss(currentBet, lostAmount) {
  return currentBet + 0.5 * lostAmount;
}

function computeWinNext(currentBet, won) {
  const formulaNext = Math.max(0, round2(calcNextBetOnWin(currentBet, won)));
  // Mốc đang giữ: mốc nghìn ngay dưới cược, nhưng tối đa là 10.000k.
  const line = Math.min(
    LADDER_TOP,
    Math.ceil(currentBet / LADDER_STEP) * LADDER_STEP - LADDER_STEP
  );
  if (line > 0 && formulaNext < line) {
    return {
      nextBet: line,
      ladder: true,
      formulaNext,
      gain: round2((line - formulaNext) * 2),
    };
  }
  return { nextBet: formulaNext, ladder: false, formulaNext, gain: 0 };
}

export default function App() {
  // Core States
  const [history, setHistory] = useState([]);
  const [currentBet, setCurrentBet] = useState(INITIAL_BET);
  const [round, setRound] = useState(1);
  const [totalLost, setTotalLost] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const [ladderProfit, setLadderProfit] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // UI Interactive States
  const [wonInput, setWonInput] = useState("");
  const [showWonInput, setShowWonInput] = useState(false);
  const [loseInput, setLoseInput] = useState("");
  const [showLoseInput, setShowLoseInput] = useState(false);
  const [isEditingBet, setIsEditingBet] = useState(false);
  const [editBetInput, setEditBetInput] = useState("");
  const [showWithdrawInput, setShowWithdrawInput] = useState(false);
  const [withdrawInput, setWithdrawInput] = useState("");

  // Load state from storage on mount
  useEffect(() => {
    // Inject iOS PWA Meta Tags dynamically for seamless "Add to Home Screen" experience
    const metaTags = [
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      { name: "apple-mobile-web-app-title", content: "Capital Pro" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover",
      },
    ];

    metaTags.forEach((tag) => {
      let el = document.querySelector(`meta[name="${tag.name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", tag.name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", tag.content);
    });

    let mounted = true;
    (async () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (mounted && saved) {
          const parsed = JSON.parse(saved);
          if (parsed.history) setHistory(parsed.history);
          if (parsed.currentBet !== undefined) setCurrentBet(parsed.currentBet);
          if (parsed.round !== undefined) setRound(parsed.round);
          if (parsed.totalLost !== undefined) setTotalLost(parsed.totalLost);
          if (parsed.totalWon !== undefined) setTotalWon(parsed.totalWon);
          if (parsed.ladderProfit !== undefined)
            setLadderProfit(parsed.ladderProfit);
        }
      } catch (e) {
        // Chưa có dữ liệu lưu trước đó - bình thường ở lần chạy đầu
      } finally {
        if (mounted) setIsLoaded(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Save state whenever it changes (sau khi đã load xong)
  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        const stateToSave = {
          history,
          currentBet,
          round,
          totalLost,
          totalWon,
          ladderProfit,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (e) {
        console.error("Lỗi khi lưu dữ liệu:", e);
      }
    })();
  }, [
    history,
    currentBet,
    round,
    totalLost,
    totalWon,
    ladderProfit,
    isLoaded,
  ]);

  // Helper to append history and keep only the latest 20 items
  const updateHistory = (newItem) => {
    setHistory((prev) => {
      const updated = [newItem, ...prev];
      return updated.slice(0, 20); // Maintain exactly up to 20 most recent records
    });
  };

  function getTimestamp() {
    return new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleLose() {
    const lost = currentBet;
    const nextBet = Math.max(0, round2(calcNextBetOnLoss(currentBet, lost)));

    updateHistory({
      round,
      bet: currentBet,
      result: "thua hết",
      lost,
      won: 0,
      nextBet,
      time: getTimestamp(),
    });
    setTotalLost((p) => p + lost);
    setCurrentBet(nextBet);
    setRound((r) => r + 1);
    setShowWonInput(false);
    setShowLoseInput(false);
    setWonInput("");
    setLoseInput("");
  }

  function handleHalfLose() {
    const lost = currentBet / 2;
    const nextBet = Math.max(0, round2(calcNextBetOnLoss(currentBet, lost)));

    updateHistory({
      round,
      bet: currentBet,
      result: "thua nửa",
      lost,
      won: 0,
      nextBet,
      time: getTimestamp(),
    });
    setTotalLost((p) => p + lost);
    setCurrentBet(nextBet);
    setRound((r) => r + 1);
    setShowWonInput(false);
    setShowLoseInput(false);
    setWonInput("");
    setLoseInput("");
  }

  function handleLoseConfirm() {
    const raw = parseFloat(loseInput);
    if (isNaN(raw) || raw <= 0) return;
    // Không thể thua nhiều hơn số tiền đã đặt cược
    const lost = Math.min(raw, currentBet);
    const nextBet = Math.max(0, round2(calcNextBetOnLoss(currentBet, lost)));

    updateHistory({
      round,
      bet: currentBet,
      result: "thua khác",
      lost,
      won: 0,
      nextBet,
      time: getTimestamp(),
    });
    setTotalLost((p) => p + lost);
    setCurrentBet(nextBet);
    setRound((r) => r + 1);
    setShowLoseInput(false);
    setLoseInput("");
  }

  function handleWinConfirm() {
    const won = parseFloat(wonInput);
    if (isNaN(won) || won <= 0) return;

    const res = computeWinNext(currentBet, won);

    updateHistory({
      round,
      bet: currentBet,
      result: "thắng",
      won,
      nextBet: res.nextBet,
      ladder: res.ladder,
      formulaNext: res.ladder ? res.formulaNext : undefined,
      gain: res.ladder ? res.gain : 0,
      time: getTimestamp(),
    });
    setTotalWon((p) => p + won);
    setCurrentBet(res.nextBet);
    if (res.ladder) setLadderProfit((p) => round2(p + res.gain));
    setRound((r) => r + 1);
    setShowWonInput(false);
    setWonInput("");
  }

  function handleWithdrawConfirm() {
    const amt = parseFloat(withdrawInput);
    if (isNaN(amt) || amt <= 0) return;
    setLadderProfit((p) => Math.max(0, round2(p - amt)));
    setShowWithdrawInput(false);
    setWithdrawInput("");
  }

  function handleSaveManualBet() {
    const newBet = parseFloat(editBetInput);
    if (!isNaN(newBet) && newBet >= 0) {
      setCurrentBet(round2(newBet));
      setIsEditingBet(false);
    }
  }

  function handleReset() {
    if (
      window.confirm(
        "Bạn có chắc chắn muốn xóa toàn bộ dữ liệu và bắt đầu lại?"
      )
    ) {
      setHistory([]);
      setCurrentBet(INITIAL_BET);
      setRound(1);
      setWonInput("");
      setLoseInput("");
      setShowWonInput(false);
      setShowLoseInput(false);
      setTotalLost(0);
      setTotalWon(0);
      setLadderProfit(0);
      setShowWithdrawInput(false);
      setWithdrawInput("");
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const netPnL = totalWon - totalLost;
  const loseInputVal = parseFloat(loseInput);
  const wonInputVal = parseFloat(wonInput);

  // Dự tính rút thang cho ô nhập THẮNG
  const winPreview = computeWinNext(currentBet, wonInputVal);
  const winFormulaNext = winPreview.formulaNext;
  const winWillLadder = winPreview.ladder;
  const winNextPreview = winPreview.nextBet;
  const winGainPreview = winPreview.gain;

  // Premium Luxury Color Palette (Midnight Sapphire & Brushed Gold Accents)
  const colors = {
    bg: "#0A0E1A",
    cardBg: "#131A30",
    cardBorder: "#232D4B",
    textMain: "#F4F6FA",
    textMuted: "#7E8B9B",
    gold: "#D4AF37",
    goldLight: "#F3E5AB",
    red: "#E05656",
    orange: "#E29543",
    green: "#4EAF6F",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
        color: colors.textMain,
        padding:
          "calc(20px + env(safe-area-inset-top)) 16px calc(30px + env(safe-area-inset-bottom)) 16px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        WebkitUserSelect: "none",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginTop: 8, marginBottom: 4 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "3px",
              color: colors.gold,
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Asset Management
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.5px",
              color: colors.textMain,
            }}
          >
            CAPITAL CONTROL
          </h1>
        </div>

        {/* Current Round Card (Interactive Edit Vốn) */}
        <div
          style={{
            background: `linear-gradient(145deg, ${colors.cardBg}, #18223F)`,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 20,
            padding: "22px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: colors.textMuted,
                fontWeight: 600,
                letterSpacing: "1px",
              }}
            >
              PHIÊN ĐÁNH #{round}
            </span>
            <button
              onClick={() => {
                setEditBetInput(currentBet.toString());
                setIsEditingBet(!isEditingBet);
              }}
              style={{
                background: isEditingBet
                  ? colors.gold
                  : "rgba(212, 175, 55, 0.12)",
                border: "none",
                borderRadius: 20,
                padding: "4px 12px",
                color: isEditingBet ? colors.bg : colors.gold,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {isEditingBet ? "Đang sửa" : "✏️ Sửa Vốn"}
            </button>
          </div>

          {isEditingBet ? (
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <input
                type="number"
                value={editBetInput}
                onChange={(e) => setEditBetInput(e.target.value)}
                style={{
                  flex: 1,
                  background: "#0A0E1A",
                  border: `1.5px solid ${colors.gold}`,
                  borderRadius: 12,
                  padding: "10px 14px",
                  color: "#fff",
                  fontSize: 22,
                  fontWeight: 700,
                  outline: "none",
                }}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSaveManualBet()}
              />
              <button
                onClick={handleSaveManualBet}
                style={{
                  background: colors.gold,
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 18px",
                  color: colors.bg,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Lưu
              </button>
            </div>
          ) : (
            <div
              style={{
                fontSize: 44,
                fontWeight: 900,
                color: colors.goldLight,
                letterSpacing: "-1px",
              }}
            >
              {formatMoney(currentBet)}
            </div>
          )}

          <div
            style={{
              fontSize: 12,
              color: colors.textMuted,
              marginTop: 6,
              fontWeight: 400,
            }}
          >
            {isEditingBet
              ? "Nhập số tiền vốn mới mong muốn"
              : "Số tiền phân phối chuẩn cho lượt này"}
          </div>

          {!isEditingBet && currentBet > LADDER_STEP && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                background: "rgba(212, 175, 55, 0.10)",
                border: `1px solid rgba(212, 175, 55, 0.25)`,
                borderRadius: 10,
                fontSize: 11,
                color: colors.gold,
                fontWeight: 700,
              }}
            >
              🪜 Đang giữ mốc{" "}
              {formatMoney(
                Math.min(
                  LADDER_TOP,
                  Math.ceil(currentBet / LADDER_STEP) * LADDER_STEP - LADDER_STEP
                )
              )}{" "}
              · thắng nhiều tụt xuống mốc này & khoá lãi, thắng ít đi theo công thức
            </div>
          )}
        </div>

        {/* Action Panel */}
        {!showWonInput && !showLoseInput ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <button
              onClick={handleLose}
              style={{
                padding: "16px 8px",
                background: "#22161B",
                border: `1px solid rgba(224, 86, 86, 0.3)`,
                borderRadius: 16,
                color: colors.red,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                lineHeight: 1.4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 18 }}>😞</span>
              <span>Thua Hết</span>
              <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.6 }}>
                Lượt sau ×1.5
              </span>
            </button>

            <button
              onClick={handleHalfLose}
              style={{
                padding: "16px 8px",
                background: "#241B15",
                border: `1px solid rgba(226, 149, 67, 0.3)`,
                borderRadius: 16,
                color: colors.orange,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                lineHeight: 1.4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 18 }}>😐</span>
              <span>Thua Nửa</span>
              <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.6 }}>
                Lượt sau ×1.25
              </span>
            </button>

            <button
              onClick={() => setShowLoseInput(true)}
              style={{
                padding: "16px 8px",
                background: "#22161B",
                border: `1px solid rgba(224, 86, 86, 0.3)`,
                borderRadius: 16,
                color: colors.red,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                lineHeight: 1.4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 18 }}>📉</span>
              <span>Thua Khác</span>
              <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.6 }}>
                Nhập số tiền
              </span>
            </button>

            <button
              onClick={() => setShowWonInput(true)}
              style={{
                padding: "16px 8px",
                background: "#14241D",
                border: `1px solid rgba(78, 175, 111, 0.3)`,
                borderRadius: 16,
                color: colors.green,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                lineHeight: 1.4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 18 }}>🏆</span>
              <span>Thắng</span>
              <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.6 }}>
                Khớp lệnh thực nhận
              </span>
            </button>
          </div>
        ) : showLoseInput ? (
          <div
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 18,
              padding: 18,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: colors.red,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              Nhập số tiền đã thua thực tế (k):
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                value={loseInput}
                onChange={(e) => setLoseInput(e.target.value)}
                placeholder="Ví dụ: 15"
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  background: colors.bg,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 700,
                  outline: "none",
                }}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleLoseConfirm()}
              />
              <button
                onClick={handleLoseConfirm}
                style={{
                  padding: "12px 22px",
                  background: colors.red,
                  border: "none",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setShowLoseInput(false);
                  setLoseInput("");
                }}
                style={{
                  padding: "12px 16px",
                  background: "rgba(224, 86, 86, 0.15)",
                  border: "none",
                  borderRadius: 12,
                  color: colors.red,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {loseInput && !isNaN(loseInputVal) && loseInputVal > 0 && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: colors.textMuted,
                  lineHeight: 1.5,
                }}
              >
                Dự kiến lượt kế tiếp:{" "}
                <span style={{ color: colors.gold, fontWeight: 700 }}>
                  {formatMoney(
                    Math.max(
                      0,
                      round2(
                        calcNextBetOnLoss(
                          currentBet,
                          Math.min(loseInputVal, currentBet)
                        )
                      )
                    )
                  )}
                </span>
                <br />
                <span style={{ fontStyle: "italic" }}>
                  Công thức: {formatMoney(currentBet)} + 0.5 ×{" "}
                  {formatMoney(Math.min(loseInputVal, currentBet))}
                </span>
                {loseInputVal > currentBet && (
                  <>
                    <br />
                    <span style={{ color: colors.red }}>
                      ⚠️ Không thể thua nhiều hơn tiền cược (
                      {formatMoney(currentBet)}) — đã tự giới hạn lại.
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 18,
              padding: 18,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: colors.green,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              Nhập chính xác số tiền thắng thực tế (k):
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                value={wonInput}
                onChange={(e) => setWonInput(e.target.value)}
                placeholder="Ví dụ: 19.5"
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  background: colors.bg,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 700,
                  outline: "none",
                }}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleWinConfirm()}
              />
              <button
                onClick={handleWinConfirm}
                style={{
                  padding: "12px 22px",
                  background: colors.green,
                  border: "none",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✓
              </button>
              <button
                onClick={() => {
                  setShowWonInput(false);
                  setWonInput("");
                }}
                style={{
                  padding: "12px 16px",
                  background: "rgba(224, 86, 86, 0.15)",
                  border: "none",
                  borderRadius: 12,
                  color: colors.red,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {wonInput && !isNaN(wonInputVal) && wonInputVal > 0 && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: colors.textMuted,
                  lineHeight: 1.5,
                }}
              >
                Dự kiến lượt kế tiếp:{" "}
                <span style={{ color: colors.gold, fontWeight: 700 }}>
                  {formatMoney(winNextPreview)}
                </span>
                <br />
                {winWillLadder ? (
                  <>
                    <span style={{ fontStyle: "italic" }}>
                      🪜 Bám mốc: về {formatMoney(winNextPreview)} (thay vì{" "}
                      {formatMoney(winFormulaNext)} theo công thức)
                    </span>
                    <br />
                    <span style={{ color: colors.green, fontWeight: 700 }}>
                      Lãi khoá thêm: +{formatMoney(winGainPreview)}
                    </span>{" "}
                    <span style={{ fontStyle: "italic" }}>
                      = ( {formatMoney(winNextPreview)} −{" "}
                      {formatMoney(winFormulaNext)} ) × 2
                    </span>
                  </>
                ) : (
                  <span style={{ fontStyle: "italic" }}>
                    Công thức: ( {formatMoney(currentBet)} × 2 −{" "}
                    {formatMoney(wonInputVal)} ) / 1.99
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Ô LÃI RÚT THANG (có thể rút ra) */}
        <div
          style={{
            background: `linear-gradient(145deg, #14241D, #101E19)`,
            border: `1px solid rgba(78, 175, 111, 0.35)`,
            borderRadius: 18,
            padding: "18px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: colors.green,
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              💰 LÃI RÚT THANG (ĐÃ KHOÁ)
            </span>
            <button
              onClick={() => {
                setWithdrawInput("");
                setShowWithdrawInput(!showWithdrawInput);
              }}
              style={{
                background: showWithdrawInput
                  ? colors.green
                  : "rgba(78, 175, 111, 0.15)",
                border: "none",
                borderRadius: 20,
                padding: "5px 14px",
                color: showWithdrawInput ? colors.bg : colors.green,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {showWithdrawInput ? "Đóng" : "➖ Rút Lãi"}
            </button>
          </div>

          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: colors.green,
              letterSpacing: "-0.5px",
            }}
          >
            {formatMoney(ladderProfit)}
          </div>

          {showWithdrawInput ? (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                type="number"
                value={withdrawInput}
                onChange={(e) => setWithdrawInput(e.target.value)}
                placeholder="Số lãi muốn rút ra (k)"
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  background: colors.bg,
                  border: `1px solid rgba(78, 175, 111, 0.4)`,
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  outline: "none",
                }}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleWithdrawConfirm()}
              />
              <button
                onClick={handleWithdrawConfirm}
                style={{
                  padding: "12px 20px",
                  background: colors.green,
                  border: "none",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✓
              </button>
            </div>
          ) : (
            <div
              style={{
                fontSize: 11,
                color: colors.textMuted,
                marginTop: 6,
              }}
            >
              Mỗi bậc rút thang cộng ( số về − số công thức ) × 2 · bấm "Rút Lãi"
              để trừ khi lấy tiền ra
            </div>
          )}
        </div>

        {/* Executive Stats Block */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 16,
            padding: "12px",
          }}
        >
          {[
            {
              label: "VỐN ĐÃ BỎ",
              value: formatMoney(totalLost),
              color: colors.textMain,
            },
            {
              label: "TỔNG THẮNG",
              value: formatMoney(totalWon),
              color: colors.green,
            },
            {
              label: "NET PNL",
              value: (netPnL >= 0 ? "+" : "") + formatMoney(netPnL),
              color: netPnL >= 0 ? colors.green : colors.red,
            },
          ].map((s, idx) => (
            <div
              key={idx}
              style={{
                textAlign: "center",
                borderRight:
                  idx < 2 ? `1px solid ${colors.cardBorder}` : "none",
                padding: "4px 0",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: colors.textMuted,
                  marginBottom: 2,
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Live Rolling History (Capped at last 20 sessions) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 4px",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.textMuted,
                letterSpacing: "1.5px",
              }}
            >
              LỊCH SỬ (TỐI ĐA 20 PHIÊN GẦN NHẤT)
            </span>
            {history.length > 0 && (
              <span
                style={{ fontSize: 11, color: colors.gold, fontWeight: 600 }}
              >
                {history.length} mục
              </span>
            )}
          </div>

          {history.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "30px 16px",
                background: colors.cardBg,
                border: `1px dashed ${colors.cardBorder}`,
                borderRadius: 16,
                color: colors.textMuted,
                fontSize: 13,
              }}
            >
              Chưa có dữ liệu phiên cược nào được ghi nhận.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: "360px",
                overflowY: "auto",
                paddingRight: 2,
              }}
            >
              {history.map((h, i) => {
                const isWin = h.result === "thắng";
                const isHalf = h.result === "thua nửa";
                const badgeColor = isWin
                  ? colors.green
                  : isHalf
                  ? colors.orange
                  : colors.red;
                const badgeBg = isWin
                  ? "rgba(78, 175, 111, 0.12)"
                  : isHalf
                  ? "rgba(226, 149, 67, 0.12)"
                  : "rgba(224, 86, 86, 0.12)";
                const fallbackLost =
                  h.result === "thua hết"
                    ? h.bet
                    : h.result === "thua nửa"
                    ? h.bet / 2
                    : 0;
                const displayLost = h.lost ?? fallbackLost;

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      background: colors.cardBg,
                      border: `1px solid ${
                        h.ladder ? "rgba(212,175,55,0.4)" : colors.cardBorder
                      }`,
                      borderRadius: 14,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        style={{
                          padding: "4px 8px",
                          background: badgeBg,
                          borderRadius: 8,
                          color: badgeColor,
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                        }}
                      >
                        #{h.round}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: colors.textMain,
                          }}
                        >
                          Cược: {formatMoney(h.bet)}
                        </div>
                        <div style={{ fontSize: 11, color: colors.textMuted }}>
                          Kết quả:{" "}
                          <span style={{ color: badgeColor, fontWeight: 600 }}>
                            {h.result}
                          </span>
                          {isWin
                            ? ` (+${formatMoney(h.won)})`
                            : ` (-${formatMoney(displayLost)})`}
                        </div>
                        {h.ladder && (
                          <div
                            style={{
                              fontSize: 10,
                              color: colors.gold,
                              fontWeight: 700,
                              marginTop: 2,
                            }}
                          >
                            🪜 Rút thang · lãi +{formatMoney(h.gain)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 9,
                          color: colors.textMuted,
                          fontWeight: 500,
                        }}
                      >
                        KẾ TIẾP
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: colors.gold,
                        }}
                      >
                        {formatMoney(h.nextBet)}
                      </div>
                      <div
                        style={{
                          fontSize: 8,
                          color: colors.textMuted,
                          marginTop: 1,
                        }}
                      >
                        {h.time || ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Reset */}
        {history.length > 0 && (
          <button
            onClick={handleReset}
            style={{
              width: "100%",
              padding: "14px",
              background: "transparent",
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: 14,
              color: colors.textMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => (e.target.style.borderColor = colors.red)}
            onMouseLeave={(e) =>
              (e.target.style.borderColor = colors.cardBorder)
            }
          >
            ↺ Khởi Tạo Lại Toàn Bộ Dữ Liệu
          </button>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 6,
            padding: "12px 14px",
            background: "rgba(20, 26, 46, 0.6)",
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 12,
            fontSize: 11,
            color: colors.textMuted,
            lineHeight: 1.6,
          }}
        >
          <div
            style={{
              color: colors.gold,
              marginBottom: 4,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: "0.5px",
            }}
          >
            CÔNG THỨC
          </div>
          Thua hết → ×1.5 · Thua nửa → ×1.25 · Thua khác → cược + 0.5×(số tiền
          thua)
          <br />
          Thắng: ( Cược × 2 − Thắng ) / 1.99
          <br />
          Rút thang: giữ mốc nghìn ngay dưới cược (tối đa 10.000k). Thắng nhiều
          làm công thức rơi dưới mốc → về đúng mốc, phần dư vào lãi; thắng ít →
          đi theo công thức.
          <br />
          Lãi rút thang = ( số về − số công thức ) × 2, cộng dồn & có thể rút ra.
          <br />
          Dữ liệu được lưu riêng cho bạn và tự động khôi phục khi mở lại.
        </div>
      </div>
    </div>
  );
}
