import React, { useMemo, useState, useEffect } from 'react';
import { Drop, DropApprovalStatus, Profile, Purchase } from '../types';
import { Button } from '../components/Button';
import * as api from '../services/api';

interface AdminDashboardProps {
  allDrops: Drop[];
  onApproveDrop: (dropId: string) => void;
  onRejectDrop: (dropId: string) => void;
  onBack: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  allDrops,
  onApproveDrop,
  onRejectDrop,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'CUSTOMERS' | 'ORDERS' | 'SETTINGS'>('PENDING');
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [bookingFeePerPackage, setBookingFeePerPackage] = useState(0);
  const [bookingFeeInput, setBookingFeeInput] = useState('1');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'CUSTOMERS') return;
    api.getAllProfiles().then(setCustomers).catch((error) => {
      console.error('Failed to load customers', error);
      setCustomers([]);
    });
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'ORDERS') return;
    api.getAllPurchases().then(setAllPurchases).catch((error) => {
      console.error('Failed to load orders', error);
      setAllPurchases([]);
    });
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'SETTINGS') return;
    api.getAppSettings().then((settings) => {
      setBookingFeePerPackage(settings.booking_fee_per_package);
      setBookingFeeInput(String(settings.booking_fee_per_package || 1));
      setSettingsMessage(null);
    }).catch((error) => {
      console.error('Failed to load app settings', error);
      setSettingsMessage('Failed to load settings.');
    });
  }, [activeTab]);

  const pendingDrops = useMemo(
    () => allDrops.filter((drop) => drop.approval_status === DropApprovalStatus.PENDING),
    [allDrops]
  );

  const reviewedDrops = useMemo(
    () =>
      allDrops.filter(
        (drop) =>
          drop.approval_status === DropApprovalStatus.APPROVED ||
          drop.approval_status === DropApprovalStatus.REJECTED
      ),
    [allDrops]
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="bg-zinc-800 text-white p-3 hover:bg-white hover:text-black transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7 7-7"></path></svg>
            </button>
            <div>
              <h1 className="font-heading text-4xl font-black italic uppercase tracking-tighter leading-none">Admin Packages</h1>
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">Approval Queue</p>
            </div>
          </div>

          <div className="flex bg-zinc-900 p-1 border border-zinc-800">
            <button onClick={() => setActiveTab('PENDING')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'PENDING' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Pending</button>
            <button onClick={() => setActiveTab('HISTORY')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'HISTORY' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>History</button>
            <button onClick={() => setActiveTab('ORDERS')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'ORDERS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Orders</button>
            <button onClick={() => setActiveTab('CUSTOMERS')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'CUSTOMERS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Customers</button>
            <button onClick={() => setActiveTab('SETTINGS')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'SETTINGS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Settings</button>
          </div>
        </div>

        {activeTab === 'PENDING' && (
          <div className="space-y-6">
            {pendingDrops.map((drop) => (
              <div key={drop.id} className="bg-zinc-950 border border-zinc-900 p-6 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-3">
                    <div className="aspect-[4/3] w-full overflow-hidden border-2 border-zinc-900 bg-black">
                      <img src={drop.image} alt={drop.name} className="h-full w-full object-cover" />
                    </div>
                  </div>
                  <div className="lg:col-span-6 space-y-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-heading text-2xl font-black italic uppercase tracking-tighter text-white">{drop.name}</h3>
                        <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1">pending</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-800/60 border border-zinc-700 px-2 py-1">{drop.type}</span>
                        {drop.category && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-1">{drop.category}</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-2">{drop.description}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-bold text-zinc-400">
                      <div className="space-y-1">
                        <p className="uppercase tracking-widest text-zinc-600">Vendor</p>
                        <p className="text-zinc-300">{drop.chef}</p>
                        <p className="text-zinc-500">{drop.vendor_contact?.email || '—'}</p>
                        <p className="text-zinc-500">{drop.vendor_contact?.phone || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="uppercase tracking-widest text-zinc-600">Schedule</p>
                        <p className="font-mono text-zinc-300">{new Date(drop.start_date).toLocaleString()}</p>
                        <p className="font-mono text-zinc-300">{new Date(drop.end_date).toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="uppercase tracking-widest text-zinc-600">Inventory</p>
                        <p className="text-zinc-300">{drop.quantity_remaining} remaining</p>
                        <p className="text-zinc-500">{drop.total_quantity} total</p>
                      </div>
                      <div className="space-y-1">
                        <p className="uppercase tracking-widest text-zinc-600">Pricing</p>
                        <p className="text-zinc-300">${Number(drop.price).toFixed(2)}</p>
                        <p className="text-zinc-500">{drop.menu_items?.length || 0} menu items</p>
                      </div>
                    </div>

                    <div className="bg-zinc-900/40 border border-zinc-800 p-4 text-[10px] text-zinc-400 space-y-1">
                      <p className="uppercase tracking-widest text-zinc-500">Pickup Location</p>
                      <p>{drop.logistics?.address || '—'}</p>
                    </div>
                  </div>
                  <div className="lg:col-span-3 flex flex-col justify-between gap-4">
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 text-[10px] text-zinc-400 space-y-2">
                      <p className="uppercase tracking-widest text-zinc-500">Drop ID</p>
                      <p className="font-mono text-zinc-300 break-all">{drop.id}</p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <Button size="sm" className="bg-green-500 hover:bg-green-400 shadow-none" onClick={() => onApproveDrop(drop.id)}>Approve</Button>
                      <Button size="sm" variant="danger" className="shadow-none" onClick={() => onRejectDrop(drop.id)}>Reject</Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {pendingDrops.length === 0 && (
              <div className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest border border-zinc-900 bg-zinc-950">No pending packages</div>
            )}
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-zinc-900">
                <tr>
                  {['Package', 'Vendor', 'Approval', 'Bookable'].map((h) => (
                    <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {reviewedDrops.map((drop) => (
                  <tr key={drop.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="p-4 font-bold">{drop.name}</td>
                    <td className="p-4 text-xs text-zinc-400 uppercase font-bold">{drop.chef}</td>
                    <td className={`p-4 text-xs font-black uppercase ${drop.approval_status === DropApprovalStatus.APPROVED ? 'text-green-400' : 'text-red-400'}`}>{drop.approval_status}</td>
                    <td className="p-4 text-xs text-zinc-500">{drop.approval_status === DropApprovalStatus.APPROVED ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
                {reviewedDrops.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No reviewed packages</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'CUSTOMERS' && (
          <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-zinc-900">
                <tr>
                  {['Name', 'Email', 'Role'].map((h) => (
                    <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="p-4 font-bold text-sm text-white">{c.name}</td>
                    <td className="p-4 text-xs font-mono text-zinc-400">{c.email}</td>
                    <td className="p-4 text-[10px] font-black uppercase">
                      {c.is_admin ? 'Admin' : c.is_vendor ? 'Vendor' : 'Customer'}
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No profiles loaded</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="bg-zinc-950 border border-zinc-900 p-8 max-w-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-6">Booking Fee</h3>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Per Package (USD)</label>
              <input
                type="number"
                min={1}
                step="0.01"
                value={bookingFeeInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setBookingFeeInput('');
                    return;
                  }
                  if (!/^\d*\.?\d*$/.test(raw)) return;
                  setBookingFeeInput(raw);
                  const parsed = Number(raw);
                  if (Number.isFinite(parsed)) {
                    setBookingFeePerPackage(Math.max(1, parsed));
                  }
                }}
                onBlur={() => {
                  const parsed = Number(bookingFeeInput);
                  const safe = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
                  setBookingFeePerPackage(safe);
                  setBookingFeeInput(String(safe));
                }}
                className="w-full bg-black border-2 border-zinc-800 p-4 text-white font-black outline-none focus:border-fuchsia-500"
              />
              {settingsMessage && (
                <p className={`text-[10px] font-black uppercase tracking-widest ${settingsMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                  {settingsMessage}
                </p>
              )}
              <Button
                size="md"
                className="bg-fuchsia-500 text-black shadow-none"
                isLoading={isSavingSettings}
                onClick={async () => {
                  try {
                    setIsSavingSettings(true);
                    setSettingsMessage(null);
                    await api.updateAppSettings({ booking_fee_per_package: bookingFeePerPackage });
                    setSettingsMessage('Settings saved.');
                  } catch (error) {
                    console.error('Failed to update settings', error);
                    setSettingsMessage('Failed to save settings.');
                  } finally {
                    setIsSavingSettings(false);
                  }
                }}
              >
                Save Booking Fee
              </Button>
              <p className="text-[10px] text-zinc-600 font-bold">
                Applies to all orders. Example: 8 quantity = ${ (bookingFeePerPackage * 8).toFixed(2) }.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-zinc-900">
                <tr>
                  {['Drop', 'Customer', 'Quantity', 'Payment', 'Type', 'Notes', 'Total'].map((h) => (
                    <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {allPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-900/50 transition-colors align-top">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={p.drop_image} alt={p.drop_name} className="w-10 h-10 object-cover border border-zinc-800" />
                        <div>
                          <div className="font-bold text-white">{p.drop_name}</div>
                          <div className="text-[9px] font-mono text-zinc-600">{p.drop_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-bold text-zinc-200">{p.customer_name}</div>
                      <div className="text-[9px] font-mono text-zinc-500">{p.customer_email}</div>
                    </td>
                    <td className="p-4 text-xs text-zinc-300">{p.quantity}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-[9px] font-black uppercase ${
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
                    <td className="p-4">
                      {p.is_bulk ? (
                        <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/30 px-2 py-1">Bulk</span>
                      ) : (
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-800/60 border border-zinc-700 px-2 py-1">Standard</span>
                      )}
                    </td>
                    <td className="p-4 text-[10px] text-zinc-400 max-w-[260px]">
                      {p.order_notes || '—'}
                    </td>
                    <td className="p-4 text-right text-fuchsia-400 font-black italic text-sm">
                      ${Number(p.total_paid).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {allPurchases.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No orders yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
