import { Link, Outlet } from "react-router-dom";
import "./rootLayout.css";
import { ClerkProvider, SignedIn, UserButton } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "../../components/sidebar/Sidebar";
import { ConfigProvider } from '../../components/configStore/ConfigStore';
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const queryClient = new QueryClient();

const RootLayout = () => {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <div className="rootLayout">
            <header>
              <Link to="/" className="logo">
                <img src="/certificate_logo.png" alt="" />
              </Link>
              <div className="user">
                <SignedIn>
                  <UserButton />
                  <Sidebar />
                </SignedIn>
              </div>
            </header>
            <main>
              <Outlet />
            </main>
          </div>
        </ConfigProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
};

export default RootLayout;