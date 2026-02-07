
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Drop } from '../types';
import { sanitizeInput, validateEmail, generateIdempotencyKey } from '../utils/security';

interface CheckoutModalProps {
  drop: Drop;
  quantity: number;
  deliveryRequested: boolean;
  totalPrice: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerName: string, customerEmail: string, deliveryAddress?: string) => Promise<string>;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ drop, quantity, deliveryRequested, totalPrice, isOpen, onClose, onConfirm }) => {
  const [step, setStep] = useState<'DETAILS' | 'PAYMENT' | 'SUCCESS'>('DETAILS');
  const [formData, setFormData] = useState({ name: '', email: '', deliveryAddress: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  
  // Idempotency: Ensure we don't process the same "session" twice
  const idempotencyKey = useRef<string>(generateIdempotencyKey());

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('DETAILS');
        setFormData({ name: '', email: '', deliveryAddress: '' });
        setIsProcessing(false);
        setErrorMessage(null);
        setCheckoutUrl(null);
        idempotencyKey.current = generateIdempotencyKey(); // Reset key
      }, 300);
      return;
    };
    
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isProcessing && step !== 'SUCCESS') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, isProcessing, step]);

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
      setStep('PAYMENT');
    }
  };

  const unlockedTier = [...(drop.quantity_tiers || [])].reverse().find(t => quantity >= t.threshold);

  const handlePayment = async () => {
    if (isProcessing) return; // Double-click protection
    setIsProcessing(true);
    setErrorMessage(null);
    
    try {
        // Simulate payment processing via API
        const url = await onConfirm(formData.name, formData.email, deliveryRequested ? formData.deliveryAddress : undefined);
        setCheckoutUrl(url);
        setStep('SUCCESS');
        window.location.assign(url);
    } catch (e: any) {
        console.error("Payment Error:", e);
        setErrorMessage(e.message || "Payment failed. Please try again.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleSuccessClose = () => {
      onClose();
      // Navigate to profile to see the order
      window.location.hash = '/profile';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 backdrop-blur-2xl p-4" role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title">
      <div className="w-full max-w-2xl max-h-[90vh] bg-zinc-950 border-8 border-black relative overflow-hidden shadow-2xl">
        <div className="max-h-[90vh] overflow-y-auto">
        {step !== 'SUCCESS' && !isProcessing && (
          <button onClick={onClose} className="absolute top-8 right-8 text-zinc-700 hover:text-white transition-colors z-10 p-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        )}

        <div className="p-8 md:p-14">
          {step === 'DETAILS' && (
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
              
              <div className="bg-zinc-900 p-8 border-4 border-zinc-800 space-y-4">
                 <div className="flex justify-between text-2xl font-black uppercase italic pt-2">
                    <span className="text-zinc-500">Order Total</span>
                    <span>${totalPrice.toFixed(2)}</span>
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 italic">Includes {quantity} item(s) and all selected options.</p>
              </div>

              <Button size="xl" type="submit" className="w-full bg-fuchsia-500 text-black">Continue to Payment</Button>
            </form>
          )}

          {step === 'PAYMENT' && (
            <div className="space-y-16 text-center py-10">
              <h2 className="font-heading text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">Confirm.</h2>
              <div className="bg-zinc-900 p-8 border-4 border-black">
                 <p className="text-5xl font-black italic tracking-tighter uppercase mb-2">${totalPrice.toFixed(2)}</p>
                 <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500">Total charge</p>
              </div>
              
               {errorMessage && (
                    <div className="p-4 bg-red-900/20 border-2 border-red-500 text-red-500 font-bold uppercase text-xs tracking-widest text-center">
                        {errorMessage}
                    </div>
                )}

              <div className="space-y-4">
                  <Button size="xl" className="w-full" onClick={handlePayment} isLoading={isProcessing} disabled={isProcessing}>
                    {isProcessing ? 'Processing Transaction...' : 'Reserve & Pay'}
                  </Button>
                  {!isProcessing && (
                    <button onClick={() => setStep('DETAILS')} className="text-zinc-500 text-xs font-black uppercase tracking-widest hover:text-white underline decoration-zinc-700">
                        Back to Details
                    </button>
                  )}
              </div>
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="text-center py-12 space-y-10">
               <div className="w-24 h-24 bg-green-500 text-black flex items-center justify-center mx-auto mb-8 shadow-[8px_8px_0px_0px_#fff] transform -rotate-12 animate-in zoom-in duration-300">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M5 13l4 4L19 7"></path></svg>
               </div>
               
               <div className="space-y-4">
                  <h2 className="font-heading text-4xl font-black italic uppercase tracking-tighter text-white leading-none">Reservation Secured.</h2>
                  
                  {checkoutUrl ? (
                    <div className="bg-zinc-900 p-6 border-2 border-fuchsia-500/50">
                        <p className="text-fuchsia-400 font-black uppercase tracking-widest text-xs mb-4">Action Required</p>
                        <p className="text-white text-sm mb-6 max-w-sm mx-auto">Your items are reserved. Please complete payment to finalize your order.</p>
                        <Button 
                            size="xl" 
                            className="w-full bg-fuchsia-500 text-black animate-pulse"
                            onClick={() => window.location.assign(checkoutUrl)}
                        >
                            Pay Now via Stripe
                        </Button>
                    </div>
                  ) : (
                    <p className="text-zinc-500 font-black uppercase tracking-[0.2em] max-w-md mx-auto italic text-center">
                        Your order is confirmed. Please follow the chef's instructions for payment/pickup.
                    </p>
                  )}
                  
                  <div className="space-y-2 flex flex-col items-center pt-4">
                    {deliveryRequested && (
                      <div className="bg-zinc-800 text-zinc-300 p-2 font-black uppercase italic tracking-tighter text-xs transform skew-x-12 inline-block px-4">
                         Delivery Scheduled
                      </div>
                    )}
                    {unlockedTier && (
                      <div className="bg-orange-600 text-black p-4 font-black uppercase italic tracking-tighter text-xl transform -skew-x-12 block mt-2">
                         BONUS UNLOCKED: {unlockedTier.reward}
                      </div>
                    )}
                  </div>
               </div>
               
               <div className="pt-8">
                  <Button size="md" variant="outline" className="w-full border-zinc-700 text-zinc-400 hover:text-white" onClick={handleSuccessClose}>
                      View My Order
                  </Button>
               </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};
