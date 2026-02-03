import { Outlet, useNavigate } from "react-router-dom";
import "./uploadLayout.css";
import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import ChatList from "../../components/chatList/ChatList";
import { SettingsPanel } from "../../components/settingsPanel/SettingsPanel";
import { useSettings } from "../../context/SettingsContext";
import { useSidebar } from "../../context/SidebarContext";
import { X } from "lucide-react";

const UploadLayout = () => {
  const { userId, isLoaded } = useAuth();
  const { sidebarOpen, closeSidebar } = useSidebar();
  const { settingsOpen, setSettingsOpen } = useSettings();

  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && !userId) {
      navigate("/sign-in");
    }
  }, [isLoaded, userId, navigate]);

  // Close sidebars when clicking overlay
  const handleSidebarOverlayClick = () => {
    closeSidebar();
  };

  const handleSettingsOverlayClick = () => {
    setSettingsOpen(false);
  };

  // Close sidebar on navigation (mobile)
  const handleSidebarNavigate = () => {
    closeSidebar();
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
        {/* Sidebar header with close button and logo (visible when sidebar is open) */}
        <div className="sidebar-header">
          <button
            className="close-sidebar-btn"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
          <img src="/certificate_logo.png" alt="Dicoding AI Logo" className="sidebar-logo" />
        </div>
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