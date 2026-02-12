
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Drop, User } from '../types';
import { sanitizeInput, validateEmail, generateIdempotencyKey } from '../utils/security';

interface CheckoutModalProps {
  drop: Drop;
  quantity: number;
  deliveryRequested: boolean;
  subtotal: number;
  deliveryFee: number;
  bookingFee: number;
  taxAmount: number;
  totalPrice: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerName: string, customerEmail: string, deliveryAddress?: string) => Promise<string>;
  user?: User | null;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ drop, quantity, deliveryRequested, subtotal, deliveryFee, bookingFee, taxAmount, totalPrice, isOpen, onClose, onConfirm, user }) => {
  const [formData, setFormData] = useState({ name: '', email: '', deliveryAddress: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Idempotency: Ensure we don't process the same "session" twice
  const idempotencyKey = useRef<string>(generateIdempotencyKey());

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setFormData({ name: '', email: '', deliveryAddress: '' });
        setIsProcessing(false);
        setErrorMessage(null);
        idempotencyKey.current = generateIdempotencyKey(); // Reset key
      }, 300);
      return;
    };
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email
      }));
    }
    
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, isProcessing, user, deliveryRequested]);

  const validateStepOne = () => {
    setErrorMessage(null);
    const safeName = sanitizeInput(formData.name);
    const safeEmail = sanitizeInput(formData.email);
    const safeAddress = sanitizeInput(formData.deliveryAddress);

    if (safeName.length < 2) {
      setErrorMessage("Please enter a valid name.");
      return false;
    }
    if (!validateEmail(safeEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return false;
    }
    if (deliveryRequested && safeAddress.length < 5) {
      setErrorMessage("Please enter a valid delivery address.");
      return false;
    }

    // Update state with sanitized values
    setFormData({ name: safeName, email: safeEmail, deliveryAddress: safeAddress });
    return true;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStepOne()) {
      handlePayment();
    }
  };

  const handlePayment = async () => {
    if (isProcessing) return; // Double-click protection
    setIsProcessing(true);
    setErrorMessage(null);
    
    try {
        // Simulate payment processing via API
        const url = await onConfirm(formData.name, formData.email, deliveryRequested ? formData.deliveryAddress : undefined);
        window.location.assign(url);
    } catch (e: any) {
        console.error("Payment Error:", e);
        setErrorMessage(e.message || "Payment failed. Please try again.");
    } finally {
        setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 backdrop-blur-2xl p-4" role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title">
      <div className="w-full max-w-2xl max-h-[90vh] bg-zinc-950 border-8 border-black relative overflow-hidden shadow-2xl">
        <div className="max-h-[90vh] overflow-y-auto">
        {!isProcessing && (
          <button onClick={onClose} className="absolute top-8 right-8 text-zinc-700 hover:text-white transition-colors z-10 p-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        )}

        <div className="p-8 md:p-14">
          <form onSubmit={handleNextStep} className="space-y-12">
            <h2 id="checkout-modal-title" className="font-heading text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">Confirm Your Details</h2>
            <div className="space-y-8">
              <div>
                 <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Name <span className="text-fuchsia-500">*</span></label>
                 <input required className="mt-2 w-full bg-zinc-900 border-4 border-black p-6 text-white font-black uppercase italic tracking-tighter text-2xl outline-none focus:border-fuchsia-500 transition-colors" placeholder="YOUR NAME" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Email <span className="text-fuchsia-500">*</span></label>
                 <input required type="email" className="mt-2 w-full bg-zinc-900 border-4 border-black p-6 text-white font-black uppercase italic tracking-tighter text-2xl outline-none focus:border-fuchsia-500 transition-colors" placeholder="YOUR EMAIL" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              
              {deliveryRequested && (
                 <div className="animate-in fade-in slide-in-from-top-4 space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-fuchsia-500">Delivery Address <span className="text-fuchsia-500">*</span></label>
                    <input 
                      required 
                      className="w-full bg-zinc-900 border-4 border-fuchsia-500/30 p-6 text-white font-black uppercase italic tracking-tighter text-2xl outline-none focus:border-fuchsia-500 transition-colors" 
                      placeholder="STREET ADDRESS" 
                      value={formData.deliveryAddress} 
                      onChange={e => setFormData({ ...formData, deliveryAddress: e.target.value })} 
                    />
                 </div>
              )}
              
              {errorMessage && (
                  <div className="p-4 bg-red-900/20 border-2 border-red-500 text-red-500 font-bold uppercase text-xs tracking-widest text-center animate-pulse">
                      {errorMessage}
                  </div>
              )}
            </div>
            
            <div className="bg-zinc-900 p-8 border-4 border-zinc-800 space-y-3">
               <div className="flex justify-between text-sm font-black uppercase tracking-widest text-zinc-500">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
               </div>
               <div className="flex justify-between text-sm font-black uppercase tracking-widest text-zinc-500">
                  <span>Booking Fee</span>
                  <span>${bookingFee.toFixed(2)}</span>
               </div>
               {taxAmount > 0 && (
                 <div className="flex justify-between text-sm font-black uppercase tracking-widest text-zinc-500">
                    <span>Tax</span>
                    <span>${taxAmount.toFixed(2)}</span>
                 </div>
               )}
               {deliveryFee > 0 && (
                 <div className="flex justify-between text-sm font-black uppercase tracking-widest text-zinc-500">
                    <span>Delivery Fee</span>
                    <span>${deliveryFee.toFixed(2)}</span>
                 </div>
               )}
               <div className="flex justify-between text-2xl font-black uppercase italic pt-2">
                  <span className="text-zinc-500">Order Total</span>
                  <span>${totalPrice.toFixed(2)}</span>
               </div>
               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 italic">Includes {quantity} item(s) and all selected options.</p>
            </div>

            <Button size="xl" type="submit" className="w-full bg-fuchsia-500 text-black" isLoading={isProcessing} disabled={isProcessing}>
              {isProcessing ? 'Redirecting...' : 'Reserve & Pay'}
            </Button>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
};
