
import React, { useState, useEffect, useMemo } from 'react';
import { Drop, Purchase, User, SelectedItem, DropApprovalStatus } from './types';
import { Header } from './components/Header';
import { Home } from './views/Home';
import { DropDetail } from './views/DropDetail';
import { SellerStudio } from './views/SellerStudio';
import { Profile } from './views/Profile';
import { InfluenceLab } from './views/InfluenceLab';
import { AdminDashboard } from './views/AdminDashboard';
import { Auth } from './views/Auth';
import * as api from './services/api';
import { Button } from './components/Button';

const parseRoute = (hash: string) => {
  const path = hash.startsWith('#/') ? hash.substring(2) : '';
  const parts = path.split('/');
  
  if (parts[0] === 'drop' && parts[1]) {
    return { view: 'DETAIL', id: parts[1] };
  }
  if (parts[0] === 'studio') {
    return { view: 'STUDIO', id: null };
  }
  if (parts[0] === 'profile') {
    return { view: 'PROFILE', id: null };
  }
  if (parts[0] === 'influence') {
    return { view: 'INFLUENCE', id: null };
  }
  if (parts[0] === 'admin') {
    return { view: 'ADMIN', id: null };
  }
  if (parts[0] === 'login' || parts[0] === 'auth') {
    return { view: 'AUTH', id: null };
  }
  return { view: 'HOME', id: null };
};

