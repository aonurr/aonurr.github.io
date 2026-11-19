"use client";

import { useState, useEffect } from "react";

const GOOGLE_SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbwJuxGB3whM8nLsUW8zePiZCfOFrd8kj4GJaP71sWafhva244SLyjwIDoPCJTPXKsYxrQ/exec";

const confidenceOptions = [
  { value: "low", label: "Düşük" },
  { value: "medium", label: "Orta" },
  { value: "high", label: "Yüksek" },
];

export default function Survey({ userId }) {
  const progressKey = `progress_${userId}`;
  const introKey = `intro_${userId}`;

  const [dataset, setDataset] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentOrder, setCurrentOrder] = useState(null); // { left: 'answer'|'edited_answer', right: ... }
  const [showIntro, setShowIntro] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Mevcut soru için kullanıcının cevapları
  const [selectedSide, setSelectedSide] = useState(null); // 'left' | 'right'
  const [confidence, setConfidence] = useState(null); // 'low' | 'medium' | 'high'
  const [explanation, setExplanation] = useState("");

  const finished = !loading && dataset.length > 0 && currentIndex >= dataset.length;

  // Tema, ilerleme ve karşılama ekranı durumunu yükle
  useEffect(() => {
    try {
      if (localStorage.getItem("theme") === "dark") setDarkMode(true);
      if (!localStorage.getItem(introKey)) setShowIntro(true);
    } catch (e) {
      setShowIntro(true);
    }
  }, [introKey]);

  // Bu kullanıcıya ait soruları yükle
  useEffect(() => {
    fetch(`/data/${userId}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // Kayıtlı ilerleme sadece AYNI soru setine aitse kullanılır.
        // Kullanıcıya yeni sorular atanırsa baştan başlar.
        let start = 0;
        try {
          const [savedSetId, savedIndex] = (localStorage.getItem(progressKey) || "").split(":");
          const idx = parseInt(savedIndex, 10);
          if (data.length > 0 && String(data[0].id) === savedSetId && !Number.isNaN(idx)) {
            start = idx;
          }
        } catch (e) {}
        setCurrentIndex(start);
        setDataset(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Veri seti yüklenemedi:", err);
        setLoadError(true);
        setLoading(false);
      });
  }, [userId, progressKey]);

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

  const toggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem("theme", newValue ? "dark" : "light");
  };

  const theme = darkMode
    ? { bg: "#121212", text: "#eee", cardBg: "#1e1e1e", border: "#333", muted: "#aaa" }
    : { bg: "#ffffff", text: "#111", cardBg: "#fff", border: "#ddd", muted: "#666" };

  const startSurvey = () => {
    localStorage.setItem(introKey, "1");
    setShowIntro(false);
  };

  const handleSubmit = () => {
    if (!selectedSide || !confidence) return;

    const currentItem = dataset[currentIndex];
    const chosenType = currentOrder[selectedSide]; // 'answer' veya 'edited_answer'

    const result = {
      userId: userId,
      itemIndex: currentItem.id, // örn. "pbias_303" veya "vbias_102" (hangi veri seti + orijinal sıra)
      source: currentItem.source, // 'position' veya 'verbosity'
      text: currentItem.text,
      chosenSide: selectedSide, // 'left' veya 'right'
      chosenType: chosenType, // 'answer' veya 'edited_answer'
      chosenSummary: currentItem[chosenType],
      confidence: confidence, // 'low' | 'medium' | 'high'
      explanation: explanation.trim(),
    };

    console.log("Seçim kaydedildi:", result);

    // Google Sheets'e gönder (Apps Script Web App üzerinden)
    fetch(GOOGLE_SHEETS_URL, {
      method: "POST",
      mode: "no-cors", // Apps Script yanıtı okunamaz ama veri yine de kaydedilir
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(result),
    }).catch((err) => {
      console.error("Google Sheets'e gönderim başarısız:", err);
    });

    // İlerlemeyi kaydet ve sonraki soruya geç
    const next = currentIndex + 1;
    localStorage.setItem(progressKey, `${dataset[0].id}:${next}`);
    setSelectedSide(null);
    setConfidence(null);
    setExplanation("");
    setCurrentIndex(next);
  };

  const currentItem = dataset[currentIndex];
  const canSubmit = selectedSide && confidence;

  const cardStyle = (side) => ({
    flex: "1 1 320px",
    maxWidth: "500px",
    border: selectedSide === side ? "2px solid #2563eb" : `1px solid ${theme.border}`,
    borderRadius: "10px",
    padding: selectedSide === side ? "calc(1rem - 1px)" : "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    backgroundColor: theme.cardBg,
  });

  const chooseButtonStyle = (side) => ({
    backgroundColor: selectedSide === side ? "#1d4ed8" : "#2563eb",
    color: "#fff",
    border: "none",
    padding: "0.6rem",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: "bold",
    cursor: "pointer",
  });

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

      {/* Karşılama ekranı */}
      {showIntro && (
        <div
          style={{
            position: "fixed",
            inset: 0,
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
              color: theme.text,
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
                Her bir özetin bizim için önemli olduğunu unutmayın. Teşekkür ederiz!
              </p>
              <p style={{ margin: 0 }}>
                Seçimleriniz size özel bu bağlantı üzerinden kaydedilir. Sayfayı kapatsanız bile aynı bağlantıyı açarak kaldığınız yerden devam edebilirsiniz.
              </p>
            </div>
            <button
              onClick={startSurvey}
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
              Başla
            </button>
          </div>
        </div>
      )}

      {/* Ana içerik */}
      {!showIntro && (
        <>
          {loading && <p>Yükleniyor...</p>}

          {!loading && loadError && (
            <div style={{ textAlign: "center", marginTop: "4rem" }}>
              <h2>Sorular yüklenemedi</h2>
              <p>Lütfen sayfayı yenileyin. Sorun devam ederse bağlantıyı gönderen kişiyle iletişime geçin.</p>
            </div>
          )}

          {finished && (
            <div style={{ textAlign: "center", marginTop: "4rem" }}>
              <h2>Teşekkürler!</h2>
              <p>Tüm değerlendirmeleri tamamladınız. Katkınız için teşekkür ederiz.</p>
            </div>
          )}

          {!loading && !loadError && !finished && currentItem && currentOrder && (
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
                <div style={cardStyle("left")}>
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>Özet A</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, flexGrow: 1 }}>
                    {currentItem[currentOrder.left]}
                  </p>
                  <button onClick={() => setSelectedSide("left")} style={chooseButtonStyle("left")}>
                    {selectedSide === "left" ? "✓ Seçildi" : "Bunu Seç"}
                  </button>
                </div>

                <div style={cardStyle("right")}>
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>Özet B</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, flexGrow: 1 }}>
                    {currentItem[currentOrder.right]}
                  </p>
                  <button onClick={() => setSelectedSide("right")} style={chooseButtonStyle("right")}>
                    {selectedSide === "right" ? "✓ Seçildi" : "Bunu Seç"}
                  </button>
                </div>
              </div>

              {/* Emin olma oranı */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>Seçiminizden ne kadar eminsiniz?</h3>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
                  {confidenceOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setConfidence(option.value)}
                      style={{
                        minWidth: "110px",
                        padding: "0.6rem 1rem",
                        borderRadius: "8px",
                        fontSize: "0.9rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                        border:
                          confidence === option.value ? "2px solid #2563eb" : `1px solid ${theme.border}`,
                        backgroundColor: confidence === option.value ? "#2563eb" : theme.cardBg,
                        color: confidence === option.value ? "#fff" : theme.text,
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Açıklama kutusu */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label htmlFor="explanation" style={{ fontSize: "0.95rem", fontWeight: "bold" }}>
                  Açıklama (isteğe bağlı)
                </label>
                <textarea
                  id="explanation"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Seçiminizin nedenini kısaca yazabilirsiniz..."
                  rows={4}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.cardBg,
                    color: theme.text,
                    fontSize: "0.95rem",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Gönder butonu */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  style={{
                    backgroundColor: "#2563eb",
                    color: "#fff",
                    border: "none",
                    padding: "0.8rem 2.5rem",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    fontWeight: "bold",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    opacity: canSubmit ? 1 : 0.5,
                  }}
                >
                  Gönder
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
