
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/Button';
import { Drop, DropStatus, DropType, DropApprovalStatus, QuantityTier, MenuItem, ModifierGroup, ModifierOption, User, Purchase, WaitlistEntry } from '../types';
import { DropCard } from '../components/DropCard';
import { toDateTimeLocal, generateUUID } from '../utils';
import * as api from '../services/api';

interface SellerStudioProps {
  user: User;
  onProfileUpdate: () => void;
  onBack: () => void;
  onSave: (drop: Drop, isNew?: boolean) => void;
  existingDrops: Drop[];
}

const BRAND_COLORS = [
  { name: 'Classic Fuchsia', value: '#d946ef' },
  { name: 'Electric Violet', value: '#8b5cf6' },
  { name: 'Sky High', value: '#38bdf8' },
  { name: 'Lime Punch', value: '#a3e635' },
  { name: 'Hype Orange', value: '#f97316' },
  { name: 'Lava Red', value: '#ef4444' },
  { name: 'Cyber Mint', value: '#6ee7b7' },
  { name: 'Gold Leaf', value: '#eab308' },
];

export const SellerStudio: React.FC<SellerStudioProps> = ({ user, onProfileUpdate, onBack, onSave, existingDrops }) => {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState<'BUILD' | 'MANIFEST'>('BUILD');
  const [submissionResult, setSubmissionResult] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastSubmittedId, setLastSubmittedId] = useState<string | null>(null);
  
  // Default to a placeholder image, but allow user to upload their own immediately
  const [imagePreview, setImagePreview] = useState<string>('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800');
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const myDrops = useMemo(() => existingDrops.filter(d => d.creator_id === user.id), [existingDrops, user.id]);
  const [selectedManifestId, setSelectedManifestId] = useState<string>(myDrops[0]?.id || '');
  const [manifestPurchases, setManifestPurchases] = useState<Purchase[]>([]);
  const [manifestWaitlist, setManifestWaitlist] = useState<WaitlistEntry[]>([]);
  
  // Pre-fill vendor registration fields for easier onboarding
  const [vendorName, setVendorName] = useState(user.isVendor ? user.name : '');
  const [vendorPhone, setVendorPhone] = useState(user.isVendor ? '' : '');
  const [isRegistering, setIsRegistering] = useState(false);

  const getInitialFormData = (): Partial<Drop> => {
    // Default start date: tomorrow 9am. End date: 7 days later.
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(9, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    return {
      name: '',
      chef: user.name || '', // Default to the user's name/brand
      category: '',
      price: 0, 
      total_quantity: 50,
      status: DropStatus.UPCOMING,
      type: DropType.PICKUP,
      image: '', // No default image, forces upload or URL
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      description: '',
      hype_story: '',
      location: '',
      accent_color: '#d946ef', 
      delivery_available: false,
      delivery_fee: 5,
      stripe_payment_link: '', // CRITICAL FIX: Initialize payment link field
      menu_items: [],
      quantity_tiers: [],
      vendor_contact: {
        email: user.email,
        phone: ''
      },
      logistics: {
          address: '',
          instructions: '',
          allergens: ''
      }
    };
  };

  const [formData, setFormData] = useState<Partial<Drop>>(getInitialFormData());
  
  useEffect(() => {
    const fetchManifestData = async () => {
      if (activeTab === 'MANIFEST' && myDrops.length > 0) {
        const dropIds = myDrops.map(d => d.id);
        const purchases = await api.getPurchasesForVendorDrops(dropIds);
        setManifestPurchases(purchases);
        
        const waitlist = await api.getWaitlist(dropIds);
        setManifestWaitlist(waitlist);
      }
    };
    fetchManifestData();
  }, [activeTab, myDrops]);
  
  useEffect(() => {
    if (user.isVendor && step === 1) {
      api.getProfile(user.id).then(profile => {
        if (profile) {
          setFormData(prev => ({
            ...prev,
            chef: profile.name || prev.chef, // Ensure brand name is synced
            vendor_contact: { 
                email: profile.email, 
                phone: profile.phone || prev.vendor_contact?.phone || '' 
            }
          }));
        }
      });
    }
  }, [step, user.isVendor, user.id]);

  useEffect(() => {
    if (!submissionResult) return;
    const timeout = setTimeout(() => setSubmissionResult(null), 10000);
    return () => clearTimeout(timeout);
  }, [submissionResult]);

  const handleRegisterAsVendor = async () => {
    if (!vendorName || !vendorPhone) {
      alert("Brand name and phone are required to become a vendor.");
      return;
    }
    setIsRegistering(true);
    try {
      await api.updateProfile(user.id, {
        name: vendorName,
        phone: vendorPhone,
        is_vendor: true
      });
      await onProfileUpdate(); // Refresh user state in parent
    } catch (e) {
      console.error("Vendor registration failed:", e);
      alert("There was an issue registering your vendor profile.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file));
      }
  }

  // FIXED: Safe date parsing to prevent crashes on invalid/partial input
  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    if (!value) return;
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return;
        setFormData(prev => ({ ...prev, [field]: d.toISOString() }));
    } catch (e) {
        // Ignore invalid dates to prevent crash
        console.warn("Invalid date input ignored");
    }
  };

  const addMenuItem = () => {
    const newItem: MenuItem = {
      id: generateUUID(),
      name: 'New Product',
      basePrice: 0,
      description: '',
      modifierGroups: []
    };
    setFormData(prev => ({ ...prev, menu_items: [...(prev.menu_items || []), newItem] }));
  };

  const updateMenuItem = (id: string, updates: Partial<MenuItem>) => {
    setFormData(prev => ({
      ...prev,
      menu_items: prev.menu_items?.map(item => item.id === id ? { ...item, ...updates } : item)
    }));
  };

  const addModifierGroup = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      menu_items: prev.menu_items?.map(item => {
        if (item.id === itemId) {
          const newGroup: ModifierGroup = {
            id: generateUUID(),
            name: 'Options Group',
            minSelect: 0,
            maxSelect: 1,
            options: []
          };
          return { ...item, modifierGroups: [...item.modifierGroups, newGroup] };
        }
        return item;
      })
    }));
  };

  const updateModifierGroup = (itemId: string, groupId: string, updates: Partial<ModifierGroup>) => {
    setFormData(prev => ({
      ...prev,
      menu_items: prev.menu_items?.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            modifierGroups: item.modifierGroups.map(group => group.id === groupId ? { ...group, ...updates } : group)
          };
        }
        return item;
      })
    }));
  };

  const addModifierOption = (itemId: string, groupId: string) => {
    setFormData(prev => ({
      ...prev,
      menu_items: prev.menu_items?.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            modifierGroups: item.modifierGroups.map(group => {
              if (group.id === groupId) {
                const newOption: ModifierOption = {
                  id: generateUUID(),
                  name: 'Option',
                  additionalPrice: 0
                };
                return { ...group, options: [...group.options, newOption] };
              }
              return group;
            })
          };
        }
        return item;
      })
    }));
  };

  const updateModifierOption = (itemId: string, groupId: string, optionId: string, updates: Partial<ModifierOption>) => {
    setFormData(prev => ({
      ...prev,
      menu_items: prev.menu_items?.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            modifierGroups: item.modifierGroups.map(group => {
              if (group.id === groupId) {
                return {
                  ...group,
                  options: group.options.map(opt => opt.id === optionId ? { ...opt, ...updates } : opt)
                };
              }
              return group;
            })
          };
        }
        return item;
      })
    }));
  };

  const handlePublish = async () => {
    if (!formData.vendor_contact?.email || !formData.vendor_contact?.phone) {
      return alert("Complete your contact details before submitting a drop.");
    }

    if (!imageFile && !formData.image) {
      return alert("Please upload an image for your drop.");
    }
    
    setIsPublishing(true);
    
    // FIX: Generate a proper UUID for the drop ID so the database accepts it.
    const dropId = generateUUID();
    
    try {
      let imageUrl = formData.image;
      if (imageFile) {
        imageUrl = await api.uploadImage(imageFile, dropId);
      }

      const calculatedBasePrice = (formData.menu_items || []).reduce((acc, item) => acc + item.basePrice, 0);

      const newDrop: Drop = {
        ...formData,
        id: dropId,
        image: imageUrl,
        creator_id: user.id,
        price: calculatedBasePrice || formData.price || 0,
        quantity_remaining: formData.total_quantity!,
        status: new Date(formData.start_date!) > new Date() ? DropStatus.UPCOMING : DropStatus.LIVE,
        approval_status: DropApprovalStatus.PENDING,
      } as Drop;

      const summary = `DROP SUBMITTED\n\nName: ${newDrop.name}\nChef: ${newDrop.chef}\nItems: ${newDrop.menu_items.length}\nTotal Qty: ${newDrop.total_quantity}\nStart: ${new Date(newDrop.start_date).toLocaleString()}\n\nYour drop has been received and is currently under review.`;
      
      setSubmissionResult(summary);
      setLastSubmittedId(dropId);
      // FIX: Explicitly pass 'true' to indicate this is a new drop, preventing the app from thinking it's an update because of the ID.
      await onSave(newDrop, true);
    } catch (e) {
      console.error("Publishing error:", e);
      alert("Submission error. Please verify and try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReturnToStudio = () => {
    setSubmissionResult(null);
    setStep(1);
    setImageFile(null);
    setImagePreview('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800');
    // Reset to generic defaults for the next drop
    setFormData({
        ...getInitialFormData(),
        chef: user.name,
    });
    setActiveTab('MANIFEST');
    if (lastSubmittedId) {
      setSelectedManifestId(lastSubmittedId);
    }
  };

  const updateTier = (index: number, field: keyof QuantityTier, value: any) => {
    const newTiers = [...(formData.quantity_tiers || [])];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setFormData({ ...formData, quantity_tiers: newTiers });
  };

  const selectedDropManifest = myDrops.find(d => d.id === selectedManifestId);
  
  const purchasesForSelectedDrop = useMemo(() => {
    return manifestPurchases.filter(p => p.drop_id === selectedManifestId);
  }, [manifestPurchases, selectedManifestId]);

  const waitlistForSelectedDrop = useMemo(() => {
    return manifestWaitlist.filter(w => w.drop_id === selectedManifestId);
  }, [manifestWaitlist, selectedManifestId]);

  const previewDrop = useMemo(() => ({
    ...formData, 
    image: imagePreview,
    quantity_remaining: formData.total_quantity || 100,
    total_quantity: formData.total_quantity || 100,
    price: formData.price || (formData.menu_items || []).reduce((acc, item) => acc + item.basePrice, 0)
  } as Drop), [formData, imagePreview]);

  // ... (Remainder of render is identical, just need to close the component)
  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-16">
      {submissionResult && (
        <div className="fixed top-6 right-6 z-[9999] w-full max-w-md">
          <div className="bg-zinc-950 border-4 border-white shadow-[10px_10px_0px_0px_#d946ef] p-5 animate-in slide-in-from-top-6 duration-300">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-fuchsia-500 text-black flex items-center justify-center shadow-[3px_3px_0px_0px_#fff] shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-400">Success</p>
                    <h3 className="font-heading text-2xl font-black italic uppercase tracking-tighter text-white">Drop Submitted</h3>
                  </div>
                  <button
                    onClick={() => setSubmissionResult(null)}
                    className="text-zinc-500 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-2">Your drop is pending approval.</p>
                <div className="mt-4 flex gap-3">
                  <Button size="sm" className="bg-fuchsia-500 text-black" onClick={handleReturnToStudio}>
                    New Drop
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSubmissionResult(null); setActiveTab('MANIFEST'); }}>
                    View Drops
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-16 gap-10">
          <div>
            <div className="flex items-center gap-6 mb-4">
              <button onClick={onBack} className="bg-fuchsia-600 text-black p-3 hover:bg-white transition-all shadow-[4px_4px_0px_0px_#fff]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M10 19l-7-7 7-7"></path></svg>
              </button>
              <h1 className="font-heading text-5xl font-black italic uppercase tracking-tighter leading-none">Restaurant Studio</h1>
            </div>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[11px] ml-20">Your direct line to the marketplace.</p>
          </div>
          
          {user.isVendor && (
            <div className="flex bg-zinc-950 p-1 border-2 border-zinc-900">
               <button onClick={() => setActiveTab('BUILD')} className={`px-10 py-4 text-[11px] font-black uppercase tracking-[0.3em] transition-all ${activeTab === 'BUILD' ? 'bg-fuchsia-500 text-black' : 'text-zinc-600 hover:text-white'}`}>Create Drop</button>
               <button onClick={() => setActiveTab('MANIFEST')} className={`px-10 py-4 text-[11px] font-black uppercase tracking-[0.3em] transition-all ${activeTab === 'MANIFEST' ? 'bg-fuchsia-500 text-black' : 'text-zinc-600 hover:text-white'}`}>Your Drops</button>
            </div>
          )}
        </div>

        {!user.isVendor ? (
          <div className="max-w-3xl mx-auto bg-zinc-950 border-8 border-fuchsia-500/20 p-12 md:p-20 text-center animate-in fade-in duration-500">
            <h2 className="font-heading text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-none mb-6">Become a Vendor</h2>
            <p className="text-zinc-500 font-bold uppercase tracking-widest mb-12 max-w-md mx-auto">Complete your brand profile to start creating drops.</p>
            <div className="space-y-8 mb-12">
              <div className="text-left space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Brand / Restaurant Name <span className="text-fuchsia-500">*</span></label>
              <input 
                className="w-full bg-zinc-900 border-4 border-black p-6 font-black uppercase italic tracking-tighter text-2xl outline-none focus:border-fuchsia-500 placeholder-zinc-700" 
                placeholder="BRAND / RESTAURANT NAME" 
                value={vendorName} 
                onChange={e => setVendorName(e.target.value)} 
              />
              </div>
              <div className="text-left space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Contact Phone <span className="text-fuchsia-500">*</span></label>
              <input 
                className="w-full bg-zinc-900 border-4 border-black p-6 font-black uppercase italic tracking-tighter text-2xl outline-none focus:border-fuchsia-500 placeholder-zinc-700" 
                placeholder="CONTACT PHONE" 
                value={vendorPhone} 
                onChange={e => setVendorPhone(e.target.value)} 
              />
              </div>
            </div>
            <Button size="xl" onClick={handleRegisterAsVendor} isLoading={isRegistering}>
              Submit for Verification
            </Button>
          </div>
        ) : activeTab === 'BUILD' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
            {/* Build Form Implementation - Same as original but using safe UUIDs and Date Handling */}
            <div className="lg:col-span-8 space-y-16">
               <div className="flex gap-4 mb-20">
                  {[1, 2, 3, 4, 5].map(s => (
                    <div key={s} className={`h-2 flex-1 transition-all rounded-full ${step >= s ? 'shadow-[0_0_15px_rgba(217,70,239,0.5)]' : 'bg-zinc-900'}`} style={{ backgroundColor: step >= s ? formData.accent_color : undefined }} />
                  ))}
               </div>
               
               {/* Steps 1-5 (Content identical to original file, structure preserved) */}
               {/* ... (Omitted for brevity as only logic changed in helper functions) ... */}
               {/* Re-injecting Step 1 for Context/Completeness in XML replacement */}
               {step === 1 && (
                 <div className="space-y-12 animate-in fade-in slide-in-from-left-6">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white border-l-8 pl-8" style={{ borderColor: formData.accent_color }}>Step 1: The Basics</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Drop Name <span className="text-fuchsia-500">*</span></label>
                        <input className="w-full bg-zinc-950 border-4 border-zinc-900 p-6 font-black uppercase italic tracking-tighter text-2xl focus:border-fuchsia-500 outline-none transition-all placeholder-zinc-800" placeholder="e.g. VOLCANO SASHIMI" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Your Brand Name <span className="text-fuchsia-500">*</span></label>
                        <input className="w-full bg-zinc-950 border-4 border-zinc-900 p-6 font-black uppercase italic tracking-tighter text-2xl focus:border-fuchsia-500 outline-none transition-all placeholder-zinc-800" value={formData.chef} onChange={e => setFormData({...formData, chef: e.target.value})} />
                      </div>
                    </div>
                     <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Drop Image <span className="text-fuchsia-500">*</span></label>
                        <input type="file" required accept="image/*" onChange={handleImageChange} className="w-full bg-zinc-950 border-4 border-zinc-900 p-6 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-fuchsia-500 file:text-black hover:file:bg-white" />
                    </div>
                    <div className="space-y-6 pt-6">
                      <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 block">Accent Color</label>
                      <div className="flex flex-wrap gap-4">
                        {BRAND_COLORS.map(color => (
                          <button key={color.value} onClick={() => setFormData({ ...formData, accent_color: color.value })} className={`w-12 h-12 border-4 transition-all ${formData.accent_color === color.value ? 'border-white scale-110' : 'border-black'}`} style={{ backgroundColor: color.value }} />
                        ))}
                      </div>
                    </div>
                    <Button size="xl" onClick={() => setStep(2)}>Next: The Story</Button>
                 </div>
               )}
               {/* steps 2-4 omitted, assuming identical structure. Injecting Step 5/Buttons */}
               {step === 2 && (
                 <div className="space-y-12 animate-in fade-in slide-in-from-left-6">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white border-l-8 pl-8" style={{ borderColor: formData.accent_color }}>Step 2: The Story</h2>
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Short Description <span className="text-fuchsia-500">*</span></label>
                        <textarea rows={4} className="w-full bg-zinc-950 border-4 border-zinc-900 p-6 font-bold text-xl focus:border-fuchsia-500 outline-none resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 block">Marketing Copy <span className="text-fuchsia-500">*</span></label>
                        <textarea rows={5} className="w-full bg-zinc-950 border-4 border-zinc-900 p-6 font-bold text-lg focus:border-fuchsia-500 outline-none resize-none italic" value={formData.hype_story} onChange={e => setFormData({...formData, hype_story: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <Button variant="outline" size="xl" onClick={() => setStep(1)}>Back</Button>
                      <Button size="xl" className="flex-1" onClick={() => setStep(3)}>Next: Build Menu</Button>
                    </div>
                 </div>
               )}
               {step === 3 && (
                 <div className="space-y-12 animate-in fade-in slide-in-from-left-6">
                    <div className="flex justify-between items-center">
                       <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white border-l-8 pl-8" style={{ borderColor: formData.accent_color }}>Step 3: Build Your Menu</h2>
                       <button onClick={addMenuItem} className="bg-white text-black px-6 py-3 font-black uppercase tracking-widest text-[10px] shadow-[4px_4px_0px_0px_#d946ef] transition-all">+ Add Item</button>
                    </div>

                    <div className="space-y-10">
                      {formData.menu_items?.map((item) => (
                        <div key={item.id} className="bg-zinc-950 border-4 border-zinc-900 p-10 space-y-8">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-4">
                               <label className="text-[10px] font-black uppercase text-zinc-600">Item Name</label>
                               <input className="w-full bg-zinc-900 border-2 border-zinc-800 p-4 font-black text-xl" value={item.name} onChange={e => updateMenuItem(item.id, { name: e.target.value })} />
                             </div>
                             <div className="space-y-4">
                               <label className="text-[10px] font-black uppercase text-zinc-600">Base Price ($)</label>
                               <input type="number" className="w-full bg-zinc-900 border-2 border-zinc-800 p-4 font-black text-xl" value={item.basePrice} onChange={e => updateMenuItem(item.id, { basePrice: Number(e.target.value) })} />
                             </div>
                           </div>

                           <div className="space-y-6 pt-4 border-t border-zinc-900">
                              <div className="flex justify-between items-center">
                                 <h4 className="text-[11px] font-black uppercase tracking-widest text-fuchsia-500">Item Options</h4>
                                 <button onClick={() => addModifierGroup(item.id)} className="text-[9px] font-black uppercase tracking-widest bg-zinc-900 px-3 py-2 hover:bg-white hover:text-black transition-colors">+ Add Group</button>
                              </div>

                              <div className="space-y-12">
                                 {item.modifierGroups.map((group) => (
                                   <div key={group.id} className="pl-6 border-l-2 border-zinc-800 space-y-6">
                                      <div className="flex items-center gap-6">
                                         <input className="bg-zinc-900 border border-zinc-800 p-3 font-bold flex-1" placeholder="Group Name (e.g. Toppings)" value={group.name} onChange={e => updateModifierGroup(item.id, group.id, { name: e.target.value })} />
                                         
                                         <div className="flex items-center gap-3 bg-zinc-900 p-2 border border-zinc-800">
                                            <label className="text-[9px] font-black uppercase text-zinc-500 cursor-pointer flex items-center gap-2 select-none">
                                                <input 
                                                    type="checkbox" 
                                                    checked={group.minSelect > 0} 
                                                    onChange={(e) => updateModifierGroup(item.id, group.id, { minSelect: e.target.checked ? 1 : 0 })}
                                                    className="w-4 h-4 accent-fuchsia-500"
                                                />
                                                Required
                                            </label>
                                            
                                            {group.minSelect > 0 && (
                                                 <div className="flex items-center gap-1">
                                                     <label className="text-[8px] font-black text-zinc-600">MIN</label>
                                                     <input 
                                                        type="number" 
                                                        min="1"
                                                        className="w-10 bg-black border border-zinc-700 p-1 text-center text-[10px]" 
                                                        value={group.minSelect} 
                                                        onChange={e => updateModifierGroup(item.id, group.id, { minSelect: Math.max(1, Number(e.target.value)) })} 
                                                     />
                                                 </div>
                                            )}

                                            <div className="w-[1px] h-4 bg-zinc-700 mx-1"></div>

                                            <div className="flex items-center gap-1">
                                                <label className="text-[8px] font-black text-zinc-600">MAX</label>
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    className="w-10 bg-black border border-zinc-700 p-1 text-center text-[10px]" 
                                                    value={group.maxSelect} 
                                                    onChange={e => updateModifierGroup(item.id, group.id, { maxSelect: Number(e.target.value) })} 
                                                />
                                            </div>
                                         </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                         {group.options.map((opt) => (
                                           <div key={opt.id} className="flex gap-2">
                                              <input className="bg-zinc-900 p-3 text-[11px] font-bold flex-1" value={opt.name} onChange={e => updateModifierOption(item.id, group.id, opt.id, { name: e.target.value })} />
                                              <input type="number" className="w-20 bg-zinc-900 p-3 text-[11px] font-black text-fuchsia-500" value={opt.additionalPrice} onChange={e => updateModifierOption(item.id, group.id, opt.id, { additionalPrice: Number(e.target.value) })} />
                                           </div>
                                         ))}
                                         <button onClick={() => addModifierOption(item.id, group.id)} className="border-2 border-dashed border-zinc-800 text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-white py-3">+ Add Option</button>
                                      </div>
                                   </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-6 pt-12">
                      <Button variant="outline" size="xl" onClick={() => setStep(2)}>Back</Button>
                      <Button size="xl" className="flex-1" onClick={() => setStep(4)}>Next: Logistics</Button>
                    </div>
                 </div>
               )}
               {step === 4 && (
                 <div className="space-y-12 animate-in fade-in slide-in-from-left-6">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white border-l-8 pl-8" style={{ borderColor: formData.accent_color }}>Step 4: Logistics</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                         <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Drop Start Time <span className="text-fuchsia-500">*</span></label>
                         <input 
                           type="datetime-local" 
                           className="w-full bg-zinc-950 border-4 border-zinc-900 p-5 font-black text-xl focus:border-fuchsia-500 outline-none" 
                           value={toDateTimeLocal(formData.start_date)} 
                           onChange={e => handleDateChange('start_date', e.target.value)}
                         />
                       </div>
                       <div className="space-y-4">
                         <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Drop End Time <span className="text-fuchsia-500">*</span></label>
                         <input 
                           type="datetime-local" 
                           className="w-full bg-zinc-950 border-4 border-zinc-900 p-5 font-black text-xl focus:border-fuchsia-500 outline-none" 
                           value={toDateTimeLocal(formData.end_date)} 
                           onChange={e => handleDateChange('end_date', e.target.value)}
                         />
                       </div>
                    </div>
                    
                    <div className="space-y-4">
                       <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Total Available Units <span className="text-fuchsia-500">*</span></label>
                       <input type="number" className="w-full bg-zinc-950 border-4 border-zinc-900 p-6 font-black text-2xl focus:border-fuchsia-500 outline-none" value={formData.total_quantity} onChange={e => setFormData({...formData, total_quantity: Number(e.target.value)})} />
                    </div>

                    <div className="bg-zinc-950 border-4 border-zinc-900 p-8 space-y-6">
                      <div className="flex items-center justify-between">
                         <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">Offer Delivery</h3>
                         <div 
                          onClick={() => setFormData({...formData, delivery_available: !formData.delivery_available})}
                          className={`w-14 h-8 flex items-center p-1 cursor-pointer transition-all ${formData.delivery_available ? 'bg-fuchsia-500' : 'bg-zinc-800'}`}
                         >
                            <div className={`w-6 h-6 bg-white transition-all ${formData.delivery_available ? 'translate-x-6' : 'translate-x-0'}`} />
                         </div>
                      </div>
                      {formData.delivery_available && (
                        <div className="animate-in fade-in slide-in-from-top-4">
                          <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Flat Delivery Fee ($)</label>
                          <input type="number" className="w-full bg-zinc-900 border-2 border-zinc-800 p-4 font-black text-xl focus:border-fuchsia-500 outline-none mt-2" value={formData.delivery_fee} onChange={e => setFormData({...formData, delivery_fee: Number(e.target.value)})} />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-8 pt-6 border-t border-zinc-900">
                        <div className="space-y-4">
                            <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Pickup Location Address <span className="text-fuchsia-500">*</span></label>
                            <input className="w-full bg-zinc-950 border-4 border-zinc-900 p-5 font-black text-lg focus:border-fuchsia-500 outline-none" placeholder="123 Example St, City, State" value={formData.logistics?.address} onChange={e => setFormData({ ...formData, logistics: { ...formData.logistics!, address: e.target.value } })} />
                        </div>
                         <div className="space-y-4">
                            <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Pickup Instructions</label>
                            <textarea rows={3} className="w-full bg-zinc-950 border-4 border-zinc-900 p-5 font-bold text-sm focus:border-fuchsia-500 outline-none resize-none" placeholder="e.g. Enter through side door, show order ID." value={formData.logistics?.instructions} onChange={e => setFormData({ ...formData, logistics: { ...formData.logistics!, instructions: e.target.value } })} />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Allergens / Dietary Notes</label>
                            <textarea rows={2} className="w-full bg-zinc-950 border-4 border-zinc-900 p-5 font-bold text-sm focus:border-fuchsia-500 outline-none resize-none" placeholder="e.g. Contains peanuts, dairy, gluten." value={formData.logistics?.allergens} onChange={e => setFormData({ ...formData, logistics: { ...formData.logistics!, allergens: e.target.value } })} />
                        </div>
                    </div>

                    <div className="flex gap-6 pt-8">
                      <Button variant="outline" size="xl" onClick={() => setStep(3)}>Back</Button>
                      <Button size="xl" className="flex-1" onClick={() => setStep(5)}>Next: Final Details</Button>
                    </div>
                 </div>
               )}
               
               {step === 5 && (
                 <div className="space-y-12 animate-in fade-in slide-in-from-left-6">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white border-l-8 pl-8" style={{ borderColor: formData.accent_color }}>Step 5: Final Details</h2>
                    <p className="text-zinc-500 font-bold max-w-xl">Confirm your contact information. This is used for internal purposes and to help customers with their orders.</p>
                    
                    <div className="space-y-8">
                       <div className="space-y-4">
                          <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Contact Email <span className="text-fuchsia-500">*</span></label>
                          <input required type="email" className="w-full bg-zinc-950 border-4 border-zinc-900 p-6 font-black uppercase italic tracking-tighter text-2xl focus:border-fuchsia-500 outline-none" placeholder="CONTACT@YOURBRAND.COM" value={formData.vendor_contact?.email} onChange={e => setFormData({...formData, vendor_contact: { ...formData.vendor_contact!, email: e.target.value }})} />
                       </div>
                       <div className="space-y-4">
                          <label className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">Contact Phone <span className="text-fuchsia-500">*</span></label>
                          <input required type="tel" className="w-full bg-zinc-950 border-4 border-zinc-900 p-6 font-black uppercase italic tracking-tighter text-2xl focus:border-fuchsia-500 outline-none" placeholder="+1 (555) 000-0000" value={formData.vendor_contact?.phone} onChange={e => setFormData({...formData, vendor_contact: { ...formData.vendor_contact!, phone: e.target.value }})} />
                       </div>
                    </div>

                    <div className="p-8 bg-zinc-950 border-4 border-dashed border-zinc-800">
                       <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest block mb-4">Final Step</span>
                       <p className="text-xs text-zinc-500 leading-relaxed italic">By submitting this drop, you agree to our terms of service and confirm that all information is accurate. Your drop will be submitted for a brief review before going live.</p>
                    </div>

                    <div className="flex gap-6 pt-8">
                      <Button variant="outline" size="xl" onClick={() => setStep(4)}>Back</Button>
                      <Button size="xl" className="flex-1 shadow-[12px_12px_0px_0px_#fff]" onClick={handlePublish} disabled={isPublishing}>
                        {isPublishing ? "Submitting..." : "Submit Drop for Review"}
                      </Button>
                    </div>
                 </div>
               )}
            </div>

            <div className="lg:col-span-4 relative">
              <div className="sticky top-40">
                <div className="p-2 border-2 border-dashed border-zinc-800 mb-6">
                  <span className="block text-[10px] font-black uppercase tracking-[0.5em] text-zinc-700 mb-6 text-center">Live Preview</span>
                  <div className="max-w-[340px] mx-auto opacity-90 border-4 border-white rotate-2 shadow-2xl pointer-events-none">
                     <DropCard drop={previewDrop} onClick={() => {}} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
            /* Manifest View Implementation - Preserved */
          <div className="space-y-16 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row gap-12">
               <div className="w-full md:w-1/3 space-y-6">
                  <label className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-500">Your Drops ({myDrops.length})</label>
                  <div className="space-y-4">
                     {myDrops.map(drop => (
                       <div 
                         key={drop.id}
                         onClick={() => setSelectedManifestId(drop.id)}
                         className={`p-6 border-4 cursor-pointer transition-all ${selectedManifestId === drop.id ? 'bg-white text-black border-white' : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:border-fuchsia-500'}`}
                       >
                          <h4 className="font-heading font-black uppercase italic text-xl leading-none mb-2">{drop.name}</h4>
                          <span className="text-[10px] font-black uppercase tracking-widest">{manifestPurchases.filter(p => p.drop_id === drop.id).length} ORDERS</span>
                          <span className={`block mt-2 text-[10px] font-bold uppercase tracking-widest ${
                            drop.approval_status === DropApprovalStatus.APPROVED
                              ? 'text-green-400'
                              : drop.approval_status === DropApprovalStatus.REJECTED
                                ? 'text-red-400'
                                : 'text-yellow-400'
                          }`}>
                            {drop.approval_status}
                          </span>
                          {manifestWaitlist.filter(w => w.drop_id === drop.id).length > 0 && (
                            <span className="block mt-2 text-[10px] font-bold text-fuchsia-500 uppercase tracking-widest">+ {manifestWaitlist.filter(w => w.drop_id === drop.id).length} Waitlisted</span>
                          )}
                       </div>
                     ))}
                  </div>
               </div>

               <div className="flex-1">
                  {selectedDropManifest ? (
                    <div className="bg-zinc-950 border-4 border-zinc-900 p-8 space-y-10">
                       <div className="flex justify-between items-end border-b-2 border-zinc-900 pb-6">
                          <div>
                             <h2 className="font-heading text-4xl font-black italic uppercase mb-2">{selectedDropManifest.name} Orders</h2>
                             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Contact: {selectedDropManifest.vendor_contact.email} / {selectedDropManifest.vendor_contact.phone}</span>
                          </div>
                          <div className="text-right">
                             <span className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Total Revenue</span>
                             <span className="text-3xl font-heading font-black text-fuchsia-500">
                               ${purchasesForSelectedDrop.filter((p) => p.payment_status === 'paid').reduce((acc, curr) => acc + Number(curr.total_paid), 0).toFixed(2)}
                             </span>
                          </div>
                       </div>

                       {/* ORDERS TABLE */}
                       <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                             <tr className="border-b border-zinc-900 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                <th className="py-4">Customer</th>
                                <th className="py-4">Fulfillment</th>
                                <th className="py-4">Payment</th>
                                <th className="py-4">Items</th>
                                <th className="py-4 text-right">Total Paid</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs font-bold uppercase tracking-tight">
                              {purchasesForSelectedDrop.length > 0 ? (
                                purchasesForSelectedDrop.map((p) => (
                                  <tr key={p.id} className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors align-top">
                                    <td className="py-6">
                                       <span className="block font-black">{p.customer_name}</span>
                                       <span className="text-[9px] text-zinc-600 font-black">{p.id}</span>
                                       {p.delivery_requested && <span className="block text-[8px] text-zinc-500 mt-2 max-w-[150px]">{p.delivery_address}</span>}
                                    </td>
                                    <td className="py-6">
                                       <span className={`px-2 py-1 text-[9px] font-black tracking-tighter italic ${p.delivery_requested ? 'bg-fuchsia-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                                          {p.delivery_requested ? 'DELIVERY' : 'PICKUP'}
                                       </span>
                                       {p.is_bulk && (
                                         <span className="ml-2 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/30">
                                           Bulk
                                         </span>
                                       )}
                                    </td>
                                    <td className="py-6">
                                       <span className={`px-2 py-1 text-[9px] font-black tracking-tighter uppercase ${
                                          p.payment_status === 'paid'
                                            ? 'bg-green-500/20 text-green-400'
                                            : p.payment_status === 'refunded'
                                              ? 'bg-orange-500/20 text-orange-400'
                                              : p.payment_status === 'failed'
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'bg-yellow-500/20 text-yellow-300'
                                       }`}>
                                          {p.payment_status || 'pending'}
                                       </span>
                                    </td>
                                    <td className="py-6">
                                       {p.selected_items.map((si, idx) => (
                                         <div key={idx} className="mb-3">
                                            <span className="block font-black text-zinc-300">{si.name} (x{p.quantity})</span>
                                            {si.selectedModifiers.map(sm => (
                                              <div key={sm.groupId} className="pl-3 text-[9px] text-zinc-500 mt-1">
                                                 {sm.groupName}: {sm.options.map(o => o.name).join(', ')}
                                              </div>
                                            ))}
                                         </div>
                                       ))}
                                       {p.order_notes && (
                                         <div className="mt-3 text-[9px] text-zinc-500 normal-case">
                                           <span className="uppercase tracking-widest text-zinc-600">Notes:</span> {p.order_notes}
                                         </div>
                                       )}
                                    </td>
                                    <td className="py-6 text-right text-fuchsia-400 font-black italic text-sm">
                                       ${Number(p.total_paid).toFixed(2)}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="py-32 text-center text-zinc-800 font-black italic tracking-widest">NO ORDERS YET</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                       </div>

                       {/* RETARGETING SECTION */}
                       {waitlistForSelectedDrop.length > 0 && (
                          <div className="mt-12 bg-zinc-900 p-8 border-2 border-zinc-800 animate-in fade-in slide-in-from-bottom-6">
                             <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="font-heading text-2xl font-black italic uppercase text-white mb-1">Interested Parties / Retargeting</h3>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                        {waitlistForSelectedDrop.length} people requested to be notified when this drops again.
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => alert("Retargeting email campaign feature coming soon.")}>
                                    Draft Campaign
                                </Button>
                             </div>
                             
                             <div className="bg-black border border-zinc-800 max-h-[200px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-black z-10">
                                        <tr className="border-b border-zinc-800 text-[9px] font-black uppercase tracking-widest text-zinc-600">
                                            <th className="p-4">Email Address</th>
                                            <th className="p-4">Date Joined</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {waitlistForSelectedDrop.map((entry) => (
                                            <tr key={entry.id} className="border-b border-zinc-900 hover:bg-zinc-900/30">
                                                <td className="p-4 text-xs font-mono text-zinc-300">{entry.email}</td>
                                                <td className="p-4 text-[10px] font-mono text-zinc-500">{new Date(entry.timestamp).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                             </div>
                          </div>
                       )}

                    </div>
                  ) : (
                    <div className="h-full min-h-[400px] flex items-center justify-center border-4 border-dashed border-zinc-900">
                       <p className="text-zinc-800 font-black uppercase tracking-[0.5em] italic">Select a drop to view orders</p>
                    </div>
                  )}
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
