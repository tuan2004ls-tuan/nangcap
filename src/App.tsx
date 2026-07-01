import React, { useState, useEffect } from "react";

const INITIAL_BET = 10;
const STORAGE_KEY = "betting_tool_state_v3";

function formatMoney(val) {
  return (
    (Number(val) || 0).toLocaleString("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + "k"
  );
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

export default function App() {
  // Core States
  const [history, setHistory] = useState([]);
  const [currentBet, setCurrentBet] = useState(INITIAL_BET);
  const [round, setRound] = useState(1);
  const [totalLost, setTotalLost] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // UI Interactive States
  const [wonInput, setWonInput] = useState("");
  const [showWonInput, setShowWonInput] = useState(false);
  const [loseInput, setLoseInput] = useState("");
  const [showLoseInput, setShowLoseInput] = useState(false);
  const [isEditingBet, setIsEditingBet] = useState(false);
  const [editBetInput, setEditBetInput] = useState("");

  // Load state from artifact storage on mount
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
          const parsed = JSON.parse(saved); // Bỏ .value đi vì localStorage trả về chuỗi trực tiếp
          if (parsed.history) setHistory(parsed.history);
          if (parsed.currentBet !== undefined) setCurrentBet(parsed.currentBet);
          if (parsed.round !== undefined) setRound(parsed.round);
          if (parsed.totalLost !== undefined) setTotalLost(parsed.totalLost);
          if (parsed.totalWon !== undefined) setTotalWon(parsed.totalWon);
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

  // Save state to artifact storage whenever it changes (sau khi đã load xong)
  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        const stateToSave = { history, currentBet, round, totalLost, totalWon };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave)); // Dùng localStorage.setItem
      } catch (e) {
        console.error("Lỗi khi lưu dữ liệu:", e);
      }
    })();
  }, [history, currentBet, round, totalLost, totalWon, isLoaded]);

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
    const nextBet = Math.max(
      0,
      Math.round(calcNextBetOnLoss(currentBet, lost) * 100) / 100
    );

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
    const nextBet = Math.max(
      0,
      Math.round(calcNextBetOnLoss(currentBet, lost) * 100) / 100
    );

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
    const nextBet = Math.max(
      0,
      Math.round(calcNextBetOnLoss(currentBet, lost) * 100) / 100
    );

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
    const next = calcNextBetOnWin(currentBet, won);
    const safeNext = Math.max(0, Math.round(next * 100) / 100);

    updateHistory({
      round,
      bet: currentBet,
      result: "thắng",
      won,
      nextBet: safeNext,
      time: getTimestamp(),
    });
    setTotalWon((p) => p + won);
    setCurrentBet(safeNext);
    setRound((r) => r + 1);
    setShowWonInput(false);
    setWonInput("");
  }

  function handleSaveManualBet() {
    const newBet = parseFloat(editBetInput);
    if (!isNaN(newBet) && newBet >= 0) {
      setCurrentBet(Math.round(newBet * 100) / 100);
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
      localStorage.removeItem(STORAGE_KEY); // Dùng localStorage.removeItem
    }
  }

  const netPnL = totalWon - totalLost;
  const loseInputVal = parseFloat(loseInput);
  const wonInputVal = parseFloat(wonInput);

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
                      Math.round(
                        calcNextBetOnLoss(
                          currentBet,
                          Math.min(loseInputVal, currentBet)
                        ) * 100
                      ) / 100
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
                  {formatMoney(
                    Math.max(
                      0,
                      Math.round(
                        calcNextBetOnWin(currentBet, wonInputVal) * 100
                      ) / 100
                    )
                  )}
                </span>
                <br />
                <span style={{ fontStyle: "italic" }}>
                  Công thức: ( {formatMoney(currentBet)} × 2 −{" "}
                  {formatMoney(wonInputVal)} ) / 2
                </span>
              </div>
            )}
          </div>
        )}

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
                      border: `1px solid ${colors.cardBorder}`,
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
          Thắng: ( Cược × 2 − Thắng ) / 2
          <br />
          Dữ liệu được lưu riêng cho bạn và tự động khôi phục khi mở lại.
        </div>
      </div>
    </div>
  );
}
