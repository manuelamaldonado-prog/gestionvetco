import { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const DataContext = createContext();

const STORAGE_KEY = 'CLIENT_JOB_MANAGER_DATA_V1';

const INITIAL_STATE = {
  clients: [],
  practices: [],
  jobs: [],
  payments: [],
  businessInfo: {
    name: 'ALEJANDRO MALDONADO',
    cuit: '23176125489',
    bank: 'BANCO ICBC',
    accountNumber: 'CA$ 0840/01111950/74',
    cbu: '0150840401000111950743',
    alias: 'ALE.VET.SGO',
    phone: '',
    email: '',
    extraDetails: '',
    inmag: '',
    inmagUpdatedAt: '',
    inmagSourceUrl: ''
  }
};

export function DataProvider({ children }) {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      let normalizedBI = (typeof parsed.businessInfo === 'object' && parsed.businessInfo !== null)
        ? parsed.businessInfo
        : INITIAL_STATE.businessInfo;
      if (normalizedBI && normalizedBI.inmmag && !normalizedBI.inmag) {
        normalizedBI = { ...normalizedBI, inmag: normalizedBI.inmmag };
      }
      if (!('inmagUpdatedAt' in normalizedBI)) {
        normalizedBI = { ...normalizedBI, inmagUpdatedAt: '' };
      }
      if (!('inmagSourceUrl' in normalizedBI)) {
        normalizedBI = { ...normalizedBI, inmagSourceUrl: '' };
      }
      const normalized = {
        clients: Array.isArray(parsed.clients) ? parsed.clients : [],
        practices: Array.isArray(parsed.practices) ? parsed.practices : [],
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
        payments: Array.isArray(parsed.payments) ? parsed.payments : [],
        businessInfo: normalizedBI
      };
      return { ...INITIAL_STATE, ...normalized };
    } catch (e) {
      console.error("Failed to load data", e);
      return INITIAL_STATE;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save data", e);
    }
  }, [data]);

  // --- Actions ---

  // Clients
  const addClient = (client) => {
    setData(prev => ({
      ...prev,
      clients: [...prev.clients, { ...client, id: uuidv4(), createdAt: new Date().toISOString() }]
    }));
  };

  const updateClient = (id, updates) => {
    setData(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const deleteClient = (id) => {
    // Optional: Check for existing jobs/payments meant constraint? 
    // For now, allow delete but maybe warn in UI
    setData(prev => ({
      ...prev,
      clients: prev.clients.filter(c => c.id !== id)
    }));
  }

  // Practices (Catalog)
  const addPractice = (practice) => {
    setData(prev => ({
      ...prev,
      practices: [...prev.practices, { ...practice, id: uuidv4() }]
    }));
  };

  const updatePractice = (id, updates) => {
    setData(prev => ({
      ...prev,
      practices: prev.practices.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  const deletePractice = (id) => {
    setData(prev => ({
      ...prev,
      practices: prev.practices.filter(p => p.id !== id)
    }));
  };

  // Jobs
  const addJob = (job) => {
    // job needs: clientId, practiceId, quantity, unitPrice, date
    const total = Number(job.quantity) * Number(job.unitPrice);
    setData(prev => ({
      ...prev,
      jobs: [...prev.jobs, { ...job, id: uuidv4(), total, createdAt: new Date().toISOString() }]
    }));
  };

  // Payments
  const addPayment = (payment) => {
    // payment needs: clientId, amount, method, date, extraDetails
    setData(prev => ({
      ...prev,
      payments: [...prev.payments, { ...payment, id: uuidv4(), createdAt: new Date().toISOString() }]
    }));
  };

  const deletePayment = (id) => {
    setData(prev => ({
      ...prev,
      payments: prev.payments.filter(p => p.id !== id)
    }));
  };

  // --- Derived Data Helpers ---

  const getIvaRateForClient = (clientId) => {
    try {
      const condRaw = data.clients.find(c => c.id === clientId)?.ivaCondition;
      const cond = (condRaw || '').toString().trim().toLowerCase();
      return cond === 'exento' ? 0 : 0.21;
    } catch {
      return 0.21;
    }
  };

  const getClientBalance = (clientId) => {
    const clientJobs = data.jobs.filter(j => j.clientId === clientId);
    const clientPayments = data.payments.filter(p => p.clientId === clientId);

    // Sum totals safely (Applying 21% IVA to all Jobs)
    const ivaRate = getIvaRateForClient(clientId);
    const totalJobs = clientJobs.reduce((acc, job) => acc + (Number(job.total) * (1 + ivaRate)), 0);
    const totalPayments = clientPayments.reduce((acc, pay) => acc + (Number(pay.amount) || 0), 0);

    return totalJobs - totalPayments;
  };

  const getClientHistory = (clientId) => {
    const jobs = data.jobs.filter(j => j.clientId === clientId).map(j => ({ ...j, type: 'JOB' }));
    const payments = data.payments.filter(p => p.clientId === clientId).map(p => ({ ...p, type: 'PAYMENT' }));

    return [...jobs, ...payments].sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const updateJob = (id, updates) => {
    setData(prev => ({
      ...prev,
      jobs: prev.jobs.map(j => {
        if (j.id === id) {
          const updatedJob = { ...j, ...updates };
          // Recalculate total if quantity or price changed
          updatedJob.total = Number(updatedJob.quantity) * Number(updatedJob.unitPrice);
          return updatedJob;
        }
        return j;
      })
    }));
  };

  const deleteJob = (id) => {
    setData(prev => ({
      ...prev,
      jobs: prev.jobs.filter(j => j.id !== id)
    }));
  };

  const updatePayment = (id, updates) => {
    setData(prev => ({
      ...prev,
      payments: prev.payments.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  const updateBusinessInfo = (updates) => {
    setData(prev => ({
      ...prev,
      businessInfo: { ...prev.businessInfo, ...updates }
    }));
  };

  // Backup & Restore
  const exportAllData = () => {
    try {
      return JSON.stringify(data);
    } catch {
      return JSON.stringify(INITIAL_STATE);
    }
  };

  const importAllData = (raw) => {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      let normalizedBI = (typeof parsed.businessInfo === 'object' && parsed.businessInfo !== null)
        ? parsed.businessInfo
        : INITIAL_STATE.businessInfo;
      if (normalizedBI && normalizedBI.inmmag && !normalizedBI.inmag) {
        normalizedBI = { ...normalizedBI, inmag: normalizedBI.inmmag };
      }
      if (!('inmagUpdatedAt' in normalizedBI)) {
        normalizedBI = { ...normalizedBI, inmagUpdatedAt: '' };
      }
      if (!('inmagSourceUrl' in normalizedBI)) {
        normalizedBI = { ...normalizedBI, inmagSourceUrl: '' };
      }
      const normalized = {
        clients: Array.isArray(parsed.clients) ? parsed.clients : [],
        practices: Array.isArray(parsed.practices) ? parsed.practices : [],
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
        payments: Array.isArray(parsed.payments) ? parsed.payments : [],
        businessInfo: normalizedBI
      };
      setData({ ...INITIAL_STATE, ...normalized });
      return true;
    } catch (e) {
      console.error('Failed to import data', e);
      return false;
    }
  };

  return (
    <DataContext.Provider value={{
      clients: data.clients,
      practices: data.practices,
      jobs: data.jobs,
      payments: data.payments,
      addClient,
      updateClient,
      deleteClient,
      addPractice,
      updatePractice,
      deletePractice,
      addJob,
      updateJob,
      deleteJob,
      addPayment,
      updatePayment,
      deletePayment,
      getIvaRateForClient,
      getClientBalance,
      getClientHistory,
      businessInfo: data.businessInfo,
      updateBusinessInfo,
      exportAllData,
      importAllData
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