const App: React.FC = () => {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [vendorDrops, setVendorDrops] = useState<Drop[]>([]);
  const [adminDrops, setAdminDrops] = useState<Drop[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [userPurchases, setUserPurchases] = useState<Purchase[]>([]);
  const [route, setRoute] = useState(parseRoute(window.location.hash));
  
  const [isLoading, setIsLoading] = useState(true);

  // Auth form state
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const fetchDrops = async (viewer: User | null, updateLoading = true) => {
    try {
        const fetchedDrops = await api.getApprovedDrops();
        setDrops(fetchedDrops);

        if (viewer?.isVendor) {
          const fetchedVendorDrops = await api.getVendorDrops(viewer.id);
          setVendorDrops(fetchedVendorDrops);
        } else {
          setVendorDrops([]);
        }

        if (viewer?.isAdmin) {
          const fetchedAdminDrops = await api.getAllDrops();
          setAdminDrops(fetchedAdminDrops);
        } else {
          setAdminDrops([]);
        }
    } catch (e) {
        console.error("Failed to fetch drops:", e);
    } finally {
        if (updateLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      setIsLoading(true);
      const timeoutId = window.setTimeout(() => {
        if (isMounted) {
          console.warn("Bootstrap timed out; disabling loading screen.");
          setIsLoading(false);
        }
      }, 6000);
      try {
        const currentUser = await Promise.race([
          api.getCurrentUser(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Auth bootstrap timeout')), 5000))
        ]);
        if (!isMounted) return;
        setUser(currentUser);
        await fetchDrops(currentUser, false);
        if (currentUser) {
          try {
            const purchases = await api.getPurchasesByUser(currentUser.id);
            if (isMounted) setUserPurchases(purchases);
          } catch (e) {
            console.error("Error fetching purchases:", e);
          }
        } else {
          setUserPurchases([]);
        }
      } catch (e) {
        console.error("Bootstrap auth failed:", e);
      } finally {
        window.clearTimeout(timeoutId);
        if (isMounted) setIsLoading(false);
      }
    };

    bootstrap();

    // Auth listener
    const unsubscribe = api.onAuthChange(async (authUser) => {
      if (authUser) {
        setUser(authUser);
        await fetchDrops(authUser, false);
        try {
            const purchases = await api.getPurchasesByUser(authUser.id);
            setUserPurchases(purchases);
        } catch (e) {
            console.error("Error fetching purchases:", e);
        }
      } else {
        setUser(null);
        setUserPurchases([]);
        await fetchDrops(null, false);
      }
    });

    // Routing
    const handleHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const refreshUser = async () => {
    if (!user) return;
    const profile = await api.getProfile(user.id);
    if (profile) {
      setUser(prevUser => ({
        ...prevUser!,
        name: profile.name,
        email: profile.email,
        isVendor: profile.is_vendor,
        isAdmin: profile.is_admin,
      }));
    }
  };

  const selectedDrop = useMemo(() => drops.find(d => d.id === route.id), [drops, route.id]);
  const cartCount = useMemo(() => userPurchases.reduce((sum, p) => sum + p.quantity, 0), [userPurchases]);

  const handleAuthSuccess = () => {
      navigate('/profile');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleLogout = async () => {
    await api.logoutUser();
    navigate('/');
  };

  const handleStudioAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthMessage("Email and password are required.");
      return;
    }
    setIsAuthLoading(true);
    setAuthMessage(null);
    try {
      if (authMode === 'LOGIN') {
          await api.loginUser(email, password);
      } else { // SIGNUP
        await api.signUpUser(email, password);
        setAuthMessage("Account created! Logging you in...");
        setAuthMode('LOGIN');
      }
    } catch (error: any) {
      console.error(`${authMode} failed:`, error);
      setAuthMessage("Authentication failed.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSaveDrop = async (dropData: Partial<Drop>, isNewOverride?: boolean) => {
    const isUpdate = dropData.id && !isNewOverride;

    try {
        if (isUpdate) {
          const { id, ...updates } = dropData;
          await api.updateDrop(id!, updates);
        } else {
          const dropWithCreator = {
            ...dropData,
            creator_id: user?.id || 'ANONYMOUS'
          };
          await api.addDrop(dropWithCreator);
        }
        await fetchDrops(user, false);
    } catch(e) {
        console.error("Save failed", e);
        alert("Error saving drop.");
    }
  };

  const handlePurchaseConfirm = async (id: string, qty: number, name: string, email: string, deliveryRequested: boolean, selections: SelectedItem[], deliveryAddress?: string, orderNotes?: string, isBulk?: boolean): Promise<string> => {
    const drop = drops.find(d => d.id === id);
    if (!drop) throw new Error('Package not found.');
    setIsLoading(true);
    
    try {
      const purchase = await api.savePurchase(drop, {
        userId: user?.id,
        quantity: qty,
        customerName: name,
        customerEmail: email,
        deliveryRequested,
        selectedItems: selections,
        deliveryAddress,
        orderNotes,
        isBulk
      });
      
      if (user) {
        setUserPurchases(prev => [purchase, ...prev]);
      }

      const checkoutUrl = await api.createCheckoutSession(purchase.id, window.location.origin);
      
      await fetchDrops(user, false);
      // Navigation removed to allow CheckoutModal to show success/payment state
      return checkoutUrl;
      
    } catch(error) {
      console.error("Purchase failed:", error);
      // CRITICAL FIX: Re-throw the error so CheckoutModal knows it failed and doesn't show success screen
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveDrop = async (dropId: string) => {
    try {
      await api.updateDropApprovalStatus(dropId, DropApprovalStatus.APPROVED);
      await fetchDrops(user, false);
    } catch (error) {
      console.error("Failed to approve package:", error);
      alert("Failed to approve package.");
    }
  };

  const handleRejectDrop = async (dropId: string) => {
    try {
      await api.updateDropApprovalStatus(dropId, DropApprovalStatus.REJECTED);
      await fetchDrops(user, false);
    } catch (error) {
      console.error("Failed to reject package:", error);
      alert("Failed to reject package.");
    }
  };

  const renderView = () => {
    if (isLoading && route.view !== 'STUDIO') {
      return <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white"><p className="text-2xl font-black italic uppercase tracking-widest animate-pulse">Loading Drops...</p></div>;
    }

    switch(route.view) {
      case 'HOME':
        return <Home user={user} drops={drops} onSelectDrop={(id) => navigate(`/drop/${id}`)} onPartnerClick={() => navigate('/studio')} />;
      case 'DETAIL':
        return selectedDrop ? <DropDetail user={user} drop={selectedDrop} onBack={() => navigate('/')} onPurchaseConfirm={handlePurchaseConfirm} /> : <Home user={user} drops={drops} onSelectDrop={(id) => navigate(`/drop/${id}`)} onPartnerClick={() => navigate('/studio')} />;
      case 'AUTH':
        return user ? <Profile user={user} purchases={userPurchases} onLogout={handleLogout} onBack={() => navigate('/')} /> : <Auth onSuccess={handleAuthSuccess} />;
      case 'STUDIO':
        if (user) {
          return <SellerStudio user={user} onProfileUpdate={refreshUser} onBack={() => navigate('/')} onSave={handleSaveDrop} existingDrops={vendorDrops} />;
        }
        return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-md mx-auto">
              <div className="w-24 h-24 bg-fuchsia-500 text-black flex items-center justify-center font-bold text-5xl skew-x-[-12deg] mb-12 shadow-[8px_8px_0px_0px_#fff] mx-auto">s</div>
              <h1 className="font-heading text-5xl font-black italic uppercase tracking-tighter mb-4">Restaurant Studio</h1>
              <p className="text-zinc-500 font-bold uppercase tracking-widest mb-10">{authMode === 'LOGIN' ? 'Log in to continue' : 'Create your vendor account'}</p>
              
              <form onSubmit={handleStudioAuthAction} className="space-y-6">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Email <span className="text-fuchsia-500">*</span></label>
                <input 
                  type="email" 
                  placeholder="EMAIL" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border-4 border-black p-6 font-black uppercase italic tracking-tighter text-2xl outline-none focus:border-fuchsia-500 placeholder-zinc-700"
                  required
                />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Password <span className="text-fuchsia-500">*</span></label>
                <input 
                  type="password" 
                  placeholder="PASSWORD"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border-4 border-black p-6 font-black uppercase italic tracking-tighter text-2xl outline-none focus:border-fuchsia-500 placeholder-zinc-700"
                  required
                />
                </div>

                {authMessage && (
                  <div className={`p-4 text-sm font-bold text-center border-2 ${authMessage.includes('failed') ? 'text-red-400 bg-red-900/50 border-red-500' : 'text-green-400 bg-green-900/50 border-green-500'}`}>
                    {authMessage}
                  </div>
                )}

                <Button size="xl" type="submit" isLoading={isAuthLoading} className="w-full">
                  {authMode === 'LOGIN' ? 'Log In' : 'Sign Up'}
                </Button>
              </form>

              <p className="mt-8 text-sm">
                {authMode === 'LOGIN' ? "Don't have an account? " : "Already have an account? "}
                <button 
                  onClick={() => {
                    setAuthMode(authMode === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
                    setAuthMessage(null);
                    setEmail('');
                    setPassword('');
                  }} 
                  className="font-bold text-fuchsia-500 hover:underline"
                >
                  {authMode === 'LOGIN' ? 'Sign Up' : 'Log In'}
                </button>
              </p>
            </div>
          </div>
        );
      case 'PROFILE':
        return user ? <Profile user={user} purchases={userPurchases} onLogout={handleLogout} onBack={() => navigate('/')} /> : <Auth onSuccess={handleAuthSuccess} />;
      case 'INFLUENCE':
        return <InfluenceLab user={user} drops={drops} onBack={() => navigate('/')} onLogin={handleLogin} />;
      case 'ADMIN':
        return user?.isAdmin ? <AdminDashboard allDrops={adminDrops} onApproveDrop={handleApproveDrop} onRejectDrop={handleRejectDrop} onBack={() => navigate('/')} /> : <Home user={user} drops={drops} onSelectDrop={(id) => navigate(`/drop/${id}`)} onPartnerClick={() => navigate('/studio')} />;
      default:
        return <Home user={user} drops={drops} onSelectDrop={(id) => navigate(`/drop/${id}`)} onPartnerClick={() => navigate('/studio')} />;
    }
  }

  return (
    <div className="bg-[#050505] text-white min-h-screen selection:bg-fuchsia-400 selection:text-black">
      {route.view !== 'STUDIO' && route.view !== 'ADMIN' && route.view !== 'AUTH' && (
        <Header 
          user={user} 
          onLogin={handleLogin} 
          onLogout={handleLogout}
          cartCount={cartCount} 
        />
      )}
      <main>
        {renderView()}
      </main>
    </div>
  );
};

export default App;
