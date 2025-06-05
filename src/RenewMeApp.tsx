import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// import { Checkbox } from "@/components/ui/checkbox";
import {
    // BarChart, Bar, // Removed: Unused Recharts components
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell,
    LineChart, Line
} from 'recharts';
import {
    Calendar, Clock, Plus, Download, Bell, Edit2, Trash2, AlertTriangle,
    TrendingUp, DollarSign, Target, MessageSquare // Removed X, ArrowRight, Settings
} from "lucide-react";

// PDF Export Imports
import { jsPDF } from "jspdf";
import 'jspdf-autotable';
// import { UserOptions } from 'jspdf-autotable'; // Attempt to import UserOptions

// Make autoTable available on the jsPDF instance type (TypeScript specific)
// More specific type for autoTable options
type AutoTableOptions = {
    head?: (string | { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown>; })[][];
    body?: (string | number | { content: string | number; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown>; })[][];
    foot?: (string | { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown>; })[][];
    startY?: number;
    theme?: 'striped' | 'grid' | 'plain';
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    bodyStyles?: Record<string, unknown>;
    footStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    columnStyles?: Record<string, Record<string, unknown>>;
    didDrawPage?: (data: {
        pageNumber: number;
        pageCount: number;
        settings: Record<string, unknown>;
        doc: jsPDF;
        cursor: { x: number; y: number };
    }) => void;
    margin?: number | { top?: number; right?: number; bottom?: number; left?: number; };
    tableWidth?: 'auto' | 'wrap' | number;
    // Add other common options if needed, or use a more generic fallback
    [key: string]: unknown; // Fallback for other options not explicitly defined
};

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
  }
}

// Types
type Frequency = 'weekly' | 'monthly' | 'yearly';
type ActiveTabKey = 'dashboard' | 'list' | 'add' | 'analytics'; // For setActiveTab
type SortByKey = 'name' | 'amount' | 'date'; // For setSortBy

interface Currency {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  renewalDate: string;
  frequency: Frequency;
  category: string;
  paymentMethod: string;
  autoRenew: boolean;
  whatsappReminder: boolean;
  whatsappNumber: string;
  reminderDaysBefore: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

// Helper functions
const parseDate = (dateString: string): Date => new Date(dateString);
const serializeDate = (date: Date): string => date.toISOString();

const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghana Cedi', locale: 'en-GH' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', locale: 'en-KE' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
];

const FREQUENCIES: Frequency[] = ['weekly', 'monthly', 'yearly'];
const CATEGORIES = ['Entertainment', 'Health', 'Utilities', 'Software', 'Education', 'Transportation', 'Food', 'Other'];

