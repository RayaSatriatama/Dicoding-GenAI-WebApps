import { Outlet, useNavigate } from "react-router-dom";
import "./uploadLayout.css";
import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import ChatList from "../../components/chatList/ChatList";
import { SettingsPanel } from "../../components/settingsPanel/SettingsPanel";
import { useSettings } from "../../context/SettingsContext";
import { Menu, X, Settings } from "lucide-react";

const UploadLayout = () => {
  const { userId, isLoaded } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { settingsOpen, setSettingsOpen } = useSettings();

  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && !userId) {
      navigate("/sign-in");
    }
  }, [isLoaded, userId, navigate]);

  // Close sidebars when clicking overlay
  const handleSidebarOverlayClick = () => {
    setSidebarOpen(false);
  };

  const handleSettingsOverlayClick = () => {
    setSettingsOpen(false);
  };

  // Close sidebar on navigation (mobile)
  const handleSidebarNavigate = () => {
    setSidebarOpen(false);
  };

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p>Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="uploadLayout">
      {/* Mobile sidebar toggle - Left */}
      <button 
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile settings toggle - Right */}
      <button 
        className="settings-toggle"
        onClick={() => setSettingsOpen(!settingsOpen)}
        aria-label="Toggle settings"
      >
        {settingsOpen ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
      </button>

      {/* Sidebar overlay for mobile */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={handleSidebarOverlayClick}
      />

      {/* Settings overlay for mobile */}
      <div 
        className={`settings-overlay ${settingsOpen ? 'active' : ''}`}
        onClick={handleSettingsOverlayClick}
      />

      {/* Left Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <ChatList onNavigate={handleSidebarNavigate} />
      </aside>

      {/* Main content */}
      <main className="content">
        <Outlet />
      </main>

      {/* Right Settings Panel */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default UploadLayout;