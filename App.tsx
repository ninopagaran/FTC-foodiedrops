
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
import { VendorPage } from './views/VendorPage';
import * as api from './services/api';

const parseRoute = (hash: string) => {
  const isAuthCallback = hash.includes('access_token=') || hash.includes('type=signup');
  if (isAuthCallback) {
    return { view: 'AUTH', id: null, confirm: true };
  }
  const path = hash.startsWith('#/') ? hash.substring(2) : '';
  const parts = path.split('/');
  
  if (parts[0] === 'drop' && parts[1]) {
    return { view: 'DETAIL', id: parts[1], confirm: false };
  }
  if (parts[0] === 'studio') {
    return { view: 'STUDIO', id: null, confirm: false };
  }
  if (parts[0] === 'profile') {
    return { view: 'PROFILE', id: null, confirm: false };
  }
  if (parts[0] === 'influence') {
    return { view: 'INFLUENCE', id: null, confirm: false };
  }
  if (parts[0] === 'admin') {
    return { view: 'ADMIN', id: null, confirm: false };
  }
  if (parts[0] === 'login' || parts[0] === 'auth') {
    return { view: 'AUTH', id: null, confirm: false };
  }
  if (parts[0] && parts.length === 1) {
    return { view: 'VENDOR', id: decodeURIComponent(parts[0]), confirm: false };
  }
  return { view: 'HOME', id: null, confirm: false };
};

const App: React.FC = () => {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [vendorDrops, setVendorDrops] = useState<Drop[]>([]);
  const [adminDrops, setAdminDrops] = useState<Drop[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [userPurchases, setUserPurchases] = useState<Purchase[]>([]);
  const [route, setRoute] = useState(parseRoute(window.location.hash));
  const [bookingFeePerPackage, setBookingFeePerPackage] = useState(0);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);


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
        try {
          const settings = await api.getAppSettings();
          if (isMounted) setBookingFeePerPackage(settings.booking_fee_per_package);
        } catch (e) {
          console.error("Failed to load app settings:", e);
          if (isMounted) setBookingFeePerPackage(0);
        }
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
        if (isMounted) {
          setIsLoading(false);
          setIsAuthReady(true);
        }
      }
    };

    bootstrap();

    // Auth listener
    const unsubscribe = api.onAuthChange(async (authUser) => {
      const shouldBlockUI = !isAuthReady;
      if (shouldBlockUI) setIsLoading(true);
      try {
        if (authUser) {
          setUser(authUser);
          try {
            const settings = await api.getAppSettings();
            setBookingFeePerPackage(settings.booking_fee_per_package);
          } catch (e) {
            console.error("Failed to load app settings:", e);
            setBookingFeePerPackage(0);
          }
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
          try {
            const settings = await api.getAppSettings();
            setBookingFeePerPackage(settings.booking_fee_per_package);
          } catch (e) {
            console.error("Failed to load app settings:", e);
            setBookingFeePerPackage(0);
          }
          await fetchDrops(null, false);
        }
      } finally {
        if (isMounted) {
          if (shouldBlockUI) setIsLoading(false);
          setIsAuthReady(true);
        }
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

  useEffect(() => {
    if (user && route.confirm) {
      navigate('/profile');
    }
  }, [user, route.confirm]);

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
        username: profile.username,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        isVendor: profile.is_vendor,
        isAdmin: profile.is_admin,
      }));
    }
  };

  const selectedDrop = useMemo(() => drops.find(d => d.id === route.id), [drops, route.id]);

  const handleAuthSuccess = (destination: 'profile' | 'studio' = 'profile') => {
      navigate(destination === 'studio' ? '/studio' : '/profile');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleLogout = async () => {
    await api.logoutUser();
    navigate('/');
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
    if (!user) {
      throw new Error('Please log in to place an order.');
    }
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
      }, bookingFeePerPackage);
      
      if (user) {
        setUserPurchases(prev => [purchase, ...prev]);
      }

      const checkoutUrl = await api.createCheckoutSession(purchase.id, window.location.origin, purchase.checkout_token);
      
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
    if (!isAuthReady && isLoading && route.view !== 'STUDIO') {
      return <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white"><p className="text-2xl font-black italic uppercase tracking-widest animate-pulse">Loading Drops...</p></div>;
    }

    switch(route.view) {
      case 'HOME':
        return <Home user={user} drops={drops} onSelectDrop={(id) => navigate(`/drop/${id}`)} onPartnerClick={() => navigate('/studio')} />;
      case 'DETAIL':
        return selectedDrop ? <DropDetail user={user} drop={selectedDrop} bookingFeePerPackage={bookingFeePerPackage} onBack={() => navigate('/')} onPurchaseConfirm={handlePurchaseConfirm} /> : <Home user={user} drops={drops} onSelectDrop={(id) => navigate(`/drop/${id}`)} onPartnerClick={() => navigate('/studio')} />;
      case 'AUTH':
        return user ? <Profile user={user} purchases={userPurchases} onLogout={handleLogout} onBack={() => navigate('/')} onProfileUpdate={refreshUser} /> : <Auth onSuccess={handleAuthSuccess} initialMessage={route.confirm ? 'Email confirmed. Please log in.' : undefined} />;
      case 'STUDIO':
        if (!user) {
          navigate('/login');
          return null;
        }
        if (!user.isVendor) {
          alert('Foodie accounts are for ordering. Vendor accounts are for restaurants and require a separate email.');
          navigate('/profile');
          return null;
        }
        return <SellerStudio user={user} onProfileUpdate={refreshUser} onBack={() => navigate('/')} onSave={handleSaveDrop} existingDrops={vendorDrops} />;
      case 'PROFILE':
        return user ? <Profile user={user} purchases={userPurchases} onLogout={handleLogout} onBack={() => navigate('/')} onProfileUpdate={refreshUser} /> : <Auth onSuccess={handleAuthSuccess} />;
      case 'INFLUENCE':
        return <InfluenceLab user={user} drops={drops} onBack={() => navigate('/')} onLogin={handleLogin} />;
      case 'ADMIN':
        if (!isAuthReady) {
          return <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white"><p className="text-2xl font-black italic uppercase tracking-widest animate-pulse">Loading Admin...</p></div>;
        }
        return user?.isAdmin ? <AdminDashboard allDrops={adminDrops} onApproveDrop={handleApproveDrop} onRejectDrop={handleRejectDrop} onRefreshDrops={() => fetchDrops(user, false)} onBack={() => navigate('/')} /> : <Home user={user} drops={drops} onSelectDrop={(id) => navigate(`/drop/${id}`)} onPartnerClick={() => navigate('/studio')} />;
      case 'VENDOR':
        return <VendorPage vendorSlug={route.id || ''} drops={drops} onSelectDrop={(id) => navigate(`/drop/${id}`)} />;
      default:
        return <Home user={user} drops={drops} onSelectDrop={(id) => navigate(`/drop/${id}`)} onPartnerClick={() => navigate('/studio')} />;
    }
  }

  return (
    <div className="bg-[#050505] text-white min-h-screen selection:bg-fuchsia-400 selection:text-black">
      {route.view !== 'STUDIO' && route.view !== 'ADMIN' && route.view !== 'AUTH' && (
        <Header 
          user={user} 
          onLogout={handleLogout}
        />
      )}
      <main>
        {renderView()}
      </main>
    </div>
  );
};

export default App;
