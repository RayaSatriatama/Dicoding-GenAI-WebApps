import { useMutation, useQueryClient } from "@tanstack/react-query";
import "./dashboardPage.css";
import { useNavigate } from "react-router-dom";
import { MessageSquare, FileSearch, HelpCircle, Send, Sparkles } from "lucide-react";

const DashboardPage = () => {
  const queryClient = useQueryClient();

  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (text) => {
      return fetch(`${import.meta.env.VITE_API_URL}/api/chats`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, isInitial: true }),
      }).then((res) => res.json());
    },
    onSuccess: (id) => {
      console.log(id);
      queryClient.invalidateQueries({ queryKey: ["userChats"] });
      navigate(`/dashboard/chats/${id}`);
    },
    onError: (error) => {
      console.error("Error creating chat:", error);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = e.target.text.value;
    if (!text) return;

    mutation.mutate(text);
  };

  const handleOptionClick = (text) => {
    mutation.mutate(text);
  };

  return (
    <div className="dashboardPage">
      <div className="dashboard-content">
        <div className="welcome-section">
          <div className="welcome-icon">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="welcome-title">Halo! Ada yang bisa saya bantu?</h1>
          <p className="welcome-subtitle">
            Pilih salah satu opsi di bawah atau ketik pertanyaan Anda
          </p>
        </div>

        <div className="options-grid">
          <button
            className="option-card"
            onClick={() => handleOptionClick("Buatkan saya soal pilihan ganda tentang pemrograman dasar")}
          >
            <div className="option-icon">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="option-content">
              <h3>Buat Soal Baru</h3>
              <p>Generate soal pilihan ganda, essay, atau true/false</p>
            </div>
          </button>

          <button
            className="option-card"
            onClick={() => handleOptionClick("Bantu saya menganalisis dokumen yang sudah saya upload")}
          >
            <div className="option-icon">
              <FileSearch className="w-6 h-6" />
            </div>
            <div className="option-content">
              <h3>Analisis Dokumen</h3>
              <p>Ekstrak informasi dari dokumen yang di-upload</p>
            </div>
          </button>

          <button
            className="option-card"
            onClick={() => handleOptionClick("Saya butuh bantuan untuk belajar")}
          >
            <div className="option-icon">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div className="option-content">
              <h3>Bantu Saya</h3>
              <p>Tanya jawab seputar materi pembelajaran</p>
            </div>
          </button>
        </div>
      </div>

      <div className="input-container">
        <form onSubmit={handleSubmit} className="input-form">
          <input 
            type="text" 
            name="text" 
            placeholder="Tanyakan apa saja..." 
            autoComplete="off"
            disabled={mutation.isPending}
          />
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <div className="loading-spinner-small"></div>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DashboardPage;