import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Drop } from '../types';
import { sanitizeInput, validateEmail, generateIdempotencyKey } from '../utils/security';

interface BulkOrderModalProps {
  drop: Drop;
  maxQuantity: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerName: string, customerEmail: string, quantity: number, deliveryAddress?: string, notes?: string) => Promise<string>;
  initialQuantity: number;
  onQuantityChange: (value: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  deliveryRequested: boolean;
  totalPrice: number;
}

export const BulkOrderModal: React.FC<BulkOrderModalProps> = ({
  drop,
  maxQuantity,
  isOpen,
  onClose,
  onConfirm,
  initialQuantity,
  onQuantityChange,
  notes,
  onNotesChange,
  deliveryRequested,
  totalPrice,
}) => {
  const [formData, setFormData] = useState({ name: '', email: '', deliveryAddress: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const idempotencyKey = useRef<string>(generateIdempotencyKey());

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setFormData({ name: '', email: '', deliveryAddress: '' });
        setIsProcessing(false);
        setErrorMessage(null);
        idempotencyKey.current = generateIdempotencyKey();
      }, 200);
    }
  }, [isOpen]);

  const validate = () => {
    setErrorMessage(null);
    const safeName = sanitizeInput(formData.name);
    const safeEmail = sanitizeInput(formData.email);
    const safeAddress = sanitizeInput(formData.deliveryAddress);
    const safeNotes = sanitizeInput(notes);

    if (safeName.length < 2) {
      setErrorMessage('Please enter a valid name.');
      return false;
    }
    if (!validateEmail(safeEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    if (deliveryRequested && safeAddress.length < 5) {
      setErrorMessage('Please enter a valid delivery address.');
      return false;
    }
    if (initialQuantity < 1 || initialQuantity > maxQuantity) {
      setErrorMessage(`Quantity must be between 1 and ${maxQuantity}.`);
      return false;
    }

    setFormData({ name: safeName, email: safeEmail, deliveryAddress: safeAddress });
    onNotesChange(safeNotes);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsProcessing(true);
    try {
      await onConfirm(
        formData.name,
        formData.email,
        initialQuantity,
        deliveryRequested ? formData.deliveryAddress : undefined,
        notes
      );
    } catch (error: any) {
      setErrorMessage(error.message || 'Bulk order failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl max-h-[90vh] bg-zinc-950 border-8 border-black relative overflow-hidden shadow-2xl">
        <div className="max-h-[90vh] overflow-y-auto">
        {!isProcessing && (
          <button onClick={onClose} className="absolute top-8 right-8 text-zinc-700 hover:text-white transition-colors z-10 p-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        )}

        <form onSubmit={handleSubmit} className="p-8 md:p-14 space-y-10">
          <div className="space-y-2">
            <h2 className="font-heading text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">Bulk Order</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{drop.name} • {drop.chef}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Name <span className="text-fuchsia-500">*</span></label>
              <input
                required
                className="w-full bg-zinc-900 border-4 border-black p-4 text-white font-black outline-none focus:border-fuchsia-500"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Email <span className="text-fuchsia-500">*</span></label>
              <input
                required
                type="email"
                className="w-full bg-zinc-900 border-4 border-black p-4 text-white font-black outline-none focus:border-fuchsia-500"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Quantity <span className="text-fuchsia-500">*</span></label>
              <input
                type="number"
                min={1}
                max={maxQuantity}
                required
                className="w-full bg-zinc-900 border-4 border-black p-4 text-white font-black outline-none focus:border-fuchsia-500"
                value={initialQuantity}
                onChange={(e) => onQuantityChange(Math.min(maxQuantity, Math.max(1, Number(e.target.value))))}
              />
              <p className="text-[9px] text-zinc-600 font-bold">Max available: {maxQuantity}</p>
            </div>
            {deliveryRequested && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Delivery Address <span className="text-fuchsia-500">*</span></label>
                <input
                  required
                  className="w-full bg-zinc-900 border-4 border-black p-4 text-white font-black outline-none focus:border-fuchsia-500"
                  value={formData.deliveryAddress}
                  onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Order Notes</label>
            <textarea
              rows={4}
              className="w-full bg-zinc-900 border-4 border-black p-4 text-white font-bold outline-none focus:border-fuchsia-500 resize-none"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>

          {errorMessage && (
            <div className="p-4 bg-red-900/20 border-2 border-red-500 text-red-500 font-bold uppercase text-xs tracking-widest text-center">
              {errorMessage}
            </div>
          )}

          <div className="bg-zinc-900 p-6 border-4 border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total</span>
            <span className="text-3xl font-black italic text-white">${totalPrice.toFixed(2)}</span>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <Button size="xl" type="submit" className="w-full" isLoading={isProcessing} disabled={isProcessing}>
              {isProcessing ? 'Redirecting to Stripe...' : 'Pay via Stripe'}
            </Button>
            <Button size="xl" variant="outline" className="w-full" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};
