
import React, { useState, useMemo, useEffect } from 'react';
import { Drop, DropStatus, MenuItem, ModifierOption, SelectedItem, User } from '../types';
import { Button } from '../components/Button';
import { CheckoutModal } from '../components/CheckoutModal';
import { Countdown } from '../components/Countdown';
import * as api from '../services/api';

interface DropDetailProps {
  drop: Drop;
  user: User | null;
  bookingFeePerPackage: number;
  onBack: () => void;
  onPurchaseConfirm: (id: string, qty: number, name: string, email: string, delivery: boolean, selections: SelectedItem[], address?: string, orderNotes?: string, isBulk?: boolean) => Promise<string>;
}

export const DropDetail: React.FC<DropDetailProps> = ({ drop, user, bookingFeePerPackage, onBack, onPurchaseConfirm }) => {
  const [qty, setQty] = useState(1);
  const [qtyInput, setQtyInput] = useState('1');
  const [qtyError, setQtyError] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isQuickCheckoutLoading, setIsQuickCheckoutLoading] = useState(false);
  const [deliveryRequested, setDeliveryRequested] = useState(false);
  const [distanceEligibility] = useState<'IDLE' | 'CHECKING' | 'ELIGIBLE' | 'OUT_OF_RANGE' | 'ERROR'>('IDLE');

  useEffect(() => {
    setQtyInput(String(qty));
  }, [qty]);
  
  const [selections, setSelections] = useState<Record<string, Record<string, ModifierOption[]>>>({});

  // Waitlist State
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email || '');
  const [isWaitlistSubmitting, setIsWaitlistSubmitting] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  const now = Date.now();
  const startsAt = new Date(drop.start_date).getTime();
  const endsAt = new Date(drop.end_date).getTime();
  const isSoldOut = drop.status === DropStatus.SOLD_OUT || drop.quantity_remaining === 0;
  const isUpcoming = now < startsAt;
  const isExpired = now > endsAt;
  const accentColor = drop.accent_color || '#d946ef';

  const toggleOption = (itemId: string, groupId: string, option: ModifierOption, maxSelect: number) => {
    setSelections(prev => {
      const itemSels = prev[itemId] || {};
      const groupSels = itemSels[groupId] || [];
      
      let newGroupSels: ModifierOption[];
      if (groupSels.find(o => o.id === option.id)) {
        newGroupSels = groupSels.filter(o => o.id !== option.id);
      } else {
        if (maxSelect === 1) {
          newGroupSels = [option];
        } else if (groupSels.length < maxSelect) {
          newGroupSels = [...groupSels, option];
        } else {
          newGroupSels = groupSels; // Full
        }
      }

      return {
        ...prev,
        [itemId]: {
          ...itemSels,
          [groupId]: newGroupSels
        }
      };
    });
  };

  const unitPrice = useMemo(() => {
    let total = 0;
    drop.menu_items.forEach(item => {
      let itemTotal = item.basePrice;
      const itemSels = selections[item.id] || {};
      (Object.values(itemSels) as ModifierOption[][]).forEach(opts => {
        opts.forEach(o => itemTotal += o.additionalPrice);
      });
      total += itemTotal;
    });
    if (drop.menu_items.length === 0) return Number(drop.price);
    return total;
  }, [drop.menu_items, drop.price, selections]);

  const calculatedSubtotal = useMemo(() => unitPrice * qty, [unitPrice, qty]);
  const deliveryFee = deliveryRequested ? (drop.delivery_fee || 0) : 0;
  const bookingFee = bookingFeePerPackage * qty;
  const taxRate = Number(drop.tax_rate || 0);
  const taxAmount = (calculatedSubtotal + deliveryFee + bookingFee) * taxRate;
  const orderTotal = calculatedSubtotal + deliveryFee + bookingFee + taxAmount;

  const validateSelections = () => {
    for (const item of drop.menu_items) {
      for (const group of item.modifierGroups) {
        const currentSelections = selections[item.id]?.[group.id] || [];
        if (group.minSelect > 0 && currentSelections.length < group.minSelect) {
          alert(`Please select at least ${group.minSelect} option(s) for "${group.name}" in "${item.name}".`);
          return false;
        }
      }
    }
    return true;
  };

  const handlePurchaseClick = () => {
    if (!validateSelections()) return;
    if (qty < 1) {
      setQtyError('Quantity must be at least 1.');
      return;
    }
    if (qty > drop.quantity_remaining) {
      setQtyError(`Only ${drop.quantity_remaining} left in stock.`);
      return;
    }
    setQtyError(null);
    if (user && !deliveryRequested) {
      setIsQuickCheckoutLoading(true);
      handleConfirmCheckout(user.name, user.email)
        .then((url) => window.location.assign(url))
        .catch((error) => {
          console.error("Quick checkout failed:", error);
          alert(error.message || 'Checkout failed.');
        })
        .finally(() => setIsQuickCheckoutLoading(false));
      return;
    }
    setIsCheckoutOpen(true);
  };

  const handleConfirmCheckout = async (name: string, email: string, deliveryAddress?: string): Promise<string> => {
    const finalSelections: SelectedItem[] = drop.menu_items.map(item => ({
      itemId: item.id,
      name: item.name,
      basePrice: item.basePrice,
      selectedModifiers: item.modifierGroups.map(group => ({
        groupId: group.id,
        groupName: group.name,
        options: selections[item.id]?.[group.id] || []
      }))
    }));
    
    return onPurchaseConfirm(drop.id, qty, name, email, deliveryRequested, finalSelections, deliveryAddress);
  };


  const checkDeliveryEligibility = () => {
    setDistanceEligibility('CHECKING');
    if (!navigator.geolocation) {
      setDistanceEligibility('ERROR');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!drop.coordinates) {
          setTimeout(() => { setDistanceEligibility('ELIGIBLE'); setDeliveryRequested(true); }, 1000);
          return;
        }
        setDistanceEligibility('ELIGIBLE');
        setDeliveryRequested(true);
      },
      () => setDistanceEligibility('ERROR')
    );
  };

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!waitlistEmail) return;
    
    setIsWaitlistSubmitting(true);
    try {
        await api.joinWaitlist(drop.id, waitlistEmail, user?.id);
        setWaitlistSuccess(true);
    } catch (e) {
        alert("Could not join waitlist. Try again.");
    } finally {
        setIsWaitlistSubmitting(false);
    }
  };

  const nextTier = drop.quantity_tiers?.find(t => qty < t.threshold) || null;
  const currentTier = [...(drop.quantity_tiers || [])].reverse().find(t => qty >= t.threshold);

  return (
    <div className="min-h-screen bg-[#050505]">
      <button onClick={onBack} className="fixed top-28 left-6 z-50 text-black p-4 hover:bg-white transition-all border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: accentColor }}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M15 19l-7-7 7-7"></path></svg>
      </button>

      <section className="relative h-[50vh] md:h-[65vh] overflow-hidden">
        <img src={drop.image} className="w-full h-full object-cover grayscale-[20%]" alt={drop.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent" />
        <div className="absolute bottom-16 left-0 w-full px-6">
           <div className="max-w-7xl mx-auto">
              <h1 className="font-heading text-5xl md:text-7xl font-black italic tracking-tighter uppercase leading-[0.8] mb-6">{drop.name}</h1>
              <p className="text-2xl md:text-3xl font-heading font-black text-white italic tracking-tighter">By <span className="underline decoration-[4px]" style={{ textDecorationColor: accentColor }}>{drop.chef}</span></p>
           </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-12 gap-20">
        <div className="lg:col-span-7 space-y-20">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] mb-8 flex items-center gap-4" style={{ color: accentColor }}><span className="w-12 h-1" style={{ backgroundColor: accentColor }} /> The Story</h2>
            <p className="text-3xl md:text-4xl font-heading font-black leading-[1] mb-8 italic tracking-tighter uppercase text-zinc-100">"{drop.hype_story}"</p>
            <p className="text-zinc-500 font-bold max-w-2xl leading-relaxed text-sm">{drop.description}</p>
          </div>

          <div className="space-y-10">
             <h3 className="text-xl font-black uppercase italic tracking-tighter border-b-4 pb-4 border-zinc-900 inline-block">The Menu</h3>
             <div className="space-y-12">
                {drop.menu_items.map((item) => (
                  <div key={item.id} className="bg-zinc-950/50 border-l-4 border-zinc-900 pl-6 py-2 space-y-6">
                    <div>
                       <div className="flex justify-between items-end mb-2">
                          <h4 className="text-xl font-black uppercase italic tracking-tighter text-white">{item.name}</h4>
                          <span className="text-zinc-500 font-black text-sm">${item.basePrice} Base</span>
                       </div>
                       <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">{item.description}</p>
                    </div>

                    <div className="space-y-8">
                       {item.modifierGroups.map((group) => (
                         <div key={group.id} className="space-y-3">
                            <div className="flex justify-between items-center">
                               <div className="flex items-center gap-2">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-fuchsia-500">{group.name}</label>
                                  {group.minSelect > 0 ? (
                                      <span className="text-[8px] font-bold uppercase bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded">Required</span>
                                  ) : (
                                      <span className="text-[8px] font-bold uppercase bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">Optional</span>
                                  )}
                               </div>
                               <span className="text-[8px] font-black text-zinc-700 uppercase">
                                  {group.minSelect > 0 ? `Select ${group.minSelect}` : ''} {group.maxSelect > 1 ? (group.minSelect > 0 ? ` - ${group.maxSelect}` : `Max ${group.maxSelect}`) : ''}
                               </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                               {group.options.map((opt) => {
                                 const isSelected = !!selections[item.id]?.[group.id]?.find(o => o.id === opt.id);
                                 return (
                                   <button 
                                    key={opt.id}
                                    onClick={() => toggleOption(item.id, group.id, opt, group.maxSelect)}
                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border-2 transition-all ${
                                      isSelected 
                                        ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                                        : 'bg-transparent text-zinc-600 border-zinc-900 hover:border-zinc-500'
                                    }`}
                                   >
                                      {opt.name} {opt.additionalPrice > 0 && `(+$${opt.additionalPrice})`}
                                   </button>
                                 );
                               })}
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Logistics & Support Section */}
          <div className="bg-zinc-950 border-4 border-zinc-900 p-8 space-y-8">
             <div className="space-y-4">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-fuchsia-500">Pickup & Details</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div>
                      <h4 className="text-white font-black uppercase text-xs mb-2 italic">Pickup Location</h4>
                      <p className="text-zinc-500 text-[11px] font-bold leading-relaxed">{drop.logistics.address}</p>
                   </div>
                   <div>
                      <h4 className="text-white font-black uppercase text-xs mb-2 italic">Contact</h4>
                      <p className="text-zinc-500 text-[11px] font-bold leading-relaxed">{drop.vendor_contact.email}</p>
                      <p className="text-zinc-400 text-[9px] font-black mt-1 uppercase tracking-widest">{drop.vendor_contact.phone}</p>
                   </div>
                </div>
             </div>
             
             <div className="pt-6 border-t border-zinc-900">
                <h4 className="text-white font-black uppercase text-xs mb-3 italic">Pickup Instructions</h4>
                <div className="text-zinc-500 text-[11px] font-bold leading-relaxed space-y-1">
                   {drop.logistics.instructions.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                </div>
             </div>

             <div className="pt-6 border-t border-zinc-900">
                <h4 className="text-red-500 font-black uppercase text-xs mb-3 italic">Allergen Information</h4>
                <p className="text-zinc-500 text-[11px] font-bold leading-relaxed">{drop.logistics.allergens}</p>
             </div>
          </div>
        </div>

        <div className="lg:col-span-5 relative">
          <div className="sticky top-40 bg-white text-black p-8 md:p-10 border-8 border-black shadow-[24px_24px_0px_0px_#00000033]">
            <div className="mb-8 space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Order Total</span>
                <span className="text-6xl font-heading font-black italic tracking-tighter leading-none">${orderTotal.toFixed(2)}</span>
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>${calculatedSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Booking Fee</span>
                  <span>${bookingFee.toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Tax</span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Delivery Fee</span>
                    <span>${deliveryFee.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {drop.quantity_tiers?.length > 0 && !isSoldOut && !isUpcoming && (
                <div className="bg-zinc-100 p-4 border-4 border-black">
                   <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-3">Bonus Rewards</span>
                   {nextTier ? (
                     <div className="space-y-2">
                        <div className="flex justify-between items-end">
                           <span className="text-[10px] font-black uppercase italic">Add {nextTier.threshold - qty} more for a reward</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-300 border-2 border-black">
                           <div className="h-full bg-orange-600 transition-all duration-500" style={{ width: `${(qty / nextTier.threshold) * 100}%` }} />
                        </div>
                     </div>
                   ) : (
                     <div className="text-orange-600 font-black uppercase italic text-xs">MAX REWARDS UNLOCKED: {currentTier?.reward}</div>
                   )}
                </div>
              )}

              {/* UPCOMING STATE - RED AMP LIGHT */}
              {isUpcoming && (
                  <div className="bg-zinc-950 p-8 text-center space-y-6 border-2 border-zinc-900">
                      <div className="flex flex-col items-center gap-6">
                          {/* Amplifier Light - Red */}
                          <div className="relative">
                             <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-600 flex items-center justify-center shadow-lg">
                                <div className="w-6 h-6 rounded-full shadow-[0_0_25px_#ef4444]" style={{ background: 'radial-gradient(circle at 30% 30%, #fca5a5, #ef4444)' }} />
                             </div>
                          </div>
                          
                          <h3 className="text-xl font-black uppercase italic tracking-tighter text-zinc-500">Dropping Soon</h3>
                          <div className="text-4xl md:text-5xl font-mono font-black text-white tracking-widest">
                              <Countdown targetDate={drop.start_date} prefix="" className="text-4xl md:text-5xl" />
                          </div>
                      </div>
                  </div>
              )}

              {/* LIVE STATE - GREEN AMP LIGHT */}
              {!isSoldOut && !isUpcoming && !isExpired && (
                <div className="border-4 border-green-500/20 p-6 bg-zinc-950 relative overflow-hidden">
                   <div className="relative space-y-6">
                      <div className="flex items-center justify-center gap-4 mb-4">
                         {/* Amplifier Light - Green */}
                         <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-600 flex items-center justify-center shadow-lg">
                               <div className="w-4 h-4 rounded-full shadow-[0_0_20px_#22c55e]" style={{ background: 'radial-gradient(circle at 30% 30%, #86efac, #15803d)' }} />
                            </div>
                         </div>
                         <span className="text-green-500 font-black uppercase tracking-[0.3em] text-[10px]">Live Access</span>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 text-center">Fulfillment Method</label>
                        <div className="grid grid-cols-2 bg-zinc-900 border-2 border-zinc-800 p-1 font-black uppercase tracking-widest text-[9px]">
                          <button onClick={() => setDeliveryRequested(false)} className={`py-3 transition-colors ${!deliveryRequested ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'text-zinc-500 hover:text-white'}`}>Pickup</button>
                          <button 
                            disabled
                            onClick={() => distanceEligibility !== 'ELIGIBLE' ? checkDeliveryEligibility() : setDeliveryRequested(true)}
                            className="py-3 transition-colors text-zinc-500 opacity-40 cursor-not-allowed"
                          >
                            Delivery
                          </button>
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center">
                          Delivery disabled
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-2 text-center">Quantity</label>
                        <div className="flex items-center border-4 border-zinc-800 bg-black font-black h-16 text-3xl">
                          <button 
                            onClick={() => {
                              setQtyError(null);
                              setQty(Math.max(1, qty - 1));
                            }} 
                            disabled={qty <= 1}
                            className="w-16 h-full flex items-center justify-center hover:bg-zinc-900 text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={qtyInput}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d]/g, '');
                              setQtyInput(raw);
                              if (raw === '') return;
                              const next = parseInt(raw, 10);
                              if (Number.isNaN(next)) return;
                              setQty(Math.max(1, next));
                              if (next > drop.quantity_remaining) {
                                setQtyError(`Only ${drop.quantity_remaining} left in stock.`);
                              } else {
                                setQtyError(null);
                              }
                            }}
                            onBlur={() => {
                              const normalized = qtyInput.replace(/[^\d]/g, '');
                              if (!normalized) {
                                setQty(1);
                                setQtyError(null);
                                return;
                              }
                              const next = parseInt(normalized, 10);
                              if (Number.isNaN(next) || next < 1) {
                                setQty(1);
                                setQtyError(null);
                                return;
                              }
                              setQty(next);
                              if (next > drop.quantity_remaining) {
                                setQtyError(`Only ${drop.quantity_remaining} left in stock.`);
                              } else {
                                setQtyError(null);
                              }
                            }}
                            className="flex-1 text-center border-x-4 border-zinc-800 h-full w-full text-3xl font-black text-white bg-black outline-none leading-none py-0"
                          />
                          <button 
                            onClick={() => {
                              setQtyError(null);
                              setQty(qty + 1);
                            }} 
                            className="w-16 h-full flex items-center justify-center hover:bg-zinc-900 text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                        {qtyError && (
                          <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-red-500 text-center">
                            {qtyError}
                          </div>
                        )}
                      </div>

                      <div className="bg-zinc-900 border-2 border-zinc-800 p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 space-y-2">
                        <div className="flex items-center justify-between">
                          <span>Subtotal</span>
                          <span className="text-white">${calculatedSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Booking Fee</span>
                          <span className="text-white">${bookingFee.toFixed(2)}</span>
                        </div>
                        {taxAmount > 0 && (
                          <div className="flex items-center justify-between">
                            <span>Tax</span>
                            <span className="text-white">${taxAmount.toFixed(2)}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-white border-t border-zinc-800 pt-2">
                          <span>Total</span>
                          <span>${orderTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <Button
                          size="xl"
                          className="w-full py-6 text-2xl font-black italic shadow-none border-none hover:scale-[1.02] transition-transform"
                          style={{ backgroundColor: accentColor }}
                          onClick={handlePurchaseClick}
                          isLoading={isQuickCheckoutLoading}
                          disabled={isQuickCheckoutLoading}
                        >
                           {isQuickCheckoutLoading ? 'Redirecting...' : 'Reserve & Pay'}
                        </Button>
                      </div>
                   </div>
                </div>
              )}
              
              {/* SOLD OUT STATE & WAITLIST */}
              {(isSoldOut || isExpired) && (
                  <div className="bg-zinc-100 p-8 border-4 border-black text-center space-y-6">
                      <div>
                        <span className="block text-4xl font-black uppercase italic tracking-tighter text-zinc-400 mb-2 line-through decoration-red-500 decoration-4">Sold Out</span>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">This drop has ended.</p>
                      </div>

                      <div className="border-t-2 border-zinc-300 pt-6">
                        {!waitlistSuccess ? (
                            <form onSubmit={handleJoinWaitlist} className="space-y-4">
                                <h3 className="text-xl font-black italic uppercase tracking-tighter text-black">Missed Out?</h3>
                                <p className="text-xs font-bold text-zinc-500">Get notified immediately when {drop.chef} drops again.</p>
                                <div className="flex flex-col gap-2 text-left">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">Email <span className="text-red-500">*</span></label>
                                    <input 
                                        type="email" 
                                        placeholder="YOUR EMAIL" 
                                        required
                                        className="flex-1 bg-white border-2 border-black p-3 font-bold text-sm outline-none focus:bg-fuchsia-50"
                                        value={waitlistEmail}
                                        onChange={(e) => setWaitlistEmail(e.target.value)}
                                        disabled={!!user} // If user is logged in, their email is pre-filled and locked for convenience
                                    />
                                </div>
                                <Button type="submit" size="lg" className="w-full bg-black text-white hover:bg-zinc-800 shadow-none" isLoading={isWaitlistSubmitting}>
                                    Notify Me Next Time
                                </Button>
                            </form>
                        ) : (
                            <div className="bg-green-100 border-2 border-green-500 p-4 animate-in fade-in zoom-in">
                                <span className="text-green-600 font-black uppercase text-xl italic tracking-tighter block mb-1">You're on the list.</span>
                                <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">We'll email you when the next drop goes live.</p>
                            </div>
                        )}
                      </div>
                  </div>
               )}
            </div>
          </div>
        </div>
      </section>

      <CheckoutModal 
        drop={drop} 
        quantity={qty} 
        deliveryRequested={deliveryRequested} 
        subtotal={calculatedSubtotal}
        deliveryFee={deliveryFee}
        bookingFee={bookingFee}
        taxAmount={taxAmount}
        totalPrice={orderTotal}
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        onConfirm={handleConfirmCheckout}
        user={user}
      />

    </div>
  );
};
