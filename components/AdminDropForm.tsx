
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Drop, DropStatus, DropType } from '../types';
import { toDateTimeLocal } from '../utils';
import * as api from '../services/api';

interface AdminDropFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (drop: Partial<Drop>) => void;
  initialData?: Drop | null;
}

const getInitialState = (initialData?: Drop | null): Partial<Drop> => {
  if (initialData) return { ...initialData };
  
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  return {
    name: '',
    chef: '',
    category: 'BBQ',
    price: 0,
    total_quantity: 100,
    status: DropStatus.UPCOMING,
    type: DropType.PICKUP,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800',
    start_date: oneHourFromNow.toISOString(),
    end_date: twentyFiveHoursFromNow.toISOString(),
    description: '',
    hype_story: '',
    location: '',
    stripe_payment_link: '',
  };
};

export const AdminDropForm: React.FC<AdminDropFormProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<Drop>>(getInitialState(initialData));
  const [priceInput, setPriceInput] = useState('1');
  const [quantityInput, setQuantityInput] = useState('1');

  useEffect(() => {
    setFormData(getInitialState(initialData));
    setPriceInput(String(initialData?.price ?? 1));
    setQuantityInput(String(initialData?.total_quantity ?? 1));
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Sanitize data: Remove fields that shouldn't be manually updated or are heavy
    const { purchases, created_at, ...cleanData } = formData as any;
    onSave(cleanData);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let processedValue: string | number | boolean = value;
    if (type === 'number') {
      processedValue = Number(value);
    } else if (name === 'start_date' || name === 'end_date') {
        if (!value) return; 
        try {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                processedValue = d.toISOString();
            } else {
                return; // Ignore invalid
            }
        } catch (e) {
            return; // Ignore crash
        }
    }
    
    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          // Use the mock API to get a URL (blob)
          const url = await api.uploadImage(file, 'temp-admin-id');
          setFormData(prev => ({ ...prev, image: url }));
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm overflow-y-auto" role="dialog">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 p-8 my-8 relative">
        <h2 className="font-heading text-3xl font-black italic tracking-tight uppercase mb-8">
          {initialData ? 'Edit Drop' : 'Create New Drop'}
        </h2>
        <button onClick={onClose} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Drop Name <span className="text-fuchsia-500">*</span></label>
              <input name="name" value={formData.name} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-800 p-3" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Chef/Brand <span className="text-fuchsia-500">*</span></label>
              <input name="chef" value={formData.chef} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-800 p-3" required />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400">Drop Image <span className="text-fuchsia-500">*</span></label>
            <div className="flex flex-col md:flex-row gap-4 items-start">
               <div className="flex-1 space-y-2 w-full">
                   <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
                   />
                   <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">OR USE URL</span>
                      <input name="image" value={formData.image || ''} onChange={handleChange} className="flex-1 bg-zinc-900 border border-zinc-800 p-2 font-mono text-xs" placeholder="https://..." />
                   </div>
               </div>
               
               {formData.image && (
                 <div className="w-32 h-24 border-2 border-zinc-800 bg-black shrink-0 relative group">
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white">Preview</span>
                    </div>
                 </div>
               )}
            </div>
          </div>
          
          <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Stripe Payment Link (Optional)</label>
              <input name="stripe_payment_link" value={formData.stripe_payment_link || ''} onChange={handleChange} placeholder="https://buy.stripe.com/..." className="w-full bg-zinc-900 border border-zinc-800 p-3 font-mono" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Price</label>
              <input
                name="price"
                type="number"
                min={1}
                step="0.01"
                value={priceInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setPriceInput('');
                    return;
                  }
                  if (!/^\d*\.?\d*$/.test(raw)) return;
                  setPriceInput(raw);
                  const parsed = Number(raw);
                  if (Number.isFinite(parsed)) {
                    handleChange({
                      ...e,
                      target: { ...e.target, value: String(Math.max(1, parsed)) }
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                }}
                onBlur={(e) => {
                  const parsed = Number(priceInput);
                  const safe = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
                  setPriceInput(String(safe));
                  handleChange({
                    ...e,
                    target: { ...e.target, value: String(safe) }
                  } as React.ChangeEvent<HTMLInputElement>);
                }}
                className="w-full bg-zinc-900 border border-zinc-800 p-3"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Total Quantity</label>
              <input
                name="total_quantity"
                type="number"
                min={1}
                value={quantityInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setQuantityInput('');
                    return;
                  }
                  if (!/^\d*$/.test(raw)) return;
                  setQuantityInput(raw);
                  const parsed = parseInt(raw, 10);
                  if (!Number.isNaN(parsed)) {
                    handleChange({
                      ...e,
                      target: { ...e.target, value: String(Math.max(1, parsed)) }
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                }}
                onBlur={(e) => {
                  const parsed = parseInt(quantityInput, 10);
                  const safe = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
                  setQuantityInput(String(safe));
                  handleChange({
                    ...e,
                    target: { ...e.target, value: String(safe) }
                  } as React.ChangeEvent<HTMLInputElement>);
                }}
                className="w-full bg-zinc-900 border border-zinc-800 p-3"
              />
            </div>
             <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-800 p-3">
                <option value={DropStatus.UPCOMING}>Upcoming</option>
                <option value={DropStatus.LIVE}>Live</option>
                <option value={DropStatus.SOLD_OUT}>Sold Out</option>
              </select>
            </div>
             <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Category</label>
              <input name="category" value={formData.category} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-800 p-3" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Start Time</label>
              <input name="start_date" type="datetime-local" value={toDateTimeLocal(formData.start_date)} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-800 p-3" />
            </div>
             <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">End Time</label>
              <input name="end_date" type="datetime-local" value={toDateTimeLocal(formData.end_date)} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-800 p-3" />
            </div>
          </div>

          <div className="pt-6 flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-400">Cancel</Button>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-400 shadow-none">Save Drop</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
