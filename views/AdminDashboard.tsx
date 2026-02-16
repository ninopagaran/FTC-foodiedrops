import React, { useMemo, useState, useEffect } from 'react';
import { Drop, DropApprovalStatus, DropStatus, Profile, Purchase } from '../types';
import { Button } from '../components/Button';
import * as api from '../services/api';
import { AdminDropForm } from '../components/AdminDropForm';

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
  const getDropStatusTag = (drop: Drop) => {
    const now = Date.now();
    const starts = new Date(drop.start_date).getTime();
    const ends = new Date(drop.end_date).getTime();
    if (drop.approval_status === DropApprovalStatus.REJECTED) return { label: 'Rejected', cls: 'text-red-400 bg-red-500/10 border-red-500/30' };
    if (drop.approval_status === DropApprovalStatus.PENDING) return { label: 'Pending', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };
    if (drop.approval_status === DropApprovalStatus.APPROVED && now > ends) return { label: 'Completed', cls: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
    if (drop.approval_status === DropApprovalStatus.APPROVED && now >= starts && drop.status === DropStatus.LIVE) return { label: 'Live', cls: 'text-green-400 bg-green-500/10 border-green-500/30' };
    if (drop.approval_status === DropApprovalStatus.APPROVED) return { label: 'Approved', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    return { label: 'Draft', cls: 'text-zinc-400 bg-zinc-800/60 border-zinc-700' };
  };
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY' | 'CUSTOMERS' | 'VENDORS' | 'ORDERS' | 'TRANSACTIONS' | 'EVENTS' | 'SETTINGS'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerRole, setCustomerRole] = useState<'vendor' | 'customer' | 'admin' | ''>('');
  const [customerStatus, setCustomerStatus] = useState<'active' | 'suspended' | ''>('');
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [vendorTotal, setVendorTotal] = useState(0);
  const [vendorPage, setVendorPage] = useState(1);

  const [orders, setOrders] = useState<Purchase[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [orderPage, setOrderPage] = useState(1);
  const [orderSortBy, setOrderSortBy] = useState<'drop_name' | 'customer_name' | 'quantity' | 'payment_status' | 'is_bulk' | 'order_notes' | 'total_paid' | 'timestamp'>('timestamp');
  const [orderSortDir, setOrderSortDir] = useState<'asc' | 'desc'>('desc');
  const [orderDropFilter, setOrderDropFilter] = useState('');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<Purchase['payment_status'] | ''>('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'bulk' | 'standard' | ''>('');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectAllGlobal, setSelectAllGlobal] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState<Profile | null>(null);
  const [customerForm, setCustomerForm] = useState<Partial<Profile>>({});
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState<Profile | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Profile | null>(null);
  const [customerPurchases, setCustomerPurchases] = useState<Purchase[]>([]);
  const [isLoadingCustomerPurchases, setIsLoadingCustomerPurchases] = useState(false);
  const [viewingVendor, setViewingVendor] = useState<Profile | null>(null);
  const [vendorDrops, setVendorDrops] = useState<Drop[]>([]);
  const [vendorDropSortBy, setVendorDropSortBy] = useState<'name' | 'category'>('name');
  const [vendorDropSortDir, setVendorDropSortDir] = useState<'asc' | 'desc'>('asc');
  const [vendorDropStatusFilter, setVendorDropStatusFilter] = useState<DropApprovalStatus | ''>('');
  const [vendorDropCuisineFilter, setVendorDropCuisineFilter] = useState('');
  const [transactions, setTransactions] = useState<Purchase[]>([]);
  const [transactionSortBy, setTransactionSortBy] = useState<'drop_name' | 'customer_name' | 'quantity' | 'payment_status' | 'total_paid' | 'timestamp' | 'drop_date'>('timestamp');
  const [transactionSortDir, setTransactionSortDir] = useState<'asc' | 'desc'>('desc');
  const [transactionDropFilter, setTransactionDropFilter] = useState('');
  const [transactionPaymentFilter, setTransactionPaymentFilter] = useState<Purchase['payment_status'] | ''>('');
  const [transactionDateFrom, setTransactionDateFrom] = useState('');
  const [transactionDateTo, setTransactionDateTo] = useState('');
  const [eventLog, setEventLog] = useState<any[]>([]);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventPage, setEventPage] = useState(1);
  const [eventNameFilter, setEventNameFilter] = useState('');
  const [eventSortBy, setEventSortBy] = useState<'created_at' | 'user_id'>('created_at');
  const [eventSortDir, setEventSortDir] = useState<'asc' | 'desc'>('desc');
  const [eventUserMap, setEventUserMap] = useState<Record<string, Profile>>({});

  const [editingDrop, setEditingDrop] = useState<Drop | null>(null);
  const [showDropEditor, setShowDropEditor] = useState(false);
  const [rejectingDrop, setRejectingDrop] = useState<Drop | null>(null);
  const [rejectMode, setRejectMode] = useState<'reject' | 'revise'>('reject');
  const [rejectReason, setRejectReason] = useState('');

  const [historyPurchases, setHistoryPurchases] = useState<Purchase[]>([]);
  const [selectedHistoryDropId, setSelectedHistoryDropId] = useState<string>('');
  const [bookingFeePerPackage, setBookingFeePerPackage] = useState(0);
  const [bookingFeeInput, setBookingFeeInput] = useState('1');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'CUSTOMERS') return;
    api.getProfilesPaged({
      page: customerPage,
      pageSize: 10,
      search: searchQuery,
      role: customerRole || undefined,
      status: customerStatus || undefined,
      includeDeleted: false
    }).then(({ data, total }) => {
      setCustomers(data);
      setCustomerTotal(total);
    }).catch((error) => {
      console.error('Failed to load customers', error);
      setCustomers([]);
      setCustomerTotal(0);
    });
  }, [activeTab, customerPage, customerRole, customerStatus, searchQuery]);

  useEffect(() => {
    if (activeTab !== 'VENDORS') return;
    api.getProfilesPaged({
      page: vendorPage,
      pageSize: 10,
      search: searchQuery,
      role: 'vendor',
      includeDeleted: false
    }).then(({ data, total }) => {
      setVendors(data);
      setVendorTotal(total);
    }).catch((error) => {
      console.error('Failed to load vendors', error);
      setVendors([]);
      setVendorTotal(0);
    });
  }, [activeTab, vendorPage, searchQuery]);

  useEffect(() => {
    if (activeTab !== 'ORDERS') return;
    api.getPurchasesPaged({
      page: orderPage,
      pageSize: 10,
      search: searchQuery,
      dropId: orderDropFilter || undefined,
      paymentStatus: orderPaymentFilter || undefined,
      orderType: orderTypeFilter || undefined,
      dateFrom: orderDateFrom || undefined,
      dateTo: orderDateTo || undefined,
      includeDeleted: false,
      sortBy: orderSortBy,
      sortDir: orderSortDir
    }).then(({ data, total }) => {
      setOrders(data);
      setOrdersTotal(total);
      if (!selectAllGlobal) setSelectedOrderIds(new Set());
    }).catch((error) => {
      console.error('Failed to load orders', error);
      setOrders([]);
      setOrdersTotal(0);
    });
  }, [activeTab, orderPage, orderDropFilter, orderPaymentFilter, orderTypeFilter, orderDateFrom, orderDateTo, orderSortBy, orderSortDir, searchQuery, selectAllGlobal]);

  useEffect(() => {
    if (activeTab !== 'TRANSACTIONS') return;
    api.getPurchasesForExport({ includeDeleted: false }).then(setTransactions).catch((error) => {
      console.error('Failed to load transactions', error);
      setTransactions([]);
    });
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'EVENTS') return;
    api.getEventLogPaged({
      page: eventPage,
      pageSize: 20,
      eventName: eventNameFilter || undefined,
      sortBy: eventSortBy,
      sortDir: eventSortDir
    }).then(({ data, total }) => {
      setEventLog(data);
      setEventTotal(total);
    }).catch((error) => {
      console.error('Failed to load event log', error);
      setEventLog([]);
      setEventTotal(0);
    });
  }, [activeTab, eventPage, eventNameFilter, eventSortBy, eventSortDir]);

  useEffect(() => {
    if (!eventLog.length) return;
    const ids = Array.from(new Set(eventLog.map((e) => e.user_id).filter(Boolean)));
    const missing = ids.filter((id) => !eventUserMap[id]);
    if (!missing.length) return;
    api.getProfilesByIds(missing).then((profiles) => {
      setEventUserMap((prev) => {
        const next = { ...prev };
        profiles.forEach((p) => {
          next[p.id] = p;
        });
        return next;
      });
    }).catch((error) => {
      console.error('Failed to load event user profiles', error);
    });
  }, [eventLog, eventUserMap]);

  useEffect(() => {
    if (activeTab !== 'HISTORY') return;
    api.getPurchasesForExport({ includeDeleted: false }).then(setHistoryPurchases).catch((error) => {
      console.error('Failed to load history purchases', error);
      setHistoryPurchases([]);
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

  const dropMap = useMemo(() => new Map(allDrops.map((d) => [d.id, d])), [allDrops]);

  const sortedTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = transactions
      .map((p) => ({ ...p, drop: dropMap.get(p.drop_id) }))
      .filter((p) => {
        if (!q) return true;
        return (
          p.drop_name?.toLowerCase().includes(q) ||
          p.customer_name?.toLowerCase().includes(q) ||
          p.customer_email?.toLowerCase().includes(q)
        );
      })
      .filter((p) => !transactionDropFilter || p.drop_id === transactionDropFilter)
      .filter((p) => !transactionPaymentFilter || p.payment_status === transactionPaymentFilter)
      .filter((p) => {
        if (!transactionDateFrom && !transactionDateTo) return true;
        const ts = new Date(p.timestamp).getTime();
        if (transactionDateFrom) {
          const from = new Date(transactionDateFrom).getTime();
          if (ts < from) return false;
        }
        if (transactionDateTo) {
          const to = new Date(transactionDateTo).getTime() + 24 * 60 * 60 * 1000 - 1;
          if (ts > to) return false;
        }
        return true;
      });

    const dir = transactionSortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      const av = (() => {
        switch (transactionSortBy) {
          case 'drop_name': return a.drop_name || '';
          case 'customer_name': return a.customer_name || '';
          case 'quantity': return a.quantity;
          case 'payment_status': return a.payment_status || '';
          case 'total_paid': return Number(a.total_paid || 0);
          case 'drop_date': return new Date(a.drop?.start_date || a.timestamp).getTime();
          default: return new Date(a.timestamp).getTime();
        }
      })();
      const bv = (() => {
        switch (transactionSortBy) {
          case 'drop_name': return b.drop_name || '';
          case 'customer_name': return b.customer_name || '';
          case 'quantity': return b.quantity;
          case 'payment_status': return b.payment_status || '';
          case 'total_paid': return Number(b.total_paid || 0);
          case 'drop_date': return new Date(b.drop?.start_date || b.timestamp).getTime();
          default: return new Date(b.timestamp).getTime();
        }
      })();

      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [
    transactions,
    searchQuery,
    dropMap,
    transactionSortBy,
    transactionSortDir,
    transactionDropFilter,
    transactionPaymentFilter,
    transactionDateFrom,
    transactionDateTo
  ]);

  const { upcomingTransactions, previousTransactions } = useMemo(() => {
    const now = Date.now();
    const upcoming = [] as any[];
    const previous = [] as any[];
    sortedTransactions.forEach((p) => {
      const end = p.drop?.end_date ? new Date(p.drop.end_date).getTime() : 0;
      if (end && end < now) previous.push(p);
      else upcoming.push(p);
    });
    return { upcomingTransactions: upcoming, previousTransactions: previous };
  }, [sortedTransactions]);

  const eventOptions = useMemo(() => {
    const known = ['drop_click', 'reserve_pay_click', 'signup_customer', 'signup_vendor', 'drop_created', 'drop_deleted'];
    const fromData = eventLog.map((e) => e.event_name).filter(Boolean);
    return Array.from(new Set([...known, ...fromData]));
  }, [eventLog]);

  const pendingDrops = useMemo(
    () => {
      const list = allDrops.filter((drop) => drop.approval_status === DropApprovalStatus.PENDING);
      if (!searchQuery) return list;
      const q = searchQuery.toLowerCase();
      return list.filter(d => d.name.toLowerCase().includes(q) || d.chef.toLowerCase().includes(q));
    },
    [allDrops, searchQuery]
  );

  const reviewedDrops = useMemo(
    () => {
      const list = allDrops.filter(
        (drop) =>
          drop.approval_status === DropApprovalStatus.APPROVED ||
          drop.approval_status === DropApprovalStatus.REJECTED
      );
      if (!searchQuery) return list;
      const q = searchQuery.toLowerCase();
      return list.filter(d => d.name.toLowerCase().includes(q) || d.chef.toLowerCase().includes(q));
    },
    [allDrops, searchQuery]
  );

  useEffect(() => {
    if (!selectedHistoryDropId && reviewedDrops.length > 0) {
      setSelectedHistoryDropId(reviewedDrops[0].id);
    }
  }, [reviewedDrops, selectedHistoryDropId]);

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

          <div className="flex bg-zinc-900 p-1 border border-zinc-800 overflow-x-auto no-scrollbar whitespace-nowrap">
            <button onClick={() => setActiveTab('PENDING')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'PENDING' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Pending</button>
            <button onClick={() => setActiveTab('HISTORY')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'HISTORY' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Package History</button>
            <button onClick={() => setActiveTab('ORDERS')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'ORDERS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Orders</button>
            <button onClick={() => setActiveTab('CUSTOMERS')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'CUSTOMERS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Customers</button>
            <button onClick={() => setActiveTab('VENDORS')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'VENDORS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Vendors</button>
            <button onClick={() => setActiveTab('TRANSACTIONS')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'TRANSACTIONS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Transactions</button>
            <button onClick={() => setActiveTab('EVENTS')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'EVENTS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Event Log</button>
            <button onClick={() => setActiveTab('SETTINGS')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab === 'SETTINGS' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Settings</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <input
            className="w-full md:w-96 bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm font-bold text-white outline-none focus:border-fuchsia-500"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-black">
            {activeTab === 'CUSTOMERS' && `${customerTotal} customers`}
            {activeTab === 'VENDORS' && `${vendorTotal} vendors`}
            {activeTab === 'ORDERS' && `${ordersTotal} orders`}
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
                        {(() => {
                          const tag = getDropStatusTag(drop);
                          return (
                            <span className={`text-[9px] font-black uppercase tracking-widest border px-2 py-1 ${tag.cls}`}>
                              {tag.label}
                            </span>
                          );
                        })()}
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
                      <Button size="sm" className="bg-green-500 hover:bg-green-400 shadow-none" onClick={async () => {
                        try {
                          await api.adminUpdateDrop(drop.id, { approval_status: DropApprovalStatus.APPROVED, rejection_reason: null, revision_requested: false });
                          await api.insertAuditLog({ action: 'approve_drop', entity_type: 'drop', entity_id: drop.id });
                          onApproveDrop(drop.id);
                        } catch (e) {
                          console.error('Approve failed', e);
                          alert('Approve failed.');
                        }
                      }}>Approve</Button>
                      <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300" onClick={() => {
                        setEditingDrop(drop);
                        setShowDropEditor(true);
                      }}>Edit</Button>
                      <Button size="sm" variant="danger" className="shadow-none" onClick={() => {
                        setRejectingDrop(drop);
                        setRejectMode('reject');
                        setRejectReason('');
                      }}>Reject</Button>
                      <Button size="sm" className="bg-yellow-500 text-black shadow-none" onClick={() => {
                        setRejectingDrop(drop);
                        setRejectMode('revise');
                        setRejectReason('');
                      }}>Send Back</Button>
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
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <select className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest" value={selectedHistoryDropId} onChange={(e) => setSelectedHistoryDropId(e.target.value)}>
                {reviewedDrops.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {selectedHistoryDropId && (() => {
              const drop = reviewedDrops.find(d => d.id === selectedHistoryDropId);
              if (!drop) return null;
              const paid = historyPurchases.filter(p => p.drop_id === drop.id && p.payment_status === 'paid' && !p.is_deleted);
              const totalSold = paid.reduce((sum, p) => sum + p.quantity, 0);
              const revenue = paid.reduce((sum, p) => sum + Number(p.total_paid || 0), 0);
              const conversion = drop.total_quantity ? (totalSold / drop.total_quantity) * 100 : 0;
              return (
                <div className="bg-zinc-950 border border-zinc-900 p-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <div>
                    <div className="text-zinc-400">Drop Name</div>
                    <div className="text-white text-sm">{drop.name}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Total Units Sold</div>
                    <div className="text-white text-sm">{totalSold}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Total Revenue</div>
                    <div className="text-white text-sm">${revenue.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Conversion %</div>
                    <div className="text-white text-sm">{conversion.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-zinc-400">Inventory Remaining</div>
                    <div className="text-white text-sm">{drop.quantity_remaining}</div>
                  </div>
                </div>
              );
            })()}

            <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-zinc-900">
                  <tr>
                    {['Drop Name', 'Menu', 'Total Sold', 'Revenue', 'Drop Date', 'Status', 'Edit'].map((h) => (
                      <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {reviewedDrops.map((drop) => {
                    const paid = historyPurchases.filter(p => p.drop_id === drop.id && p.payment_status === 'paid' && !p.is_deleted);
                    const totalSold = paid.reduce((sum, p) => sum + p.quantity, 0);
                    const revenue = paid.reduce((sum, p) => sum + Number(p.total_paid || 0), 0);
                    const isEditable = drop.approval_status === DropApprovalStatus.PENDING;
                    return (
                      <tr key={drop.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-4 font-bold">{drop.name}</td>
                        <td className="p-4 text-xs text-zinc-400">
                          <div className="relative group inline-block">
                            <span className="underline decoration-dashed cursor-help">Hover</span>
                            <div className="absolute left-0 top-6 z-50 hidden group-hover:block bg-black border border-zinc-700 p-3 text-[10px] text-zinc-300 max-h-40 w-64 overflow-y-auto">
                              {(drop.menu_items || []).length > 0
                                ? (drop.menu_items || []).map(m => (
                                    <div key={m.id} className="mb-2">
                                      <div className="font-bold text-white">{m.name}</div>
                                      <div>${m.basePrice}</div>
                                      {m.modifierGroups?.map(g => (
                                        <div key={g.id} className="pl-2 text-zinc-400">
                                          {g.name}: {g.options?.map(o => o.name).join(', ')}
                                        </div>
                                      ))}
                                    </div>
                                  ))
                                : <div>No menu</div>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-zinc-300">{totalSold}</td>
                        <td className="p-4 text-xs text-zinc-300">${revenue.toFixed(2)}</td>
                        <td className="p-4 text-xs text-zinc-400">{new Date(drop.start_date).toLocaleDateString()}</td>
                        <td className="p-4 text-xs font-black uppercase">
                          {(() => {
                            const tag = getDropStatusTag(drop);
                            return <span className={`${tag.cls} border px-2 py-1`}>{tag.label}</span>;
                          })()}
                        </td>
                        <td className="p-4 text-xs">
                          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" disabled={!isEditable} onClick={() => { setEditingDrop(drop); setShowDropEditor(true); }}>
                            {isEditable ? 'Edit' : 'Locked'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {reviewedDrops.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No reviewed packages</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'CUSTOMERS' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <select
                className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                value={customerRole}
                onChange={(e) => { setCustomerRole(e.target.value as any); setCustomerPage(1); }}
              >
                <option value="">All Roles</option>
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
                <option value="admin">Admin</option>
              </select>
              <select
                className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                value={customerStatus}
                onChange={(e) => { setCustomerStatus(e.target.value as any); setCustomerPage(1); }}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-zinc-900">
                  <tr>
                    {['Name', 'Email', 'Phone', 'Company', 'Role', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="p-4 font-bold text-sm text-white">{c.name}</td>
                      <td className="p-4 text-xs font-mono text-zinc-400">{c.email}</td>
                      <td className="p-4 text-xs text-zinc-400">{c.phone || '—'}</td>
                      <td className="p-4 text-xs text-zinc-400">{c.company || '—'}</td>
                      <td className="p-4 text-[10px] font-black uppercase">
                        {c.is_admin ? 'Admin' : c.is_vendor ? 'Vendor' : 'Customer'}
                      </td>
                      <td className="p-4 text-[10px] font-black uppercase">
                        <span className={c.status === 'suspended' ? 'text-red-400' : 'text-green-400'}>
                          {c.status || 'active'}
                        </span>
                      </td>
                      <td className="p-4 text-[10px] font-black uppercase space-x-2">
                        <button
                          className="text-blue-400 hover:text-white"
                          onClick={async () => {
                            setViewingCustomer(c);
                            setIsLoadingCustomerPurchases(true);
                            try {
                              const data = await api.getPurchasesByUser(c.id);
                              const sorted = [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                              setCustomerPurchases(sorted);
                            } catch (e) {
                              console.error('Failed to load customer purchases', e);
                              setCustomerPurchases([]);
                            } finally {
                              setIsLoadingCustomerPurchases(false);
                            }
                          }}
                        >
                          View
                        </button>
                        <button
                          className="text-fuchsia-400 hover:text-white"
                          onClick={() => {
                            setEditingCustomer(c);
                            setCustomerForm(c);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-red-400 hover:text-white"
                          onClick={() => setConfirmDeleteCustomer(c)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No profiles loaded</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <span>Page {customerPage}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setCustomerPage(Math.max(1, customerPage - 1))}>Prev</Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setCustomerPage(customerPage + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'VENDORS' && (
          <div className="space-y-4">
            <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-zinc-900">
                  <tr>
                    {['Name', 'Email', 'Phone', 'Company', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="p-4 font-bold text-sm text-white">{v.name}</td>
                      <td className="p-4 text-xs font-mono text-zinc-400">{v.email}</td>
                      <td className="p-4 text-xs text-zinc-400">{v.phone || '—'}</td>
                      <td className="p-4 text-xs text-zinc-400">{v.company || '—'}</td>
                      <td className="p-4 text-[10px] font-black uppercase">
                        <span className={v.status === 'suspended' ? 'text-red-400' : 'text-green-400'}>
                          {v.status || 'active'}
                        </span>
                      </td>
                      <td className="p-4 text-[10px] font-black uppercase space-x-2">
                        <button
                          className="text-blue-400 hover:text-white"
                          onClick={async () => {
                            setViewingVendor(v);
                            try {
                              const drops = await api.getVendorDrops(v.id);
                              setVendorDrops(drops);
                            } catch (e) {
                              console.error('Failed to load vendor drops', e);
                              setVendorDrops([]);
                            }
                          }}
                        >
                          View
                        </button>
                        <button
                          className="text-fuchsia-400 hover:text-white"
                          onClick={() => {
                            setEditingCustomer(v);
                            setCustomerForm(v);
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {vendors.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No vendors found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <span>Page {vendorPage}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setVendorPage(Math.max(1, vendorPage - 1))}>Prev</Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setVendorPage(vendorPage + 1)}>Next</Button>
              </div>
            </div>
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
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <select className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest" value={orderDropFilter} onChange={(e) => { setOrderDropFilter(e.target.value); setOrderPage(1); }}>
                <option value="">All Drops</option>
                {allDrops.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest" value={orderPaymentFilter} onChange={(e) => { setOrderPaymentFilter(e.target.value as any); setOrderPage(1); }}>
                <option value="">All Payments</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
              </select>
              <select className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest" value={orderTypeFilter} onChange={(e) => { setOrderTypeFilter(e.target.value as any); setOrderPage(1); }}>
                <option value="">All Types</option>
                <option value="standard">Standard</option>
                <option value="bulk">Bulk</option>
              </select>
              <input type="date" className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest" value={orderDateFrom} onChange={(e) => { setOrderDateFrom(e.target.value); setOrderPage(1); }} />
              <input type="date" className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest" value={orderDateTo} onChange={(e) => { setOrderDateTo(e.target.value); setOrderPage(1); }} />
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <Button size="sm" className="bg-zinc-800 text-white" onClick={async () => {
                if (selectAllGlobal) {
                  setSelectedOrderIds(new Set());
                  setSelectAllGlobal(false);
                  return;
                }
                const all = await api.getPurchasesForExport({
                  search: searchQuery,
                  dropId: orderDropFilter || undefined,
                  paymentStatus: orderPaymentFilter || undefined,
                  orderType: orderTypeFilter || undefined,
                  dateFrom: orderDateFrom || undefined,
                  dateTo: orderDateTo || undefined,
                  includeDeleted: false
                });
                setSelectedOrderIds(new Set(all.map(o => o.id)));
                setSelectAllGlobal(true);
              }}>
                {selectAllGlobal ? 'Clear Global' : 'Select All (Global)'}
              </Button>
              <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => {
                const next = new Set(selectedOrderIds);
                orders.forEach((o) => {
                  if (next.has(o.id)) next.delete(o.id);
                  else next.add(o.id);
                });
                setSelectedOrderIds(next);
              }}>Select Page</Button>
              <Button size="sm" className="bg-fuchsia-500 text-black" onClick={async () => {
                const ids = Array.from(selectedOrderIds);
                if (!ids.length) return;
                await api.updatePurchaseStatusBulk(ids, 'paid');
                await api.insertAuditLog({ action: 'mark_paid', entity_type: 'purchase', payload: { ids } });
                setOrderPage(1);
              }}>Mark Paid</Button>
              <Button size="sm" className="bg-orange-500 text-black" onClick={async () => {
                const ids = Array.from(selectedOrderIds);
                if (!ids.length) return;
                await api.updatePurchaseStatusBulk(ids, 'refunded');
                await api.insertAuditLog({ action: 'mark_refunded', entity_type: 'purchase', payload: { ids } });
                setOrderPage(1);
              }}>Mark Refunded</Button>
              <Button size="sm" variant="danger" className="shadow-none" onClick={async () => {
                const ids = Array.from(selectedOrderIds);
                if (!ids.length) return;
                await api.softDeletePurchases(ids);
                await api.insertAuditLog({ action: 'delete_orders', entity_type: 'purchase', payload: { ids } });
                setSelectedOrderIds(new Set());
                setSelectAllGlobal(false);
                setOrderPage(1);
              }}>Delete</Button>
              <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={async () => {
                const data = selectAllGlobal
                  ? await api.getPurchasesForExport({ search: searchQuery, dropId: orderDropFilter || undefined, paymentStatus: orderPaymentFilter || undefined, orderType: orderTypeFilter || undefined, dateFrom: orderDateFrom || undefined, dateTo: orderDateTo || undefined, includeDeleted: false })
                  : orders.filter(o => selectedOrderIds.has(o.id));
                const rows = data.map((p) => ({
                  Drop: p.drop_name,
                  Customer: p.customer_name,
                  Quantity: p.quantity,
                  Payment: p.payment_status,
                  Type: p.is_bulk ? 'Bulk' : 'Standard',
                  Notes: p.order_notes || '',
                  StripeFee: Number(p.stripe_fee_amount || 0).toFixed(2),
                  Total: Number(p.total_paid).toFixed(2),
                  Date: new Date(p.timestamp).toISOString(),
                  Status: p.payment_status
                }));
                const csv = [
                  Object.keys(rows[0] || {}).join(','),
                  ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `orders_${Date.now()}.csv`;
                link.click();
              }}>Export CSV</Button>
              <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={async () => {
                const data = selectAllGlobal
                  ? await api.getPurchasesForExport({ search: searchQuery, dropId: orderDropFilter || undefined, paymentStatus: orderPaymentFilter || undefined, orderType: orderTypeFilter || undefined, dateFrom: orderDateFrom || undefined, dateTo: orderDateTo || undefined, includeDeleted: false })
                  : orders.filter(o => selectedOrderIds.has(o.id));
                const rows = data.map((p) => ({
                  Drop: p.drop_name,
                  Customer: p.customer_name,
                  Quantity: p.quantity,
                  Payment: p.payment_status,
                  Type: p.is_bulk ? 'Bulk' : 'Standard',
                  Notes: p.order_notes || '',
                  StripeFee: Number(p.stripe_fee_amount || 0).toFixed(2),
                  Total: Number(p.total_paid).toFixed(2),
                  Date: new Date(p.timestamp).toISOString(),
                  Status: p.payment_status
                }));
                // @ts-ignore
                const XLSX = await import('https://esm.sh/xlsx@0.18.5');
                const worksheet = XLSX.utils.json_to_sheet(rows);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
                XLSX.writeFile(workbook, `orders_${Date.now()}.xlsx`);
              }}>Export XLSX</Button>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-zinc-900">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      <input type="checkbox" checked={orders.length > 0 && orders.every(o => selectedOrderIds.has(o.id))} onChange={() => {
                        const next = new Set(selectedOrderIds);
                        if (orders.every(o => next.has(o.id))) {
                          orders.forEach(o => next.delete(o.id));
                        } else {
                          orders.forEach(o => next.add(o.id));
                        }
                        setSelectedOrderIds(next);
                      }} />
                    </th>
                    {[
                      { key: 'drop_name', label: 'Drop' },
                      { key: 'customer_name', label: 'Customer' },
                      { key: 'quantity', label: 'Quantity' },
                      { key: 'payment_status', label: 'Payment' },
                      { key: 'is_bulk', label: 'Type' },
                      { key: 'order_notes', label: 'Notes' },
                      { key: 'total_paid', label: 'Total' },
                      { key: 'timestamp', label: 'Date' }
                    ].map((h) => (
                      <th
                        key={h.key}
                        className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 cursor-pointer"
                        onClick={() => {
                          setOrderSortBy(h.key as any);
                          setOrderSortDir(orderSortDir === 'asc' ? 'desc' : 'asc');
                        }}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {orders.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-900/50 transition-colors align-top">
                      <td className="p-4">
                        <input type="checkbox" checked={selectedOrderIds.has(p.id)} onChange={() => {
                          const next = new Set(selectedOrderIds);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          setSelectedOrderIds(next);
                        }} />
                      </td>
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
                      <td className="p-4 text-[10px] text-zinc-500">
                        {new Date(p.timestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No orders yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <span>Page {orderPage}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setOrderPage(Math.max(1, orderPage - 1))}>Prev</Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setOrderPage(orderPage + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'TRANSACTIONS' && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <select
                className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                value={transactionDropFilter}
                onChange={(e) => setTransactionDropFilter(e.target.value)}
              >
                <option value="">All Drops</option>
                {allDrops.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select
                className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                value={transactionPaymentFilter}
                onChange={(e) => setTransactionPaymentFilter(e.target.value as any)}
              >
                <option value="">All Payments</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
              </select>
              <input
                type="date"
                className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                value={transactionDateFrom}
                onChange={(e) => setTransactionDateFrom(e.target.value)}
              />
              <input
                type="date"
                className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                value={transactionDateTo}
                onChange={(e) => setTransactionDateTo(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <span>Sort:</span>
              {[
                { key: 'timestamp', label: 'Order Date' },
                { key: 'drop_date', label: 'Drop Date' },
                { key: 'drop_name', label: 'Drop' },
                { key: 'customer_name', label: 'Customer' },
                { key: 'total_paid', label: 'Total' }
              ].map((opt) => (
                <button
                  key={opt.key}
                  className={transactionSortBy === opt.key ? 'text-white' : 'text-zinc-500'}
                  onClick={() => {
                    setTransactionSortBy(opt.key as any);
                    setTransactionSortDir(transactionSortDir === 'asc' ? 'desc' : 'asc');
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={async () => {
                const rows = sortedTransactions.map((p) => ({
                  Drop: p.drop_name,
                  Customer: p.customer_name,
                  Quantity: p.quantity,
                  Payment: p.payment_status,
                  Type: p.is_bulk ? 'Bulk' : 'Standard',
                  Notes: p.order_notes || '',
                  StripeFee: Number(p.stripe_fee_amount || 0).toFixed(2),
                  Total: Number(p.total_paid).toFixed(2),
                  DropDate: p.drop?.start_date ? new Date(p.drop.start_date).toISOString() : '',
                  OrderDate: new Date(p.timestamp).toISOString(),
                  Status: p.payment_status
                }));
                const csv = [
                  Object.keys(rows[0] || {}).join(','),
                  ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `transactions_${Date.now()}.csv`;
                link.click();
              }}>
                Export CSV
              </Button>
              <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={async () => {
                const rows = sortedTransactions.map((p) => ({
                  Drop: p.drop_name,
                  Customer: p.customer_name,
                  Quantity: p.quantity,
                  Payment: p.payment_status,
                  Type: p.is_bulk ? 'Bulk' : 'Standard',
                  Notes: p.order_notes || '',
                  StripeFee: Number(p.stripe_fee_amount || 0).toFixed(2),
                  Total: Number(p.total_paid).toFixed(2),
                  DropDate: p.drop?.start_date ? new Date(p.drop.start_date).toISOString() : '',
                  OrderDate: new Date(p.timestamp).toISOString(),
                  Status: p.payment_status
                }));
                // @ts-ignore
                const XLSX = await import('https://esm.sh/xlsx@0.18.5');
                const worksheet = XLSX.utils.json_to_sheet(rows);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
                XLSX.writeFile(workbook, `transactions_${Date.now()}.xlsx`);
              }}>
                Export XLSX
              </Button>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Upcoming + Live</h3>
              <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-zinc-900">
                    <tr>
                      {['Drop', 'Customer', 'Qty', 'Payment', 'Total', 'Drop Date', 'Order Date'].map((h) => (
                        <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {upcomingTransactions.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white">{p.drop_name}</div>
                          <div className="text-[9px] font-mono text-zinc-600">{p.drop_id}</div>
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
                        <td className="p-4 text-right text-fuchsia-400 font-black italic text-sm">
                          ${Number(p.total_paid).toFixed(2)}
                        </td>
                        <td className="p-4 text-[10px] text-zinc-500">
                          {p.drop?.start_date ? new Date(p.drop.start_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-4 text-[10px] text-zinc-500">
                          {new Date(p.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {upcomingTransactions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No upcoming transactions</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Previous</h3>
              <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-zinc-900">
                    <tr>
                      {['Drop', 'Customer', 'Qty', 'Payment', 'Total', 'Drop Date', 'Order Date'].map((h) => (
                        <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {previousTransactions.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white">{p.drop_name}</div>
                          <div className="text-[9px] font-mono text-zinc-600">{p.drop_id}</div>
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
                        <td className="p-4 text-right text-fuchsia-400 font-black italic text-sm">
                          ${Number(p.total_paid).toFixed(2)}
                        </td>
                        <td className="p-4 text-[10px] text-zinc-500">
                          {p.drop?.start_date ? new Date(p.drop.start_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-4 text-[10px] text-zinc-500">
                          {new Date(p.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {previousTransactions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No previous transactions</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'EVENTS' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select
                className="bg-zinc-950 border border-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                value={eventNameFilter}
                onChange={(e) => { setEventNameFilter(e.target.value); setEventPage(1); }}
              >
                <option value="">All Events</option>
                {eventOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <span>Sort:</span>
                <button className={eventSortBy === 'created_at' ? 'text-white' : 'text-zinc-500'} onClick={() => { setEventSortBy('created_at'); setEventSortDir(eventSortDir === 'asc' ? 'desc' : 'asc'); }}>Date</button>
                <button className={eventSortBy === 'user_id' ? 'text-white' : 'text-zinc-500'} onClick={() => { setEventSortBy('user_id'); setEventSortDir(eventSortDir === 'asc' ? 'desc' : 'asc'); }}>User</button>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-zinc-900">
                  <tr>
                    {['Event', 'User', 'When', 'Payload'].map((h) => (
                      <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {eventLog.map((e) => {
                    const profile = e.user_id ? eventUserMap[e.user_id] : null;
                    return (
                      <tr key={e.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-4 text-xs font-bold text-zinc-200">{e.event_name}</td>
                        <td className="p-4 text-xs text-zinc-400">
                          {profile
                            ? (
                              <div>
                                <div className="text-zinc-200 font-bold">{profile.name}</div>
                                <div className="text-[9px] font-mono text-zinc-500">{profile.email}</div>
                              </div>
                            )
                            : e.user_id || '—'}
                        </td>
                        <td className="p-4 text-[10px] text-zinc-500">{new Date(e.created_at).toLocaleString()}</td>
                        <td className="p-4 text-[10px] text-zinc-400 font-mono max-w-[360px] break-words">
                          {e.payload ? JSON.stringify(e.payload) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {eventLog.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No events logged</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <span>Page {eventPage} · {eventTotal} events</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setEventPage(Math.max(1, eventPage - 1))}>Prev</Button>
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" onClick={() => setEventPage(eventPage + 1)}>Next</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {editingCustomer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-xl bg-zinc-950 border-4 border-zinc-800 p-6 space-y-6">
            <h3 className="text-xl font-black uppercase tracking-widest">Edit User</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="bg-black border border-zinc-800 p-3 text-sm font-bold" placeholder="Name" value={customerForm.name || ''} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
              <input className="bg-black border border-zinc-800 p-3 text-sm font-bold" placeholder="Email" value={customerForm.email || ''} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
              <input className="bg-black border border-zinc-800 p-3 text-sm font-bold" placeholder="Phone" value={customerForm.phone || ''} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
              <input className="bg-black border border-zinc-800 p-3 text-sm font-bold" placeholder="Company" value={customerForm.company || ''} onChange={(e) => setCustomerForm({ ...customerForm, company: e.target.value })} />
              <select className="bg-black border border-zinc-800 p-3 text-[10px] font-black uppercase tracking-widest" value={customerForm.is_vendor ? 'vendor' : 'customer'} onChange={(e) => setCustomerForm({ ...customerForm, is_vendor: e.target.value === 'vendor' })}>
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
              </select>
              <select className="bg-black border border-zinc-800 p-3 text-[10px] font-black uppercase tracking-widest" value={customerForm.status || 'active'} onChange={(e) => setCustomerForm({ ...customerForm, status: e.target.value as any })}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400" onClick={() => setEditingCustomer(null)}>Cancel</Button>
              <Button size="sm" className="bg-fuchsia-500 text-black" onClick={async () => {
                try {
                  await api.updateProfileAdmin(editingCustomer.id, customerForm);
                  await api.insertAuditLog({ action: 'update_user', entity_type: 'profile', entity_id: editingCustomer.id, payload: customerForm });
                  setEditingCustomer(null);
                  setCustomerPage(1);
                } catch (e) {
                  console.error('Failed to update user', e);
                  alert('Unable to update user.');
                }
              }}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteCustomer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-md bg-zinc-950 border-4 border-red-600 p-6 space-y-4">
            <h3 className="text-xl font-black uppercase tracking-widest text-red-400">Are you sure?</h3>
            <p className="text-sm text-zinc-400">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400" onClick={() => setConfirmDeleteCustomer(null)}>Cancel</Button>
              <Button size="sm" variant="danger" className="shadow-none" onClick={async () => {
                try {
                  const result = await api.hardDeleteProfileIfNoOrders(confirmDeleteCustomer.id);
                  if (!result.deleted) {
                    await api.softDeleteProfile(confirmDeleteCustomer.id);
                  }
                  await api.insertAuditLog({ action: 'delete_user', entity_type: 'profile', entity_id: confirmDeleteCustomer.id, payload: { hard: result.deleted } });
                  setConfirmDeleteCustomer(null);
                  setCustomerPage(1);
                } catch (e) {
                  console.error('Failed to delete user', e);
                  alert('Unable to delete user.');
                }
              }}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {viewingCustomer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-3xl bg-zinc-950 border-4 border-zinc-800 p-6 space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-widest">Customer Profile</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{viewingCustomer.email}</p>
              </div>
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400" onClick={() => setViewingCustomer(null)}>Close</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Name</div>
                <div className="text-white text-sm">{viewingCustomer.name}</div>
              </div>
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Phone</div>
                <div className="text-white text-sm">{viewingCustomer.phone || '—'}</div>
              </div>
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Company</div>
                <div className="text-white text-sm">{viewingCustomer.company || '—'}</div>
              </div>
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Status</div>
                <div className="text-white text-sm">{viewingCustomer.status || 'active'}</div>
              </div>
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Order Count</div>
                <div className="text-white text-sm">{customerPurchases.length}</div>
              </div>
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Total Spend</div>
                <div className="text-white text-sm">
                  ${customerPurchases.reduce((sum, p) => sum + Number(p.total_paid || 0), 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Last Order Date</div>
                <div className="text-white text-sm">
                  {customerPurchases.length > 0
                    ? new Date(customerPurchases[0].timestamp).toLocaleString()
                    : '—'}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Purchase History</h4>
              {isLoadingCustomerPurchases ? (
                <div className="p-6 text-zinc-500 text-sm">Loading…</div>
              ) : customerPurchases.length === 0 ? (
                <div className="p-6 text-zinc-500 text-sm">No purchases.</div>
              ) : (
                <div className="space-y-4">
                  {customerPurchases.map((p) => (
                    <div key={p.id} className="border border-zinc-800 p-4 bg-black">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-white font-bold">{p.drop_name}</div>
                          <div className="text-[9px] font-mono text-zinc-500">{new Date(p.timestamp).toLocaleString()}</div>
                        </div>
                        <div className="text-right text-fuchsia-400 font-black italic">${Number(p.total_paid).toFixed(2)}</div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] text-zinc-400">
                        <div>Qty: <span className="text-white">{p.quantity}</span></div>
                        <div>Payment: <span className="text-white">{p.payment_status}</span></div>
                        <div>Type: <span className="text-white">{p.is_bulk ? 'Bulk' : 'Standard'}</span></div>
                        <div>Status: <span className="text-white">{p.payment_status}</span></div>
                      </div>
                      <div className="mt-3 text-[10px] text-zinc-400 space-y-1">
                        <div>Subtotal: <span className="text-white">${Number(p.subtotal || 0).toFixed(2)}</span></div>
                        <div>Booking Fee: <span className="text-white">${Number(p.booking_fee || 0).toFixed(2)}</span></div>
                        <div>Tax: <span className="text-white">${Number(p.tax_amount || 0).toFixed(2)}</span></div>
                        {p.stripe_fee_amount && p.stripe_fee_amount > 0 && (
                          <div>Stripe Fee: <span className="text-white">${Number(p.stripe_fee_amount || 0).toFixed(2)}</span></div>
                        )}
                        {p.delivery_fee && p.delivery_fee > 0 && (
                          <div>Delivery: <span className="text-white">${Number(p.delivery_fee || 0).toFixed(2)}</span></div>
                        )}
                      </div>
                      {p.order_notes && (
                        <div className="mt-2 text-[10px] text-zinc-500">Notes: {p.order_notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingVendor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-4xl bg-zinc-950 border-4 border-zinc-800 p-6 space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-widest">Vendor Profile</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{viewingVendor.email}</p>
              </div>
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400" onClick={() => setViewingVendor(null)}>Close</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Name</div>
                <div className="text-white text-sm">{viewingVendor.name}</div>
              </div>
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Phone</div>
                <div className="text-white text-sm">{viewingVendor.phone || '—'}</div>
              </div>
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Company</div>
                <div className="text-white text-sm">{viewingVendor.company || '—'}</div>
              </div>
              <div className="bg-black border border-zinc-800 p-4">
                <div className="text-zinc-400">Status</div>
                <div className="text-white text-sm">{viewingVendor.status || 'active'}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sort:</span>
              <button className={`text-[10px] font-black uppercase tracking-widest ${vendorDropSortBy === 'name' ? 'text-white' : 'text-zinc-500'}`} onClick={() => { setVendorDropSortBy('name'); setVendorDropSortDir(vendorDropSortDir === 'asc' ? 'desc' : 'asc'); }}>Name</button>
              <button className={`text-[10px] font-black uppercase tracking-widest ${vendorDropSortBy === 'category' ? 'text-white' : 'text-zinc-500'}`} onClick={() => { setVendorDropSortBy('category'); setVendorDropSortDir(vendorDropSortDir === 'asc' ? 'desc' : 'asc'); }}>Cuisine</button>
              <select className="bg-zinc-950 border border-zinc-800 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-500" value={vendorDropStatusFilter} onChange={(e) => setVendorDropStatusFilter(e.target.value as any)}>
                <option value="">All Status</option>
                <option value={DropApprovalStatus.PENDING}>Pending</option>
                <option value={DropApprovalStatus.APPROVED}>Approved</option>
                <option value={DropApprovalStatus.REJECTED}>Rejected</option>
              </select>
              <select className="bg-zinc-950 border border-zinc-800 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-500" value={vendorDropCuisineFilter} onChange={(e) => setVendorDropCuisineFilter(e.target.value)}>
                <option value="">All Cuisines</option>
                {[...new Set(vendorDrops.map(d => d.category).filter(Boolean) as string[])].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="bg-zinc-950 border border-zinc-900 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-zinc-900">
                  <tr>
                  {['Name', 'Cuisine', 'Status', 'Start Date', 'Qty', 'Price', 'Actions'].map((h) => (
                    <th key={h} className="p-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">{h}</th>
                  ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {[...vendorDrops]
                    .filter(d => !vendorDropStatusFilter || d.approval_status === vendorDropStatusFilter)
                    .filter(d => !vendorDropCuisineFilter || d.category === vendorDropCuisineFilter)
                    .sort((a, b) => {
                      const dir = vendorDropSortDir === 'asc' ? 1 : -1;
                      const av = vendorDropSortBy === 'name' ? a.name : a.category || '';
                      const bv = vendorDropSortBy === 'name' ? b.name : b.category || '';
                      return av.localeCompare(bv) * dir;
                    })
                    .map((d) => (
                      <tr key={d.id} className="hover:bg-zinc-900/50 transition-colors">
                        <td className="p-4 font-bold">{d.name}</td>
                        <td className="p-4 text-xs text-zinc-400">{d.category || '—'}</td>
                        <td className="p-4 text-xs text-zinc-400">{d.approval_status}</td>
                        <td className="p-4 text-xs text-zinc-400">{new Date(d.start_date).toLocaleDateString()}</td>
                        <td className="p-4 text-xs text-zinc-400">{d.quantity_remaining}/{d.total_quantity}</td>
                        <td className="p-4 text-xs text-zinc-400">${Number(d.price).toFixed(2)}</td>
                        <td className="p-4 text-xs">
                          <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400" disabled={d.approval_status !== DropApprovalStatus.PENDING} onClick={() => { setEditingDrop(d); setShowDropEditor(true); }}>
                            {d.approval_status === DropApprovalStatus.PENDING ? 'Edit' : 'Locked'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  {vendorDrops.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest">No packages found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {rejectingDrop && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-md bg-zinc-950 border-4 border-yellow-600 p-6 space-y-4">
            <h3 className="text-xl font-black uppercase tracking-widest text-yellow-400">
              {rejectMode === 'revise' ? 'Send Back for Revision' : 'Reject Package'}
            </h3>
            <textarea
              rows={4}
              className="w-full bg-black border border-zinc-800 p-3 text-sm font-bold"
              placeholder="Reason (required)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-400" onClick={() => setRejectingDrop(null)}>Cancel</Button>
              <Button size="sm" className="bg-yellow-500 text-black" onClick={async () => {
                if (!rejectReason.trim()) {
                  alert('Please provide a reason.');
                  return;
                }
                try {
                  await api.adminUpdateDrop(rejectingDrop.id, {
                    approval_status: DropApprovalStatus.REJECTED,
                    rejection_reason: rejectReason.trim(),
                    revision_requested: rejectMode === 'revise'
                  });
                  await api.insertAuditLog({ action: rejectMode === 'revise' ? 'send_back' : 'reject_drop', entity_type: 'drop', entity_id: rejectingDrop.id, payload: { reason: rejectReason } });
                  setRejectingDrop(null);
                  onRejectDrop(rejectingDrop.id);
                } catch (e) {
                  console.error('Reject failed', e);
                  alert('Reject failed.');
                }
              }}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDropEditor && editingDrop && (
        <AdminDropForm
          isOpen={showDropEditor}
          onClose={() => setShowDropEditor(false)}
          initialData={editingDrop}
          onSave={async (updates) => {
            try {
              await api.adminUpdateDrop(editingDrop.id, updates);
              await api.insertAuditLog({ action: 'edit_drop', entity_type: 'drop', entity_id: editingDrop.id, payload: updates });
              setShowDropEditor(false);
            } catch (e) {
              console.error('Update drop failed', e);
              alert('Unable to update drop.');
            }
          }}
        />
      )}
    </div>
  );
};
