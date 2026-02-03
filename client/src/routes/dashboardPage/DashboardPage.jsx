import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import "./dashboardPage.css";
import "../../components/chatInput/chatInput.css";
import "../../components/newPrompt/newPrompt.css";
import { useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { MessageSquare, FileSearch, HelpCircle, Send, Sparkles, X } from "lucide-react";
import { ConfigContext } from "../../components/configStore/ConfigStore";
import { DocumentSelector, DocumentSelectorTrigger } from "../../components/documentSelector/DocumentSelector";
import Upload from "../../components/upload/Upload";
import { IKImage } from "imagekitio-react";

const DashboardPage = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { config, setConfig } = useContext(ConfigContext);
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
    aiData: {},
  });

  const mutation = useMutation({
    mutationFn: async (text) => {
      const token = await getToken();
      return fetch(`${import.meta.env.VITE_API_URL}/api/chats`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          img: img.dbData?.filePath,
          isInitial: true
        }),
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to create chat");
        return res.json();
      });
    },
    onSuccess: (response) => {
      // Handle both string ID and object with _id property
      const id = typeof response === 'string' ? response : response._id || response.id;

      if (!id || typeof id !== 'string') {
        console.error("Invalid chat ID received:", response);
        return;
      }

      console.log("Created chat with ID:", id);
      queryClient.invalidateQueries({ queryKey: ["userChats"] });
      // Clear image state
      setImg({ isLoading: false, error: "", dbData: {}, aiData: {} });
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
          {/* ... */}
          <div className="welcome-icon">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="welcome-title">Halo! Ada yang bisa saya bantu?</h1>
          <p className="welcome-subtitle">
            Pilih salah satu opsi di bawah atau ketik pertanyaan Anda
          </p>
        </div>

        <div className="options-grid">
          {/* ... existing buttons ... */}
          <button
            className="option-card"
            onClick={() => handleOptionClick("Buatkan saya soal dari dokumen yang sudah di upload")}
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

        <div className="chat-input-container">

          {/* Image Preview */}
          {img.isLoading && (
            <div className="image-loading mb-2">
              <div className="loading-spinner-small"></div>
              <span className="text-sm text-slate-500 ml-2">Mengupload gambar...</span>
            </div>
          )}
          {img.dbData?.filePath && (
            <div className="image-preview mb-2 relative inline-block group">
              <IKImage
                urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
                path={img.dbData.filePath} // Ensure path is passed only if truthy
                width="150"
                transformation={[{ width: 150 }]}
                className="preview-image rounded-lg border border-slate-200"
              />
              <button
                className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setImg({ isLoading: false, error: "", dbData: {}, aiData: {} })}
              >
                <X className="w-4 h-4 text-red-500" />
              </button>
            </div>
          )}

          {/* Selected Documents Display - Above Input */}
          {Array.isArray(config.selectedDocuments) && config.selectedDocuments.length > 0 && (
            <div className="selected-docs-display">
              {/* ... existing doc display ... */}
              <span className="selected-docs-label">File:</span>
              <div className="selected-docs-chips">
                {config.selectedDocuments.map((docPath, idx) => {
                  const fullName = docPath.split('/').pop()?.replace(/^\d{8}_\d{6}_/, '') || docPath;
                  const displayName = fullName.length > 12 ? fullName.substring(0, 8) + '...' : fullName;
                  return (
                    <div key={idx} className="doc-chip">
                      <span className="doc-chip-text" title={fullName}>{displayName}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // remove logic
                          const newDocs = config.selectedDocuments.filter((_, i) => i !== idx);
                          setConfig({
                            ...config,
                            selectedDocuments: newDocs,
                            document: newDocs.length > 0 ? newDocs[0] : 'none'
                          });
                        }}
                        className="doc-chip-remove"
                        aria-label="Hapus dokumen"
                      >
                        <X />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="chat-input-form">
            {/* Document selector popup */}
            {showDocumentSelector && (
              <DocumentSelector onClose={() => setShowDocumentSelector(false)} />
            )}
            <div className="upload-wrapper">
              <Upload setImg={setImg} />
            </div>
            <DocumentSelectorTrigger
              onClick={() => setShowDocumentSelector(!showDocumentSelector)}
              selectedCount={
                Array.isArray(config.selectedDocuments)
                  ? config.selectedDocuments.length
                  : (config.document && config.document !== 'none' ? 1 : 0)
              }
            />
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
    </div>
  );
};

export default DashboardPage;