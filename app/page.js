"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [showPopup, setShowPopup] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [userId, setUserId] = useState(null);

  const [dataset, setDataset] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentOrder, setCurrentOrder] = useState(null); // { left: 'answer'|'edited_answer', right: '...' }
  const [finished, setFinished] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Tema tercihini yükle
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem("theme", newValue ? "dark" : "light");
  };

  const theme = darkMode
    ? { bg: "#121212", text: "#eee", cardBg: "#1e1e1e", border: "#333", muted: "#aaa" }
    : { bg: "#ffffff", text: "#111", cardBg: "#fff", border: "#ddd", muted: "#666" };

  // Kullanıcı ID kontrolü
  useEffect(() => {
    const savedId = localStorage.getItem("userId");
    if (!savedId) {
      setShowPopup(true);
    } else {
      setUserId(savedId);
    }
  }, []);

  // Veri setini yükle
  useEffect(() => {
    fetch("/verbositybias_dataset.json")
      .then((res) => res.json())
      .then((data) => {
        setDataset(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Veri seti yüklenemedi:", err);
        setLoading(false);
      });
  }, []);

  // Her yeni soru için A/B tarafını rastgele belirle (position bias'ı azaltmak için)
  useEffect(() => {
    if (dataset.length > 0 && currentIndex < dataset.length) {
      const isAnswerLeft = Math.random() < 0.5;
      setCurrentOrder({
        left: isAnswerLeft ? "answer" : "edited_answer",
        right: isAnswerLeft ? "edited_answer" : "answer",
      });
    }
  }, [currentIndex, dataset]);

  const handleSubmitId = () => {
    if (inputValue.trim() === "") return;
    const id = inputValue.trim();
    localStorage.setItem("userId", id);
    setUserId(id);
    setShowPopup(false);
  };

  const GOOGLE_SHEETS_URL =
    "https://script.google.com/macros/s/AKfycbwJuxGB3whM8nLsUW8zePiZCfOFrd8kj4GJaP71sWafhva244SLyjwIDoPCJTPXKsYxrQ/exec";

  const handleChoice = (side) => {
    const currentItem = dataset[currentIndex];
    const chosenType = currentOrder[side]; // 'answer' veya 'edited_answer'

    const result = {
      userId: userId,
      itemIndex: currentIndex,
      text: currentItem.text,
      chosenSide: side, // 'left' veya 'right'
      chosenType: chosenType, // 'answer' veya 'edited_answer'
      chosenSummary: currentItem[chosenType],
    };

    console.log("Seçim kaydedildi:", result);

    // Google Sheets'e gönder (Apps Script Web App üzerinden)
    fetch(GOOGLE_SHEETS_URL, {
      method: "POST",
      mode: "no-cors", // Apps Script yanıtı okunamaz ama veri yine de kaydedilir
      headers: {
        "Content-Type": "text/plain", // no-cors ile application/json header sorun çıkarabiliyor
      },
      body: JSON.stringify(result),
    }).catch((err) => {
      console.error("Google Sheets'e gönderim başarısız:", err);
    });

    if (currentIndex + 1 >= dataset.length) {
      setFinished(true);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const currentItem = dataset[currentIndex];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem 1rem",
        position: "relative",
        backgroundColor: theme.bg,
        color: theme.text,
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        aria-label="Karanlık modu değiştir"
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 1100,
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: `1px solid ${theme.border}`,
          backgroundColor: theme.cardBg,
          color: theme.text,
          fontSize: "1.2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}
      >
        {darkMode ? "☀️" : "🌙"}
      </button>

      {/* Kullanıcı ID popup */}
      {showPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: theme.cardBg,
              padding: "2rem",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              width: "90%",
              maxWidth: "550px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                fontSize: "0.95rem",
                color: theme.text,
                lineHeight: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <p style={{ margin: 0 }}>
                Merhaba! Burada yapacağınız seçimler çalışmamızı doğrudan etkileyecektir.
              </p>
              <p style={{ margin: 0 }}>
                Sizden ricamız, lütfen özetleri okuyarak ve anlayarak seçimlerinizi yapmanızdır. Bu sayede daha doğru ve güvenilir sonuçlar elde edebiliriz.
              </p>
              <p style={{ margin: 0 }}>
                Hepsini tamamlama zorunluluğunuz yok, ancak her bir özetin bizim için önemli olduğunu unutmayın. Teşekkür ederiz!
              </p>
              <p style={{ margin: 0 }}>
                Aynı soruları tekrar görmemeniz için, kullanıcı ID'nizi girmenizi rica ediyoruz. Bu sayede sizinle ilgili seçimleri kaydedebilir ve tekrar aynı soruları görmenizi engelleyebiliriz.
              </p>
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Kullanıcı ID'nizi girin"
              style={{
                padding: "0.75rem",
                borderRadius: "8px",
                border: `1px solid ${theme.border}`,
                fontSize: "1rem",
                backgroundColor: theme.bg,
                color: theme.text,
              }}
            />
            <button
              onClick={handleSubmitId}
              style={{
                backgroundColor: "#2563eb",
                color: "#fff",
                border: "none",
                padding: "0.75rem",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Onayla ve Gönder
            </button>
          </div>
        </div>
      )}

      {/* Ana içerik */}
      {!showPopup && (
        <>
          {loading && <p>Yükleniyor...</p>}

          {!loading && finished && (
            <div style={{ textAlign: "center", marginTop: "4rem" }}>
              <h2>Teşekkürler!</h2>
              <p>Tüm değerlendirmeleri tamamladınız. Katkınız için teşekkür ederiz.</p>
            </div>
          )}

          {!loading && !finished && currentItem && currentOrder && (
            <div
              style={{
                width: "100%",
                maxWidth: "1100px",
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              <p style={{ textAlign: "center", color: theme.muted, fontSize: "0.9rem" }}>
                {currentIndex + 1} / {dataset.length}
              </p>

              {/* Üstte: orijinal haber metni, tam genişlik */}
              <div
                style={{
                  width: "100%",
                  border: `1px solid ${theme.border}`,
                  borderRadius: "10px",
                  padding: "1rem",
                  maxHeight: "350px",
                  overflowY: "auto",
                  boxSizing: "border-box",
                  backgroundColor: theme.cardBg,
                }}
              >
                <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Haber Metni</h3>
                <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {currentItem.text}
                </p>
              </div>

              {/* Altta: A ve B özetleri yan yana */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1.5rem",
                  justifyContent: "center",
                  alignItems: "stretch",
                }}
              >
                {/* Sol özet (A) */}
                <div
                  style={{
                    flex: "1 1 320px",
                    maxWidth: "500px",
                    border: `1px solid ${theme.border}`,
                    borderRadius: "10px",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    backgroundColor: theme.cardBg,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>Özet A</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, flexGrow: 1 }}>
                    {currentItem[currentOrder.left]}
                  </p>
                  <button
                    onClick={() => handleChoice("left")}
                    style={{
                      backgroundColor: "#2563eb",
                      color: "#fff",
                      border: "none",
                      padding: "0.6rem",
                      borderRadius: "8px",
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    Bunu Seç
                  </button>
                </div>

                {/* Sağ özet (B) */}
                <div
                  style={{
                    flex: "1 1 320px",
                    maxWidth: "500px",
                    border: `1px solid ${theme.border}`,
                    borderRadius: "10px",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    backgroundColor: theme.cardBg,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>Özet B</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, flexGrow: 1 }}>
                    {currentItem[currentOrder.right]}
                  </p>
                  <button
                    onClick={() => handleChoice("right")}
                    style={{
                      backgroundColor: "#2563eb",
                      color: "#fff",
                      border: "none",
                      padding: "0.6rem",
                      borderRadius: "8px",
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    Bunu Seç
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}