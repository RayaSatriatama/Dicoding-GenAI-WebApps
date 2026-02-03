import { Link, Outlet, useLocation } from "react-router-dom";
import "./rootLayout.css";
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from '../../components/configStore/ConfigStore';
import { SettingsProvider, useSettings } from '../../context/SettingsContext';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';
import { LogIn, Settings, Menu } from "lucide-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const queryClient = new QueryClient();

const HeaderContent = () => {
  const { settingsOpen, toggleSettings } = useSettings();
  const { toggleSidebar } = useSidebar();
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');
  const isUpload = location.pathname.startsWith('/upload');
  const showHamburger = isDashboard || isUpload;

  return (
    <div className="header-wrapper">
      <header className="header-glass">
        {/* Hamburger button - visible on dashboard & upload pages (mobile) */}
        {showHamburger && (
          <button
            onClick={toggleSidebar}
            className="hamburger-btn mobile-only"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Logo - always visible on desktop, hidden on mobile when hamburger shows */}
        <Link to="/" className={`logo ${showHamburger ? 'desktop-only' : ''}`}>
          <img src="/certificate_logo.png" alt="Dicoding AI Logo" />
        </Link>

        <div className="user-section">
          <SignedIn>
            {/* Settings button - mobile only, positioned before profile - HIDDEN ON HOMEPAGE */}
            {location.pathname !== '/' && (
              <button
                onClick={toggleSettings}
                className={`settings-mobile-btn ${settingsOpen ? 'active' : ''}`}
                aria-label="Toggle settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                  userButtonTrigger: "focus:shadow-none focus:ring-0",
                  userButtonPopoverCard: "shadow-lg",
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

        {/* Floating Settings Button Container - Only on Dashboard/Upload pages (NOT Homepage) */}
        {showHamburger ? (
          <SignedIn>
            {!settingsOpen && (
              <div className="fixed-settings-btn-container fixed top-[124px] right-10 z-50">
                <button
                  onClick={() => toggleSettings()}
                  className="w-8 h-8 flex items-center justify-center bg-white text-gray-600 rounded-full shadow-sm border border-gray-300
                  hover:scale-110 hover:shadow-md
                  transition-all duration-300 ease-out group"
                  title="Settings"
                >
                  <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500" />
                </button>
              </div>
            )}
          </SignedIn>
        ) : null}

      </header>
    </div>
  );
};

const RootLayout = () => {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <SidebarProvider>
            <SettingsProvider>
              <div className="rootLayout">
                <HeaderContent />
                <main>
                  <Outlet />
                </main>
              </div>
            </SettingsProvider>
          </SidebarProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
};

export default RootLayout;