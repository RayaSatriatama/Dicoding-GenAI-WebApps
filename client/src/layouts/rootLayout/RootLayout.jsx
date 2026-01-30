import { Link, Outlet } from "react-router-dom";
import "./rootLayout.css";
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from '../../components/configStore/ConfigStore';
import { SettingsProvider, useSettings } from '../../context/SettingsContext';
import { LogIn, Settings } from "lucide-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const queryClient = new QueryClient();

const HeaderContent = () => {
  const { toggleSettings } = useSettings();
  
  return (
    <header className="header-glass">
      <Link to="/" className="logo">
        <img src="/certificate_logo.png" alt="Dicoding AI Logo" />
      </Link>
      <nav className="nav-links">
        <SignedIn>
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/upload" className="nav-link">Upload</Link>
        </SignedIn>
      </nav>
      <div className="user-section">
        <SignedIn>
          <button 
            onClick={toggleSettings}
            className="settings-btn"
            aria-label="Toggle settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <UserButton 
            appearance={{
              elements: {
                avatarBox: "w-9 h-9 ring-2 ring-white/20 hover:ring-primary/50 transition-all"
              }
            }}
          />
        </SignedIn>
        <SignedOut>
          <Link to="/sign-in" className="sign-in-btn">
            <LogIn className="w-4 h-4" />
            <span>Masuk</span>
          </Link>
        </SignedOut>
      </div>
    </header>
  );
};

const RootLayout = () => {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <SettingsProvider>
            <div className="rootLayout">
              <HeaderContent />
              <main>
                <Outlet />
              </main>
            </div>
          </SettingsProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
};

export default RootLayout;