const formatCurrency = (amount: number, currencyCode: string): string => {
  const currency = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Renamed to useLocalStorage for clarity
const useLocalStorage = <T,>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      }
      return initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key “${key}”:`, error);
    }
  };
  return [storedValue, setValue];
};


export default function RenewMeApp() {
  const [subscriptions, setSubscriptions] = useLocalStorage<Subscription[]>('subscriptions', []);
  const [activeTab, setActiveTab] = useState<ActiveTabKey>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortByKey>('date');

  const [newSubscription, setNewSubscription] = useState<Omit<Subscription, 'id' | 'createdAt'>>({
    name: '', amount: 0, currency: 'NGN', renewalDate: serializeDate(new Date()), frequency: 'monthly', category: CATEGORIES[0] || '',
    paymentMethod: '', autoRenew: true, whatsappReminder: false, whatsappNumber: '', reminderDaysBefore: 1, description: '', isActive: true
  });

  useEffect(() => {
    const item = typeof window !== 'undefined' ? window.localStorage.getItem('subscriptions') : null;
    const hasStoredData = item ? JSON.parse(item).length > 0 : false;

    if (!hasStoredData && !isLoading) { // Check isLoading to avoid race condition with initial load
      const sampleSubscriptions: Subscription[] = [
        { id: '1', name: 'Netflix', amount: 15.99, currency: 'USD', renewalDate: serializeDate(new Date(Date.now() + 86400000 * 3)), frequency: 'monthly', category: 'Entertainment', paymentMethod: 'Credit Card', autoRenew: true, whatsappReminder: true, whatsappNumber: '+1234567890', reminderDaysBefore: 2, description: 'Video streaming service', isActive: true, createdAt: serializeDate(new Date(Date.now() - 86400000 * 30)) },
        { id: '2', name: 'DSTV Premium', amount: 18000, currency: 'NGN', renewalDate: serializeDate(new Date(Date.now() + 86400000 * 10)), frequency: 'monthly', category: 'Entertainment', paymentMethod: 'Bank Transfer', autoRenew: true, whatsappReminder: false, whatsappNumber: '', reminderDaysBefore: 1, description: 'Satellite TV subscription', isActive: true, createdAt: serializeDate(new Date(Date.now() - 86400000 * 60)) },
        { id: '3', name: 'Gym Membership', amount: 500, currency: 'GHS', renewalDate: serializeDate(new Date(Date.now() + 86400000 * 1)), frequency: 'monthly', category: 'Health', paymentMethod: 'Mobile Money', autoRenew: true, whatsappReminder: true, whatsappNumber: '+2330000000', reminderDaysBefore: 1, description: 'Monthly gym access', isActive: true, createdAt: serializeDate(new Date(Date.now() - 86400000 * 15)) },
        { id: '4', name: 'Spotify Premium', amount: 9.99, currency: 'USD', renewalDate: serializeDate(new Date(Date.now() + 86400000 * 7)), frequency: 'monthly', category: 'Entertainment', paymentMethod: 'PayPal', autoRenew: true, whatsappReminder: true, whatsappNumber: '+23480000000', reminderDaysBefore: 3, description: 'Music streaming service', isActive: true, createdAt: serializeDate(new Date(Date.now() - 86400000 * 45)) }
      ];
      setSubscriptions(sampleSubscriptions);
    }
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, [isLoading, setSubscriptions]);


  const formatDate = useCallback((dateString: string) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), []);
  const daysUntilRenewal = useCallback((dateString: string) => { const today = new Date(); today.setHours(0,0,0,0); const renewal = new Date(dateString); renewal.setHours(0,0,0,0); return Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); }, []);
  const getRenewalStatus = useCallback((days: number) => { if (days < 0) return { status: 'overdue', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/30', iconColor: 'text-red-500' }; if (days <= 3) return { status: 'urgent', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/30', iconColor: 'text-orange-500' }; if (days <= 7) return { status: 'soon', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-900/30', iconColor: 'text-yellow-500' }; return { status: 'normal', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/30', iconColor: 'text-green-500' };}, []);

  const whatsAppReminderSubscriptions = useMemo(() => subscriptions.filter(sub => sub.isActive && sub.whatsappReminder && sub.whatsappNumber && daysUntilRenewal(sub.renewalDate) >= 0 && daysUntilRenewal(sub.renewalDate) <= sub.reminderDaysBefore).sort((a, b) => parseDate(a.renewalDate).getTime() - parseDate(b.renewalDate).getTime()), [subscriptions, daysUntilRenewal]);
  const upcomingSubscriptions = useMemo(() => subscriptions.filter(sub => sub.isActive && daysUntilRenewal(sub.renewalDate) <= 30 && daysUntilRenewal(sub.renewalDate) >= 0).sort((a,b) => parseDate(a.renewalDate).getTime() - parseDate(b.renewalDate).getTime()),[subscriptions, daysUntilRenewal]);
  const estimatedMonthlyTotal = useMemo(() => subscriptions.filter(sub => sub.isActive).reduce((total, sub) => { let monthlyAmount = 0; if (sub.frequency === 'weekly') monthlyAmount = sub.amount * 4.33; else if (sub.frequency === 'monthly') monthlyAmount = sub.amount; else if (sub.frequency === 'yearly') monthlyAmount = sub.amount / 12; return total + monthlyAmount; }, 0),[subscriptions]);
  const categorySpending = useMemo(() => { const spending = subscriptions.filter(sub => sub.isActive).reduce((acc, sub) => { let monthlyAmount = 0; if (sub.frequency === 'weekly') monthlyAmount = sub.amount * 4.33; else if (sub.frequency === 'monthly') monthlyAmount = sub.amount; else if (sub.frequency === 'yearly') monthlyAmount = sub.amount / 12; acc[sub.category] = (acc[sub.category] || 0) + monthlyAmount; return acc; }, {} as Record<string, number>); return Object.entries(spending).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount); }, [subscriptions]);

  const monthlyRenewalData = useMemo(() => {
    const data: { month: string; renewals: number; totalAmount: number }[] = [];
    if (subscriptions.length === 0) return data;

    const SPREAD_MONTHS = 6;
    const monthMap = new Map<string, { renewals: number; totalAmount: number }>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    subscriptions.forEach(sub => {
      if (!sub.isActive) return;
      // currentRenewalDateIter is mutated, so 'let' is appropriate here.
      let currentRenewalDateIter = parseDate(sub.renewalDate);
      currentRenewalDateIter.setHours(0,0,0,0);
      const iterationLimit = sub.frequency === 'yearly' ? 1 : (sub.frequency === 'monthly' ? SPREAD_MONTHS : SPREAD_MONTHS * 5);

      for (let i = 0; i < iterationLimit; i++) {
        const monthYearKey = currentRenewalDateIter.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        const dateLimit = new Date(today);
        dateLimit.setMonth(today.getMonth() + SPREAD_MONTHS);

        if (currentRenewalDateIter > dateLimit) break;
        if (currentRenewalDateIter >= today ) {
          if (!monthMap.has(monthYearKey)) {
            monthMap.set(monthYearKey, { renewals: 0, totalAmount: 0 });
          }
          const monthEntry = monthMap.get(monthYearKey)!;
          monthEntry.renewals += 1;
          monthEntry.totalAmount += sub.amount;
        }
        
        if (sub.frequency === 'weekly') currentRenewalDateIter.setDate(currentRenewalDateIter.getDate() + 7);
        else if (sub.frequency === 'monthly') currentRenewalDateIter.setMonth(currentRenewalDateIter.getMonth() + 1);
        else if (sub.frequency === 'yearly') currentRenewalDateIter.setFullYear(currentRenewalDateIter.getFullYear() + 1);
        else break; 
      }
    });
    
    const sortedData = Array.from(monthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => {
        const [aMonStr, aYearStr] = a.month.split(" ");
        const dateA = new Date(`${aMonStr} 1, 20${aYearStr}`);
        const [bMonStr, bYearStr] = b.month.split(" ");
        const dateB = new Date(`${bMonStr} 1, 20${bYearStr}`);
        return dateA.getTime() - dateB.getTime();
      });
    return sortedData;
  }, [subscriptions]);


  const resetForm = () => { setEditingSubscription(null); setNewSubscription({ name: '', amount: 0, currency: 'NGN', renewalDate: serializeDate(new Date()), frequency: 'monthly', category: CATEGORIES[0] || '', paymentMethod: '', autoRenew: true, whatsappReminder: false, whatsappNumber: '', reminderDaysBefore: 1, description: '', isActive: true }); };
  const handleAddSubscription = () => { const newSub = { ...newSubscription, id: Math.random().toString(36).substring(2,9), createdAt: serializeDate(new Date()) }; setSubscriptions(prev => [...prev, newSub]); resetForm(); setActiveTab('list'); };
  const handleEditSubscription = (sub: Subscription) => { setEditingSubscription(sub); setNewSubscription({ name: sub.name, amount: sub.amount, currency: sub.currency, renewalDate: sub.renewalDate, frequency: sub.frequency, category: sub.category, paymentMethod: sub.paymentMethod, autoRenew: sub.autoRenew, whatsappReminder: sub.whatsappReminder, whatsappNumber: sub.whatsappNumber, reminderDaysBefore: sub.reminderDaysBefore, description: sub.description || '', isActive: sub.isActive }); setActiveTab('add'); };
  const handleUpdateSubscription = () => { if(!editingSubscription) return; const updated = { ...editingSubscription, ...newSubscription }; setSubscriptions(subs => subs.map(s => s.id === editingSubscription.id ? updated : s)); resetForm(); setActiveTab('list'); };
  const handleDeleteSubscription = (id: string) => setSubscriptions(subs => subs.filter(s => s.id !== id));
  const toggleSubscriptionStatus = (id: string) => setSubscriptions(subs => subs.map(s => s.id === id ? {...s, isActive: !s.isActive} : s));
  
  const exportPdfReport = useCallback(() => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(38, 106, 106);
    doc.text("RenewMe Subscriptions Report", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 30);
    doc.text(`Total Active Subscriptions: ${subscriptions.filter(s => s.isActive).length}`, 14, 35);
    doc.text(`Estimated Monthly Total: ${formatCurrency(estimatedMonthlyTotal, subscriptions[0]?.currency || 'USD')}`, 14, 40);

    const tableColumn = ["Name", "Category", "Amount", "Currency", "Renewal Date", "Frequency", "Status"];
    // More specific type for table rows
    const tableRows: (string | number)[][] = [];

    const dataToExport = [...subscriptions].sort((a,b) => parseDate(a.renewalDate).getTime() - parseDate(b.renewalDate).getTime());

    dataToExport.forEach(sub => {
      const days = daysUntilRenewal(sub.renewalDate);
      let statusText = `${days}d left`;
      if (days < 0) statusText = `${Math.abs(days)}d overdue`;
      if (days === 0) statusText = 'Today';
      if (!sub.isActive) statusText = 'Inactive';

      const subscriptionData = [
        sub.name,
        sub.category,
        sub.amount.toFixed(2), // Amount is already a number, toFixed makes it a string
        sub.currency,
        formatDate(sub.renewalDate),
        sub.frequency.charAt(0).toUpperCase() + sub.frequency.slice(1),
        statusText
      ];
      tableRows.push(subscriptionData as (string|number)[]); // Asserting here as toFixed makes amount a string
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      theme: 'grid',
      headStyles: { fillColor: [38, 106, 106], textColor: [255,255,255] },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 25 },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 15 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
      },
      didDrawPage: function (data) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${data.pageNumber}`, pageWidth - 20, pageHeight - 10, {align: 'right'});
        doc.text('RenewMe Report', 14, pageHeight - 10);
      }
    });

    doc.save("renewme-subscriptions-report.pdf");
  }, [subscriptions, formatDate, daysUntilRenewal, estimatedMonthlyTotal]);

  const handleSubmit = () => { if (editingSubscription) handleUpdateSubscription(); else handleAddSubscription(); };

  const filteredSubscriptions = useMemo(() => {
    // 'filtered' is not reassigned, so 'const' is appropriate.
    const filtered = subscriptions.filter(sub => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = sub.name.toLowerCase().includes(searchLower) ||
                            sub.category.toLowerCase().includes(searchLower) ||
                            (sub.description && sub.description.toLowerCase().includes(searchLower));
      const matchesCategory = filterCategory === 'all' || sub.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'amount': return b.amount - a.amount; // For descending, otherwise a.amount - b.amount
        case 'date': return parseDate(a.renewalDate).getTime() - parseDate(b.renewalDate).getTime();
        default: return 0;
      }
    });
  }, [subscriptions, searchTerm, filterCategory, sortBy]);

  if (isLoading) { return (<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 dark:from-gray-900 dark:to-gray-800"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 dark:border-teal-400 mx-auto mb-4"></div><p className="text-gray-600 dark:text-gray-300">Loading RenewMe...</p></div></div>); }
  const totalActiveSubscriptions = subscriptions.filter(s => s.isActive).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-900 dark:text-gray-100 selection:bg-teal-500 selection:text-white">
      <header className="bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4"><div className="flex justify-between items-center"><div className="flex items-center space-x-3"><div className="bg-gradient-to-r from-teal-500 to-blue-500 p-2 rounded-lg shadow-md"><Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-white" /></div><div><h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">RenewMe</h1><p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Your Subscription Hub</p></div></div>
        <div className="flex items-center space-x-1 sm:space-x-2">
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={exportPdfReport} 
                className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400"
                disabled={subscriptions.length === 0}
            >
                <Download className="h-4 w-4 mr-1" /> Export PDF
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 relative">
                <Bell className="h-4 w-4" />
                {upcomingSubscriptions.filter(sub => daysUntilRenewal(sub.renewalDate) <= 7).length > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 transform -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-950"></span>
                )}
            </Button>
        </div></div></div>
      </header>

      <main className="container mx-auto p-4 sm:p-6">
        <div className="flex space-x-1 border-b-0 mb-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg rounded-lg p-1 shadow-sm">
          {[{ key: 'dashboard', label: 'Dashboard', icon: TrendingUp },{ key: 'list', label: 'Subscriptions', icon: Calendar },{ key: 'add', label: editingSubscription ? 'Edit Sub' : 'Add New', icon: Plus },{ key: 'analytics', label: 'Analytics', icon: Target }].map(({ key, label, icon: Icon }) => (
            <button 
                key={key} 
                onClick={() => { 
                    if (key === 'add' && activeTab !== 'add') resetForm(); 
                    setActiveTab(key as ActiveTabKey); // Use specific type for key
                }} 
                className={`flex-1 sm:flex-none flex items-center justify-center px-3 py-2 sm:px-4 font-medium rounded-md transition-all text-sm sm:text-base ${ activeTab === key ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-md' : 'text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100/50 dark:hover:bg-gray-700/50'}`}
            >
                <Icon className="h-4 w-4 mr-2" />{label}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && ( <div className="space-y-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">{[{ title: "Monthly Total", value: formatCurrency(estimatedMonthlyTotal, subscriptions[0]?.currency || CURRENCIES[0].code), icon: DollarSign, color: "text-teal-600 dark:text-teal-400", description: `Across ${totalActiveSubscriptions} active subs` },{ title: "Due Soon (7d)", value: upcomingSubscriptions.filter(sub => daysUntilRenewal(sub.renewalDate) <= 7).length.toString(), icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", description: "Upcoming renewals"  },{ title: "Active Subs", value: totalActiveSubscriptions.toString(), icon: Calendar, color: "text-blue-600 dark:text-blue-400", description: `Total: ${subscriptions.length}` },{ title: "Avg Monthly/Sub", value: totalActiveSubscriptions > 0 ? formatCurrency(estimatedMonthlyTotal / totalActiveSubscriptions, subscriptions[0]?.currency || CURRENCIES[0].code) : formatCurrency(0, subscriptions[0]?.currency || CURRENCIES[0].code), icon: TrendingUp, color: "text-purple-600 dark:text-purple-400", description: "Per active sub" }].map(metric => ( <Card key={metric.title} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-0 shadow-lg hover:shadow-xl transition-shadow"><CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center"><metric.icon className={`h-4 w-4 mr-2 ${metric.color}`} />{metric.title}</CardTitle></CardHeader><CardContent className="px-4 pb-4"><div className={`text-xl sm:text-2xl font-bold ${metric.color}`}>{metric.value}</div><p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{metric.description}</p></CardContent></Card>))}</div>{whatsAppReminderSubscriptions.length > 0 && (<Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-0 shadow-lg"><CardHeader><CardTitle className="flex items-center text-lg"><MessageSquare className="h-5 w-5 mr-2 text-green-500 dark:text-green-400" />WhatsApp Reminder Queue</CardTitle><CardDescription className="text-xs">Visual queue for configured WhatsApp reminders.<span className="block italic text-gray-500 dark:text-gray-400">(Note: Actual sending not implemented yet)</span></CardDescription></CardHeader><CardContent><div className="space-y-3 max-h-72 overflow-y-auto pr-2">{whatsAppReminderSubscriptions.map(sub => { const daysToRenewal = daysUntilRenewal(sub.renewalDate); const daysUntilReminderSend = daysToRenewal - sub.reminderDaysBefore; return ( <div key={sub.id} className="flex justify-between items-center p-3 rounded-lg bg-green-50 dark:bg-green-900/40 border border-green-200/50 dark:border-green-700/40"><div className="flex items-center space-x-3"><div className="p-1.5 sm:p-2 rounded-full bg-green-100 dark:bg-green-800/50"><MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" /></div><div><p className="font-medium text-sm sm:text-base">{sub.name}</p><p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Reminder due: {daysUntilReminderSend <= 0 ? 'Today/Soon' : `in ${daysUntilReminderSend} day(s)`}</p><p className="text-xs text-gray-500 dark:text-gray-500">Renews in: {daysToRenewal} day(s)</p></div></div><div className="text-right"><p className="font-medium text-sm sm:text-base">{formatCurrency(sub.amount, sub.currency)}</p><p className="text-xs text-green-600 dark:text-green-400">{sub.whatsappNumber}</p></div></div> ); })}</div></CardContent></Card>)}<div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><Card className="lg:col-span-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-0 shadow-lg"><CardHeader><CardTitle className="flex items-center text-lg"><Clock className="h-5 w-5 mr-2 text-teal-600 dark:text-teal-400" />Upcoming Renewals (Next 30 Days)</CardTitle></CardHeader><CardContent><div className="space-y-3 max-h-96 overflow-y-auto pr-2">{upcomingSubscriptions.length > 0 ? upcomingSubscriptions.slice(0, 10).map(sub => { const days = daysUntilRenewal(sub.renewalDate); const status = getRenewalStatus(days); return ( <div key={sub.id} className={`flex justify-between items-center p-3 rounded-lg ${status.bgColor} border border-gray-200/30 dark:border-gray-700/30`}><div className="flex items-center space-x-3"><div className={`p-2 rounded-full ${status.bgColor}`}><Calendar className={`h-4 w-4 ${status.iconColor}`} /></div><div><p className="font-medium text-sm sm:text-base">{sub.name}</p><p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{sub.category} • {formatDate(sub.renewalDate)}</p></div></div><div className="text-right"><p className="font-medium text-sm sm:text-base">{formatCurrency(sub.amount, sub.currency)}</p><p className={`text-xs sm:text-sm ${status.color} font-semibold`}>{days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}</p></div></div> ); }) : ( <p className="text-center text-gray-500 dark:text-gray-400 py-8">No upcoming renewals in the next 30 days.</p> )}</div></CardContent></Card><div className="space-y-6"><Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-0 shadow-lg"><CardHeader><CardTitle className="text-lg">Top Categories</CardTitle></CardHeader><CardContent><div className="space-y-3">{categorySpending.length > 0 ? categorySpending.slice(0, 5).map(({ category, amount }) => ( <div key={category} className="flex justify-between items-center"><span className="text-sm font-medium">{category}</span><span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">{formatCurrency(amount, subscriptions[0]?.currency || CURRENCIES[0].code)}</span></div> )) : ( <p className="text-center text-gray-500 dark:text-gray-400 py-4">No spending data yet.</p> )}</div></CardContent></Card><Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-0 shadow-lg"><CardHeader><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader><CardContent className="space-y-2"><Button onClick={() => { resetForm(); setActiveTab('add');}} className="w-full bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600"><Plus className="h-4 w-4 mr-2" /> Add Subscription</Button><Button variant="outline" onClick={() => setActiveTab('analytics')} className="w-full"><Target className="h-4 w-4 mr-2" /> View Analytics</Button></CardContent></Card></div></div></div>)}

        {activeTab === 'list' && ( <div className="space-y-6"><div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg rounded-lg shadow-sm"><h2 className="text-xl sm:text-2xl font-bold">All Subscriptions ({filteredSubscriptions.length})</h2><div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto"><Input placeholder="Search by name, category, desc..." className="flex-grow sm:flex-grow-0 sm:max-w-xs bg-white/70 dark:bg-gray-900/70 backdrop-blur-lg border-gray-300 dark:border-gray-700 focus:ring-teal-500 focus:border-teal-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><Select value={filterCategory} onValueChange={setFilterCategory}><SelectTrigger className="w-full sm:w-40 bg-white/70 dark:bg-gray-900/70 backdrop-blur-lg border-gray-300 dark:border-gray-700 focus:ring-teal-500 focus:border-teal-500"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{CATEGORIES.map(category => ( <SelectItem key={category} value={category}>{category}</SelectItem> ))}</SelectContent></Select>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortByKey)}> {/* Use specific type for value */}
                <SelectTrigger className="w-full sm:w-32 bg-white/70 dark:bg-gray-900/70 backdrop-blur-lg border-gray-300 dark:border-gray-700 focus:ring-teal-500 focus:border-teal-500"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="date">Due Date</SelectItem>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                    <SelectItem value="amount">Amount (High-Low)</SelectItem>
                </SelectContent>
            </Select>
        </div></div>{filteredSubscriptions.length > 0 ? (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">{filteredSubscriptions.map(sub => { const days = daysUntilRenewal(sub.renewalDate); const status = getRenewalStatus(days); return ( <Card key={sub.id} className={`bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-0 shadow-lg hover:shadow-xl transition-shadow flex flex-col justify-between ${!sub.isActive ? 'opacity-60' : ''}`}><CardHeader className="pb-3"><div className="flex justify-between items-start"><CardTitle className="text-base sm:text-lg">{sub.name}</CardTitle><div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status.bgColor} ${status.color} border ${status.color.replace('text-', 'border-')}/30`}>{days < 0 ? `${Math.abs(days)}d Overdue` : days === 0 ? `Today` : `${days}d Left`}</div></div><CardDescription className="text-xs sm:text-sm">{sub.category} • {sub.paymentMethod}{!sub.isActive && <span className="ml-2 text-red-500 font-semibold">(Inactive)</span>}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm flex-grow"><p><strong>Amount:</strong> {formatCurrency(sub.amount, sub.currency)} <span className="capitalize text-xs">({sub.frequency})</span></p><p><strong>Renews:</strong> {formatDate(sub.renewalDate)}</p>{sub.description && <p className="text-xs text-gray-600 dark:text-gray-400 truncate" title={sub.description}><strong>Desc:</strong> {sub.description}</p>}<p><strong>Auto-Renew:</strong> {sub.autoRenew ? 'Yes' : 'No'}</p></CardContent><CardFooter className="flex justify-between items-center pt-3"><Button variant="outline" size="sm" onClick={() => toggleSubscriptionStatus(sub.id)} className={sub.isActive ? "border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-400 dark:hover:bg-yellow-900/50" : "border-green-500 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-400 dark:hover:bg-green-900/50"}>{sub.isActive ? 'Deactivate' : 'Activate'}</Button><div className="flex space-x-2"><Button variant="ghost" size="icon" onClick={() => handleEditSubscription(sub)} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-500"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteSubscription(sub.id)} className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500"><Trash2 className="h-4 w-4" /></Button></div></CardFooter></Card> ); })}</div>) : ( <div className="text-center py-12"><Calendar className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" /><p className="text-xl font-semibold text-gray-700 dark:text-gray-300">No subscriptions found.</p><p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filters, or add a new subscription!</p><Button onClick={() => { resetForm(); setActiveTab('add');}} className="mt-6 bg-gradient-to-r from-teal-500 to-blue-500"><Plus className="h-4 w-4 mr-2" /> Add First Subscription</Button></div>)}</div>)}

        {activeTab === 'add' && ( <div className="max-w-2xl mx-auto"><Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-0 shadow-xl"><CardHeader><CardTitle className="text-xl sm:text-2xl">{editingSubscription ? 'Edit Subscription' : 'Add New Subscription'}</CardTitle><CardDescription>{editingSubscription ? 'Update the details of your subscription.' : 'Fill in the details to track a new subscription.'}</CardDescription></CardHeader><CardContent className="space-y-4 sm:space-y-6 pt-6"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6"><div><Label htmlFor="subName">Subscription Name</Label><Input id="subName" value={newSubscription.name} onChange={(e) => setNewSubscription({...newSubscription, name: e.target.value})} placeholder="e.g. Netflix, Spotify" className="bg-white/50 dark:bg-gray-900/50" /></div><div><Label htmlFor="subCategory">Category</Label><Select value={newSubscription.category} onValueChange={(value) => setNewSubscription({...newSubscription, category: value})}><SelectTrigger id="subCategory" className="bg-white/50 dark:bg-gray-900/50"><SelectValue placeholder="Select a category" /></SelectTrigger><SelectContent>{CATEGORIES.map(cat => ( <SelectItem key={cat} value={cat}>{cat}</SelectItem> ))}</SelectContent></Select></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6"><div><Label>Amount</Label><div className="flex"><Select value={newSubscription.currency} onValueChange={(value) => setNewSubscription({...newSubscription, currency: value})}><SelectTrigger className="w-[100px] sm:w-[120px] rounded-r-none border-r-0 bg-white/50 dark:bg-gray-900/50"><SelectValue placeholder="Currency" /></SelectTrigger><SelectContent>{CURRENCIES.map(currency => ( <SelectItem key={currency.code} value={currency.code}>{currency.code} ({currency.symbol})</SelectItem> ))}</SelectContent></Select><Input type="number" step="0.01" value={newSubscription.amount} onChange={(e) => setNewSubscription({...newSubscription, amount: parseFloat(e.target.value) || 0})} className="rounded-l-none bg-white/50 dark:bg-gray-900/50" placeholder="0.00"/></div></div><div><Label htmlFor="subRenewalDate">Renewal Date</Label><Input id="subRenewalDate" type="date" value={newSubscription.renewalDate ? new Date(newSubscription.renewalDate).toISOString().split('T')[0] : ''} onChange={(e) => setNewSubscription({...newSubscription, renewalDate: e.target.value ? serializeDate(new Date(e.target.value)) : ''})} className="bg-white/50 dark:bg-gray-900/50"/></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6"><div><Label htmlFor="subFrequency">Frequency</Label><Select value={newSubscription.frequency} onValueChange={(value) => setNewSubscription({...newSubscription, frequency: value as Frequency})}><SelectTrigger id="subFrequency" className="bg-white/50 dark:bg-gray-900/50"><SelectValue placeholder="Frequency" /></SelectTrigger><SelectContent>{FREQUENCIES.map(freq => ( <SelectItem key={freq} value={freq}>{freq.charAt(0).toUpperCase() + freq.slice(1)}</SelectItem> ))}</SelectContent></Select></div><div><Label htmlFor="subPaymentMethod">Payment Method</Label><Input id="subPaymentMethod" value={newSubscription.paymentMethod} onChange={(e) => setNewSubscription({...newSubscription, paymentMethod: e.target.value})} placeholder="e.g. Credit Card, PayPal" className="bg-white/50 dark:bg-gray-900/50"/></div></div><div><Label htmlFor="subDescription">Description (Optional)</Label><Input id="subDescription" value={newSubscription.description || ''} onChange={(e) => setNewSubscription({...newSubscription, description: e.target.value})} placeholder="e.g. Family plan, includes HBO Max" className="bg-white/50 dark:bg-gray-900/50 min-h-[60px]"/></div><div className="pt-2 space-y-3 border-t border-gray-200/30 dark:border-gray-700/30 mt-4"><h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2">Reminder Options</h3><div className="flex items-center space-x-3"><input type="checkbox" id="autoRenew" checked={newSubscription.autoRenew} onChange={(e) => setNewSubscription({...newSubscription, autoRenew: e.target.checked})} className="h-4 w-4 text-teal-600 rounded border-gray-300 dark:border-gray-600 focus:ring-teal-500 bg-white/50 dark:bg-gray-900/50"/><Label htmlFor="autoRenew" className="font-normal cursor-pointer">Auto-renews</Label></div><div className="flex items-center space-x-3"><input type="checkbox" id="whatsappReminderEnabled" checked={newSubscription.whatsappReminder} onChange={(e) => setNewSubscription({...newSubscription, whatsappReminder: e.target.checked})} className="h-4 w-4 text-teal-600 rounded border-gray-300 dark:border-gray-600 focus:ring-teal-500 bg-white/50 dark:bg-gray-900/50"/><Label htmlFor="whatsappReminderEnabled" className="font-normal cursor-pointer">Enable WhatsApp Reminder</Label></div>{newSubscription.whatsappReminder && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pl-2 border-l-2 border-teal-500/30 ml-1"><div><Label htmlFor="whatsappNumber">WhatsApp Number</Label><Input id="whatsappNumber" value={newSubscription.whatsappNumber} onChange={(e) => setNewSubscription({...newSubscription, whatsappNumber: e.target.value})} placeholder="+1234567890" className="bg-white/50 dark:bg-gray-900/50"/></div><div><Label htmlFor="reminderDays">Remind Days Before</Label><Input id="reminderDays" type="number" min="0" value={newSubscription.reminderDaysBefore} onChange={(e) => setNewSubscription({...newSubscription, reminderDaysBefore: parseInt(e.target.value) || 0})} className="bg-white/50 dark:bg-gray-900/50"/></div></div>)}{editingSubscription && (<div className="flex items-center space-x-3 pt-3 border-t border-gray-200/30 dark:border-gray-700/30 mt-3"><input type="checkbox" id="isActive" checked={newSubscription.isActive} onChange={(e) => setNewSubscription({...newSubscription, isActive: e.target.checked})} className="h-4 w-4 text-teal-600 rounded border-gray-300 dark:border-gray-600 focus:ring-teal-500 bg-white/50 dark:bg-gray-900/50"/><Label htmlFor="isActive" className="font-normal cursor-pointer">Subscription is Active</Label></div>)}</div></CardContent><CardFooter className="flex flex-col sm:flex-row justify-end gap-2 pt-6 border-t border-gray-200/50 dark:border-gray-700/50"><Button variant="outline" onClick={() => { resetForm(); setActiveTab(editingSubscription ? 'list' : 'dashboard');}}>Cancel</Button><Button onClick={handleSubmit} className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white"><Plus className={`h-4 w-4 mr-2 ${editingSubscription ? 'hidden' : ''}`} /><Edit2 className={`h-4 w-4 mr-2 ${editingSubscription ? '' : 'hidden'}`} />{editingSubscription ? 'Update Subscription' : 'Save Subscription'}</Button></CardFooter></Card></div>)}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="text-center">
              <Target className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <h2 className="text-2xl font-bold">Subscription Analytics</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Visualize your spending and renewal patterns.
              </p>
            </div>

            {categorySpending.length > 0 ? (
              <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-0 shadow-xl">
                <CardHeader>
                  <CardTitle>Spending by Category (Monthly Estimate)</CardTitle>
                </CardHeader>
                <CardContent style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySpending}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) =>
                            `${name}: ${formatCurrency(value, subscriptions[0]?.currency || CURRENCIES[0].code)} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="amount"
                        nameKey="category"
                      >
                        {categorySpending.map((entry, index) => {
                          const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF4560', '#A0522D', '#D2691E'];
                          return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                        })}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [formatCurrency(value, subscriptions[0]?.currency || CURRENCIES[0].code), name]} />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              subscriptions.length > 0 &&
              <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-0 shadow-xl">
                <CardHeader><CardTitle>Spending by Category</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">No active subscriptions with spending data to display.</p>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-0 shadow-xl">
                <CardHeader>
                    <CardTitle>Projected Renewals (Count & Amount)</CardTitle>
                </CardHeader>
                <CardContent style={{ width: '100%', height: 300 }}>
                    {monthlyRenewalData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthlyRenewalData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                                <XAxis dataKey="month" />
                                <YAxis yAxisId="left" allowDecimals={false} label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: -5, style: {textAnchor: 'middle'} }} />
                                <YAxis yAxisId="right" orientation="right" label={{ value: 'Total Amount', angle: -90, position: 'insideRight', offset: 10, style: {textAnchor: 'middle'} }}
                                       tickFormatter={(value) => formatCurrency(value, subscriptions[0]?.currency || CURRENCIES[0].code)} />
                                <Tooltip
                                    formatter={(value: number, name: string) => {
                                        if (name === 'Renewals Count') return [value, 'Count'];
                                        if (name === 'Total Amount') return [formatCurrency(value, subscriptions[0]?.currency || CURRENCIES[0].code), 'Total Amount'];
                                        return [value, name];
                                    }}
                                />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center"/>
                                <Line yAxisId="left" type="monotone" dataKey="renewals" name="Renewals Count" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} />
                                <Line yAxisId="right" type="monotone" dataKey="totalAmount" name="Total Amount" stroke="#82ca9d" strokeWidth={2} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <p className="text-gray-500 dark:text-gray-400">Not enough data for renewal projection.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {subscriptions.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-12">
                    Add subscriptions to see analytics data.
                </p>
            )}
          </div>
        )}

      </main>
      <footer className="text-center py-6 border-t border-gray-200/50 dark:border-gray-700/50 mt-10">
        <p className="text-sm text-gray-500 dark:text-gray-400">RenewMe © {new Date().getFullYear()} - Manage your subscriptions effortlessly.</p>
      </footer>
    </div>
  );
}