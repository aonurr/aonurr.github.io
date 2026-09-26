"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [showPopup, setShowPopup] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    // Daha önce kaydedilmiş bir kullanıcı ID'si var mı kontrol et
    const savedId = localStorage.getItem("userId");
    if (!savedId) {
      setShowPopup(true);
    }
  }, []);

  const handleSubmit = () => {
    if (inputValue.trim() === "") return; // boş gönderimi engelle
    localStorage.setItem("userId", inputValue.trim());
    setShowPopup(false);
  };

  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        position: "relative",
      }}
    >
      <h1>Hello World</h1>

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
              backgroundColor: "#fff",
              padding: "2rem",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              minWidth: "300px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Kullanıcı ID'nizi girin"
              style={{
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontSize: "1rem",
              }}
            />
            <button
              onClick={handleSubmit}
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
    </main>
  );
}