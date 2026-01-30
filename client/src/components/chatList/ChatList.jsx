// src/components/ChatList.jsx
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./chatList.css";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Upload, Compass, Trash2, MessageCircle } from "lucide-react";

const ChatList = ({ onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentChatId = location.pathname.split("/").pop();

  const { isPending, error, data, refetch } = useQuery({
    queryKey: ["userChats"],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/userchats`, {
        credentials: "include",
      });
      const chats = await response.json();
      return chats
        .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))
        .reverse();
    },
  });

  const handleDelete = async (e, chatId) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete chat");
      }

      if (currentChatId === chatId) {
        navigate("/dashboard");
      }

      refetch();
    } catch (error) {
      console.error(error);
      alert("Error deleting chat!");
    }
  };

  const handleNavigation = () => {
    if (onNavigate) onNavigate();
  };

  return (
    <div className="chatList">
      {/* Navigation section */}
      <div className="nav-section">
        <Link to="/dashboard" onClick={handleNavigation} className="nav-button primary">
          <Plus className="w-4 h-4" />
          <span>Chat Baru</span>
        </Link>
        <Link to="/upload" onClick={handleNavigation} className="nav-button">
          <Upload className="w-4 h-4" />
          <span>Upload File</span>
        </Link>
        <Link to="/" onClick={handleNavigation} className="nav-button">
          <Compass className="w-4 h-4" />
          <span>Jelajahi</span>
        </Link>
      </div>

      <div className="divider"></div>

      {/* Chat history section */}
      <div className="chat-section">
        <span className="section-title">Riwayat Chat</span>
        
        <ScrollArea className="chat-scroll-area">
          {isPending ? (
            <div className="loading-state">
              <div className="skeleton-item"></div>
              <div className="skeleton-item"></div>
              <div className="skeleton-item"></div>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>Gagal memuat riwayat chat</p>
            </div>
          ) : data?.length === 0 ? (
            <div className="empty-state">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
              <p>Belum ada riwayat chat</p>
            </div>
          ) : (
            <div className="chat-list-items">
              {data?.map((chat) => (
                <Link 
                  key={chat._id} 
                  to={`/dashboard/chats/${chat._id}`}
                  onClick={handleNavigation}
                  className={`chat-item ${currentChatId === chat._id ? 'active' : ''}`}
                >
                  <MessageCircle className="w-4 h-4 flex-shrink-0" />
                  <div className="chat-title-wrapper">
                    <span className="chat-title">{chat.title}</span>
                    <span className="chat-title chat-title-duplicate" aria-hidden="true">{chat.title}</span>
                  </div>
                  <button 
                    onClick={(e) => handleDelete(e, chat._id)} 
                    className="delete-btn"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default ChatList;
