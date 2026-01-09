import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ArrowLeft, PlusCircle, DollarSign, Calendar, FileText, Pencil, X, Trash2, Printer } from 'lucide-react';

export default function ClientDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { clients, practices, addJob, addPayment, updateJob, deleteJob, getClientHistory, getClientBalance, updateClient, deletePayment, getIvaRateForClient, businessInfo, addAdjustment, deleteAdjustment, agendaEvents } = useData();

    const client = clients.find(c => c.id === id);
    const ivaRate = getIvaRateForClient(id);
    const [reportType, setReportType] = useState('resumen'); // 'resumen' | 'agenda'
    const [agendaFrom, setAgendaFrom] = useState('');
    const [agendaTo, setAgendaTo] = useState('');

    // Calculate History with Running Balance
    const rawHistory = getClientHistory(id);
    // rawHistory is DESC (Newest First). Reverse to get Oldest First for calculation.
    const ascHistory = [...rawHistory].reverse();
    
    let runningNet = 0;
    let runningIVA = 0;

    const historyWithBalance = ascHistory.map(item => {
        let balanceNet = 0;
        let balanceIVA = 0;
        let balanceTotal = 0;
        let deltaNet = 0;
        let deltaIVA = 0;

        if (item.type === 'JOB') {
            const net = Number(item.total);
            runningNet += net;
            runningIVA += (net * ivaRate);
        } else if (item.type === 'PAYMENT') {
            const netPart = Number(item.netImputed) || 0;
            const ivaPart = Number(item.ivaImputed) || 0;
            runningNet -= netPart;
            runningIVA -= ivaPart;
            deltaNet = -netPart;
            deltaIVA = -ivaPart;
        } else if (item.type === 'ADJUSTMENT') {
            if (item.operationType === 'IVA_COMP') {
                const comp = Number(item.amount) || 0;
                runningIVA -= comp;
                deltaNet = 0;
                deltaIVA = -comp;
            } else if (item.operationType === 'DISCOUNT') {
                let pct = Number(item.percentage) || 0;
                if (pct > 1) pct = pct / 100;
                const dNet = runningNet * pct;
                const dIva = runningIVA * pct;
                runningNet -= dNet;
                runningIVA -= dIva;
                deltaNet = -dNet;
                deltaIVA = -dIva;
            }
        }
        
        balanceNet = runningNet;
        balanceIVA = runningIVA;
        balanceTotal = runningNet + runningIVA;

        return { ...item, balanceNet, balanceIVA, balanceTotal, deltaNet, deltaIVA };
    });
    
    const history = historyWithBalance.reverse(); // Back to DESC for display
    
    const balance = getClientBalance(id);
    // balance is now { net, iva, total }

    const [activeTab, setActiveTab] = useState('history'); // history, new_job, new_payment, edit_job, report

    // Job Form State
    const [jobData, setJobData] = useState({
        practiceId: '', practiceName: '', quantity: 1, unitPrice: 0, date: new Date().toLocaleDateString('en-CA'), notes: '', convertToKilos: false
    });
    const [jobCart, setJobCart] = useState([]); // Cart for multi-item entry

    const [editingJob, setEditingJob] = useState(null); // State for job being edited

    // Payment Form State
    const [payData, setPayData] = useState({
        amount: '', netImputed: '', ivaImputed: '', method: 'CASH', date: new Date().toLocaleDateString('en-CA'),
        chequeNumber: '', chequeBank: '', chequeDate: '',
        transferNumber: '', transferBank: '',
        destination: '', // New Field
        cheques: [] // Array for multiple cheques
    });

    // State for new cheque input
    const [newCheque, setNewCheque] = useState({
        bank: '', number: '', date: '', amount: '', destination: ''
    });

    const [reportDates, setReportDates] = useState({
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA'),
        to: new Date().toLocaleDateString('en-CA')
    });
    const [adjustmentForm, setAdjustmentForm] = useState({
        date: new Date().toLocaleDateString('en-CA'),
        type: 'IVA_COMP',
        amount: '',
        percentage: ''
    });
    const [brucelosisForm, setBrucelosisForm] = useState({
        actaDate: client?.sanitary?.brucelosis?.actaDate || '',
        actaNumber: client?.sanitary?.brucelosis?.actaNumber || '',
        sigsaNumber: client?.sanitary?.brucelosis?.sigsaNumber || ''
    });
    const [tbForm, setTbForm] = useState({
        protocoloDate: client?.sanitary?.tuberculosis?.protocoloDate || '',
        protocoloNumber: client?.sanitary?.tuberculosis?.protocoloNumber || ''
    });
    const addMonths = (iso, m) => {
        if (!iso) return '';
        const d = new Date(iso);
        const year = d.getFullYear();
        const month = d.getMonth();
        const day = d.getDate();
        const nd = new Date(year, month + m, day);
        return nd.toLocaleDateString('en-CA');
    };
    const formatDMY = (iso) => {
        if (!iso) return '-';
        const parts = iso.split('-');
        if (parts.length !== 3) return '-';
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };
    const statusFor = (expIso) => {
        if (!expIso) return { label: '-', color: '#64748b', bg: '#f1f5f9' };
        const today = new Date().toLocaleDateString('en-CA');
        const t = new Date(today);
        const e = new Date(expIso);
        const diffMs = e - t;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: 'Vencido', color: 'var(--danger)', bg: 'var(--danger-soft)' };
        if (diffDays <= 30) return { label: 'Por vencer', color: 'var(--warning)', bg: 'var(--warning-soft)' };
        return { label: 'Vigente', color: 'var(--success)', bg: 'var(--success-soft)' };
    };

    if (!client) return <div className="container">Cliente no encontrado.</div>;

    const handlePracticeChange = (pId) => {
        const practice = practices.find(p => p.id === pId);
        if (practice) {
            setJobData({
                ...jobData,
                practiceId: pId,
                practiceName: practice.name,
                unitPrice: practice.defaultPrice,
                notes: practice.leyenda || ''
            });
        }
    };

    const addToCart = (e) => {
        e.preventDefault();
        if (!jobData.practiceId) return;

        // Use unique ID that doesn't depend on browser crypto support
        const tempId = Date.now() + Math.random().toString(36).substring(2, 9);

        // Use functional update to avoid race conditions
        setJobCart(prev => [...prev, { ...jobData, id: tempId }]);

        // Reset only practice but keep the date for speed
        setJobData(prev => ({ ...prev, quantity: 1, practiceId: '', notes: '' }));
    };

    const commitJobs = () => {
        if (jobCart.length === 0) return;
        if (!client.ivaCondition) {
            alert('Bloqueado: el cliente no tiene Condición de IVA. Complete esta información antes de facturar.');
            setShowEditClient(true);
            return;
        }
        jobCart.forEach(job => {
            addJob({ ...job, clientId: id });
        });
        setJobCart([]);
        setActiveTab('history');
        alert(`${jobCart.length} trabajos registrados correctamente`);
    };

    const removeFromCart = (tempId) => {
        setJobCart(jobCart.filter(item => item.id !== tempId));
    };

    const submitPayment = (e) => {
        e.preventDefault();
        const total = Number(payData.amount) || 0;
        const netImp = Number(payData.netImputed) || 0;
        const ivaImp = Number(payData.ivaImputed) || 0;
        if (total <= 0) { alert('Ingrese el Importe total del pago'); return; }
        if (netImp < 0 || ivaImp < 0) { alert('Imputaciones no pueden ser negativas'); return; }
        if ((netImp + ivaImp) > total) { alert('La suma de imputaciones NETO + IVA no puede superar el importe total'); return; }
        
        // Prepare payment object
        const paymentPayload = { ...payData, clientId: id };
        
        // If method is CHEQUE and we have multiple cheques, ensure compatibility
        if (payData.method === 'CHEQUE' && payData.cheques && payData.cheques.length > 0) {
            // We can leave legacy fields empty or put a summary
            paymentPayload.chequeBank = 'Múltiples';
            paymentPayload.chequeNumber = `${payData.cheques.length} cheques`;
        }

        addPayment(paymentPayload);
        
        setPayData({
            ...payData,
            amount: '',
            netImputed: '',
            ivaImputed: '',
            chequeNumber: '', chequeBank: '',
            transferNumber: '', transferBank: '',
            destination: '',
            cheques: []
        });
        setActiveTab('history');
    };

    const addCheque = () => {
        if (!newCheque.bank || !newCheque.number || !newCheque.amount || !newCheque.date) {
            alert('Complete todos los campos del cheque');
            return;
        }
        setPayData(prev => ({
            ...prev,
            cheques: [...prev.cheques, { ...newCheque }],
            amount: (Number(prev.amount || 0) + Number(newCheque.amount)).toFixed(2) // Update total amount
        }));
        setNewCheque({ bank: '', number: '', date: '', amount: '', destination: '' });
    };

    const removeCheque = (index) => {
        const chequeToRemove = payData.cheques[index];
        setPayData(prev => ({
            ...prev,
            cheques: prev.cheques.filter((_, i) => i !== index),
            amount: (Number(prev.amount) - Number(chequeToRemove.amount)).toFixed(2)
        }));
    };

    // Edit Handlers
    const handleEditClick = (job) => {
        setEditingJob({ ...job });
        setActiveTab('edit_job');
    };

    const submitEdit = (e) => {
        e.preventDefault();
        if (editingJob) {
            updateJob(editingJob.id, {
                quantity: editingJob.quantity,
                unitPrice: editingJob.unitPrice,
                date: editingJob.date,
                practiceId: editingJob.practiceId,
                practiceName: editingJob.practiceName,
                notes: editingJob.notes || '',
                convertToKilos: !!editingJob.convertToKilos
            });
            setEditingJob(null);
            setActiveTab('history');
        }
    };

    // Client Edit State
    const [showEditClient, setShowEditClient] = useState(false);
    const [clientForm, setClientForm] = useState({});

    const startEditClient = () => {
        setClientForm({
            name: client.name || '',
            cuit: client.cuit || '',
            renspa: client.renspa || '',
            phone: client.phone || '',
            email: client.email || '',
            address: client.address || '',
            city: client.city || '',
            province: client.province || '',
            ivaCondition: client.ivaCondition || '',
            convertToKilos: client.convertToKilos || false,
            showSanitary: client.showSanitary !== false
        });
        setShowEditClient(true);
    };

    const submitClientEdit = (e) => {
        e.preventDefault();
        updateClient(id, clientForm);
        setShowEditClient(false);
    };

    return (
        <div>

            {showEditClient && (
                <div className="card" style={{ border: '2px solid var(--primary)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>Editar Cliente</h3>
                        <button onClick={() => setShowEditClient(false)} className="btn-icon"><X size={24} /></button>
                    </div>
                    <form onSubmit={submitClientEdit}>
                        <div className="form-group">
                            <label className="form-label">Nombre / Razón Social *</label>
                            <input
                                className="form-input"
                                value={clientForm.name}
                                onChange={e => setClientForm({ ...clientForm, name: e.target.value })}
                                required
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">CUIT</label>
                                <input
                                    className="form-input"
                                    value={clientForm.cuit}
                                    onChange={e => setClientForm({ ...clientForm, cuit: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">RENSPA</label>
                                <input
                                    className="form-input"
                                    value={clientForm.renspa}
                                    onChange={e => setClientForm({ ...clientForm, renspa: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Condición IVA</label>
                            <select
                                className="form-input"
                                value={clientForm.ivaCondition}
                                onChange={e => setClientForm({ ...clientForm, ivaCondition: e.target.value })}
                            >
                                <option value="">Seleccionar...</option>
                                <option value="Responsable Inscripto">Responsable Inscripto</option>
                                <option value="Monotributista">Monotributista</option>
                                <option value="Exento">Exento</option>
                                <option value="Consumidor Final">Consumidor Final</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Teléfono</label>
                            <input
                                className="form-input"
                                type="tel"
                                value={clientForm.phone}
                                onChange={e => setClientForm({ ...clientForm, phone: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Dirección</label>
                            <input
                                className="form-input"
                                value={clientForm.address}
                                onChange={e => setClientForm({ ...clientForm, address: e.target.value })}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Ciudad</label>
                                <input
                                    className="form-input"
                                    value={clientForm.city}
                                    onChange={e => setClientForm({ ...clientForm, city: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Provincia</label>
                                <input
                                    className="form-input"
                                    value={clientForm.province}
                                    onChange={e => setClientForm({ ...clientForm, province: e.target.value })}
                                />
                            </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="editConvertToKilos"
                                    checked={clientForm.convertToKilos || false}
                                    onChange={e => setClientForm({ ...clientForm, convertToKilos: e.target.checked })}
                                    style={{ width: '1.2rem', height: '1.2rem' }}
                                />
                                <label htmlFor="editConvertToKilos" style={{ cursor: 'pointer' }}>Convertir a Kilos Novillo</label>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="editShowSanitary"
                                    checked={clientForm.showSanitary !== false}
                                    onChange={e => setClientForm({ ...clientForm, showSanitary: e.target.checked })}
                                    style={{ width: '1.2rem', height: '1.2rem' }}
                                />
                                <label htmlFor="editShowSanitary" style={{ cursor: 'pointer' }}>Mostrar Información Sanitaria</label>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowEditClient(false)}>Cancelar</button>
                            <button type="submit" className="btn btn-primary">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => navigate(-1)} className="btn-icon">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.75rem' }}>{client.name}</h2>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            {client.ivaCondition === 'Exento' ? (
                                <span className="badge" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: 700 }}>EXENTO</span>
                            ) : (
                                <span className="badge" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>{client.ivaCondition || '-'}</span>
                            )}
                            <span className="badge" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>CUIT: {client.cuit || '-'}</span>
                        </div>
                    </div>
                </div>
                <button onClick={startEditClient} className="btn-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                    <Pencil size={20} />
                </button>
            </div>

            <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark, hsl(221, 83%, 40%)) 100%)',
                color: 'white',
                padding: '2rem',
                borderRadius: 'var(--radius-xl)',
                boxShadow: '0 12px 24px -6px hsla(var(--primary-h), var(--primary-s), var(--primary-l), 0.3)',
                marginBottom: '2rem',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Saldo Total (Neto + IVA)
                    </div>
                    <div style={{ fontSize: '2.55rem', fontWeight: '800', fontFamily: 'Outfit, sans-serif' }}>
                        ${balance.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', marginBottom: '1rem', fontSize: '0.95rem', opacity: 0.95 }}>
                        <span>Neto: <strong>${balance.net.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                        <span style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '1.5rem' }}>IVA {ivaRate === 0 ? '(EXENTO)' : '(21%)'}: <strong>${balance.iva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                    </div>
                    {(client.convertToKilos && Number(businessInfo?.inmag) > 0) && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.95rem', opacity: 0.95 }}>
                            ≈ {(balance.total / Number(businessInfo.inmag)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg novillo (INMAG ${Number(businessInfo.inmag).toLocaleString('es-AR')})
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.85rem', opacity: 0.8 }}>
                        <span>RENSPA: <strong>{client.renspa || '-'}</strong></span>
                        <span>TEL: <strong>{client.phone || '-'}</strong></span>
                    </div>
                </div>
                {/* Decorative circle */}
                <div style={{
                    position: 'absolute',
                    top: '-20%',
                    right: '-10%',
                    width: '180px',
                    height: '180px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '50%',
                    filter: 'blur(40px)'
                }}></div>
            </div>
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '2rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem',
                scrollbarWidth: 'none'
            }}>
                <button
                    className={`btn ${activeTab === 'new_job' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 'none', padding: '0.5rem 1.25rem' }}
                    onClick={() => setActiveTab('new_job')}
                >
                    <PlusCircle size={18} /> Carga de Trabajo
                </button>
                <button
                    className={`btn ${activeTab === 'new_payment' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 'none', padding: '0.5rem 1.25rem' }}
                    onClick={() => setActiveTab('new_payment')}
                >
                    <DollarSign size={18} /> Pago
                </button>
                <button
                    className={`btn ${activeTab === 'new_adjustment' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 'none', padding: '0.5rem 1.25rem' }}
                    onClick={() => setActiveTab('new_adjustment')}
                >
                    <Calendar size={18} /> Ajuste
                </button>
                {(client.showSanitary !== false) && (
                <button
                    className={`btn ${activeTab === 'sanitary' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 'none', padding: '0.5rem 1.25rem' }}
                    onClick={() => setActiveTab('sanitary')}
                >
                    <Calendar size={18} /> Sanitario
                </button>
                )}
                <button
                    className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 'none', padding: '0.5rem 1.25rem' }}
                    onClick={() => setActiveTab('history')}
                >
                    <FileText size={18} /> Resumen
                </button>
                <button
                    className={`btn ${activeTab === 'report' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 'none', padding: '0.5rem 1.25rem' }}
                    onClick={() => setActiveTab('report')}
                >
                    <Printer size={18} /> Reporte
                </button>
            </div>

            {activeTab === 'edit_job' && editingJob && (
                <div className="card" style={{ border: '2px solid var(--primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>Editar Trabajo</h3>
                        <button onClick={() => setActiveTab('history')} className="btn-icon"><X size={24} /></button>
                    </div>
                    <form onSubmit={submitEdit}>
                        <div className="form-group">
                            <label className="form-label">Fecha</label>
                            <input
                                type="date"
                                className="form-input"
                                value={editingJob.date}
                                onChange={e => setEditingJob({ ...editingJob, date: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Práctica</label>
                            <input className="form-input" value={editingJob.practiceName} disabled style={{ background: '#f0f0f0' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Cantidad</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={editingJob.quantity}
                                    onChange={e => setEditingJob({ ...editingJob, quantity: e.target.value })}
                                    min="1"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Precio Unit.</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={editingJob.unitPrice}
                                    onChange={e => setEditingJob({ ...editingJob, unitPrice: e.target.value })}
                                    step="0.01"
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Leyenda</label>
                            <textarea
                                className="form-input"
                                rows="2"
                                style={{ resize: 'none' }}
                                value={editingJob.notes || ''}
                                onChange={e => setEditingJob({ ...editingJob, notes: e.target.value })}
                            ></textarea>
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                id="convertToKilosEdit"
                                checked={!!editingJob.convertToKilos}
                                onChange={e => setEditingJob({ ...editingJob, convertToKilos: e.target.checked })}
                            />
                            <label htmlFor="convertToKilosEdit" className="form-label" style={{ margin: 0 }}>Transformar a kilos de novillo</label>
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: 'bold', marginBottom: '1rem' }}>
                            Nuevo Total: ${(editingJob.quantity * editingJob.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar Cambios</button>
                    </form>
                </div>
            )}

            {activeTab === 'new_job' && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0 }}>Carga de Trabajo</h3>
                        {jobCart.length > 0 && (
                            <span className="badge" style={{ background: 'var(--primary)', color: 'white' }}>
                                {jobCart.length} item{jobCart.length > 1 ? 's' : ''} listo{jobCart.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {/* Temporary Cart List */}
                    {jobCart.length > 0 && (
                        <div style={{ marginBottom: '1.5rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                            <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Lista para guardar
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {jobCart.map((item) => (
                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-hover)' }}>
                                        <div>
                                            <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.practiceName}</div>
                                            {item.notes && (
                                                <div className="text-muted text-sm" style={{ marginTop: '2px' }}>
                                                    {item.notes}
                                                </div>
                                            )}
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.quantity} x ${item.unitPrice}</div>
                                            {((item.convertToKilos || client.convertToKilos) && Number(businessInfo?.inmag) > 0) && (
                                                <div className="text-muted text-sm">
                                                    ≈ {(Number(item.quantity) * Number(item.unitPrice) / Number(businessInfo.inmag)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg novillo (INMAG ${Number(businessInfo.inmag).toLocaleString('es-AR')})
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>${(item.quantity * item.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                            <button onClick={() => removeFromCart(item.id)} className="btn-icon" style={{ color: 'var(--danger)', padding: '4px' }} title="Quitar">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--surface-hover)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold' }}>Total Provisorio:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary)' }}>
                                    ${jobCart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    )}

                    <form onSubmit={addToCart} style={{ background: 'var(--surface-hover)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--primary-soft)' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Agregar Item</h4>
                        <div className="form-group">
                            <label className="form-label">Fecha</label>
                            <input type="date" className="form-input" value={jobData.date} onChange={e => setJobData({ ...jobData, date: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Práctica / Medicamento</label>
                            <select
                                className="form-input"
                                value={jobData.practiceId}
                                onChange={e => handlePracticeChange(e.target.value)}
                                required
                            >
                                <option value="">Seleccionar...</option>
                                <optgroup label="Prácticas">
                                    {practices
                                        .filter(p => !p.type || p.type === 'SERVICE')
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))
                                    }
                                </optgroup>
                                <optgroup label="Medicamentos">
                                    {practices
                                        .filter(p => p.type === 'PRODUCT')
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))
                                    }
                                </optgroup>
                            </select>
                        </div>
                        {jobData.practiceId && (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Cantidad</label>
                                        <input type="number" className="form-input" value={jobData.quantity} onChange={e => setJobData({ ...jobData, quantity: e.target.value })} min="1" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Precio Unit.</label>
                                        <input type="number" className="form-input" value={jobData.unitPrice} onChange={e => setJobData({ ...jobData, unitPrice: e.target.value })} step="0.01" required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Leyenda</label>
                                    <textarea
                                        className="form-input"
                                        rows="2"
                                        style={{ resize: 'none' }}
                                        placeholder="Texto adicional para este movimiento"
                                        value={jobData.notes}
                                        onChange={e => setJobData({ ...jobData, notes: e.target.value })}
                                    ></textarea>
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        id="convertToKilos"
                                        checked={jobData.convertToKilos}
                                        onChange={e => setJobData({ ...jobData, convertToKilos: e.target.checked })}
                                    />
                                    <label htmlFor="convertToKilos" className="form-label" style={{ margin: 0 }}>Transformar a kilos de novillo</label>
                                </div>
                                <div style={{ textAlign: 'right', fontWeight: 'bold', marginBottom: '1rem' }}>
                                    Subtotal: ${(jobData.quantity * jobData.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </>
                        )}
                        <button type="submit" className="btn btn-secondary" style={{ width: '100%', border: '1px solid var(--primary-soft)' }}>
                            <PlusCircle size={18} /> Agregar a la Lista
                        </button>
                    </form>

                    {jobCart.length > 0 && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', fontSize: '1rem' }}
                            onClick={commitJobs}
                        >
                            Confirmar y Guardar Todos los Trabajos
                        </button>
                    )}
                </div>
            )}

            {activeTab === 'new_payment' && (
                <div className="card">
                    <h3>Registrar Pago</h3>
                    <form onSubmit={submitPayment}>
                        <div className="form-group">
                            <label className="form-label">Fecha del Pago</label>
                            <input type="date" className="form-input" value={payData.date} onChange={e => setPayData({ ...payData, date: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Monto Total</label>
                            <input 
                                type="number" 
                                className="form-input" 
                                value={payData.amount} 
                                onChange={e => setPayData({ ...payData, amount: e.target.value })} 
                                step="0.01" 
                                required 
                                readOnly={payData.method === 'CHEQUE'} // Read-only for cheques as it's sum
                                style={payData.method === 'CHEQUE' ? { background: '#f0f0f0' } : {}}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Forma de Pago</label>
                            <select className="form-input" value={payData.method} onChange={e => setPayData({ ...payData, method: e.target.value })}>
                                <option value="CASH">Efectivo</option>
                                <option value="TRANSFER">Transferencia</option>
                                <option value="CHEQUE">Cheque</option>
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Imputación a NETO</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    value={payData.netImputed} 
                                    onChange={e => setPayData({ ...payData, netImputed: e.target.value })} 
                                    step="0.01" 
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Imputación a IVA</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    value={payData.ivaImputed} 
                                    onChange={e => setPayData({ ...payData, ivaImputed: e.target.value })} 
                                    step="0.01" 
                                    required 
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Destino (Opcional)</label>
                            <input
                                className="form-input"
                                placeholder="Ej: Caja, Banco X, Billetera"
                                value={payData.destination}
                                onChange={e => setPayData({ ...payData, destination: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Notas / Leyenda (Opcional)</label>
                            <input
                                className="form-input"
                                placeholder="Comentarios adicionales..."
                                value={payData.notes || ''}
                                onChange={e => setPayData({ ...payData, notes: e.target.value })}
                            />
                        </div>

                        {payData.method === 'CHEQUE' && (
                            <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                                <h4 className="text-sm" style={{ marginBottom: '0.5rem' }}>Carga de Cheques</h4>
                                
                                {/* List of added cheques */}
                                {payData.cheques.length > 0 && (
                                    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {payData.cheques.map((c, index) => (
                                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-hover)' }}>
                                                <div style={{ fontSize: '0.85rem' }}>
                                                    <div><strong>{c.bank}</strong> - #{c.number}</div>
                                                    <div className="text-muted">${Number(c.amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - {c.date}</div>
                                                </div>
                                                <button type="button" onClick={() => removeCheque(index)} className="btn-icon" style={{ color: 'var(--danger)' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                            Total Cheques: ${payData.cheques.reduce((sum, c) => sum + Number(c.amount), 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                )}

                                {/* New Cheque Form */}
                                <div style={{ background: 'white', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--primary-soft)' }}>
                                    <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Nuevo Cheque</h5>
                                    <div className="form-group"><input placeholder="Banco" className="form-input" value={newCheque.bank} onChange={e => setNewCheque({ ...newCheque, bank: e.target.value })} /></div>
                                    <div className="form-group"><input placeholder="Número" className="form-input" value={newCheque.number} onChange={e => setNewCheque({ ...newCheque, number: e.target.value })} /></div>
                                    <div className="form-group"><input type="number" placeholder="Monto" className="form-input" value={newCheque.amount} onChange={e => setNewCheque({ ...newCheque, amount: e.target.value })} /></div>
                                    <div className="form-group"><label className="text-sm">Fecha Cobro</label><input type="date" className="form-input" value={newCheque.date} onChange={e => setNewCheque({ ...newCheque, date: e.target.value })} /></div>
                                    <div className="form-group"><input placeholder="Destino (Opcional)" className="form-input" value={newCheque.destination} onChange={e => setNewCheque({ ...newCheque, destination: e.target.value })} /></div>
                                    
                                    <button type="button" onClick={addCheque} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }}>
                                        <PlusCircle size={16} style={{ marginRight: '4px' }} /> Agregar Cheque
                                    </button>
                                </div>
                            </div>
                        )}

                        {payData.method === 'TRANSFER' && (
                            <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                                <h4 className="text-sm" style={{ marginBottom: '0.5rem' }}>Datos de Transferencia</h4>
                                <div className="form-group"><input placeholder="Número de Comprobante / ID" className="form-input" value={payData.transferNumber} onChange={e => setPayData({ ...payData, transferNumber: e.target.value })} /></div>
                                <div className="form-group"><input placeholder="Banco Origen / Destino" className="form-input" value={payData.transferBank} onChange={e => setPayData({ ...payData, transferBank: e.target.value })} /></div>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Registrar Pago</button>
                    </form>
                </div>
            )}

            {activeTab === 'new_adjustment' && (
                <div className="card">
                    <h3>Agregar Ajuste</h3>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (adjustmentForm.type === 'IVA_COMP') {
                                if (!adjustmentForm.amount) return;
                                addAdjustment({
                                    clientId: id,
                                    date: adjustmentForm.date,
                                    operationType: 'IVA_COMP',
                                    amount: adjustmentForm.amount
                                });
                            } else {
                                if (!adjustmentForm.percentage) return;
                                addAdjustment({
                                    clientId: id,
                                    date: adjustmentForm.date,
                                    operationType: 'DISCOUNT',
                                    percentage: adjustmentForm.percentage
                                });
                            }
                            setAdjustmentForm({
                                date: new Date().toLocaleDateString('en-CA'),
                                type: 'IVA_COMP',
                                amount: '',
                                percentage: ''
                            });
                            setActiveTab('history');
                        }}
                    >
                        <div className="form-group">
                            <label className="form-label">Fecha</label>
                            <input
                                type="date"
                                className="form-input"
                                value={adjustmentForm.date}
                                onChange={e => setAdjustmentForm({ ...adjustmentForm, date: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tipo de Ajuste</label>
                            <select
                                className="form-input"
                                value={adjustmentForm.type}
                                onChange={e => setAdjustmentForm({ ...adjustmentForm, type: e.target.value })}
                            >
                                <option value="IVA_COMP">Compensación de IVA</option>
                                <option value="DISCOUNT">Descuento porcentual</option>
                            </select>
                        </div>
                        {adjustmentForm.type === 'IVA_COMP' ? (
                            <div className="form-group">
                                <label className="form-label">Monto</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={adjustmentForm.amount}
                                    onChange={e => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                                    step="0.01"
                                    required
                                />
                            </div>
                        ) : (
                            <div className="form-group">
                                <label className="form-label">Porcentaje</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={adjustmentForm.percentage}
                                    onChange={e => setAdjustmentForm({ ...adjustmentForm, percentage: e.target.value })}
                                    step="0.01"
                                    placeholder="Ej: 10 para 10%"
                                    required
                                />
                            </div>
                        )}
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Agregar Ajuste</button>
                    </form>
                </div>
            )}
            {activeTab === 'sanitary' && (
                <div className="card">
                    <h3>Apartado Sanitario</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <h4 style={{ marginTop: 0 }}>Carpeta de Brucelosis</h4>
                            <div className="form-group">
                                <label className="form-label">Fecha Acta de Sangrado</label>
                                <input type="date" className="form-input" value={brucelosisForm.actaDate} onChange={e => setBrucelosisForm({ ...brucelosisForm, actaDate: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">N° Acta de Sangrado</label>
                                <input className="form-input" value={brucelosisForm.actaNumber} onChange={e => setBrucelosisForm({ ...brucelosisForm, actaNumber: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">N° Constancia SIGSA</label>
                                <input className="form-input" value={brucelosisForm.sigsaNumber} onChange={e => setBrucelosisForm({ ...brucelosisForm, sigsaNumber: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Vencimiento: <strong>{formatDMY(addMonths(brucelosisForm.actaDate, 12))}</strong>
                                </div>
                                {(() => {
                                    const s = statusFor(addMonths(brucelosisForm.actaDate, 12));
                                    return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
                                })()}
                            </div>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '0.75rem' }}
                                onClick={() => {
                                    const current = client.sanitary || {};
                                    const updated = { ...current, brucelosis: { ...brucelosisForm } };
                                    updateClient(id, { sanitary: updated });
                                }}
                            >
                                Guardar Brucelosis
                            </button>
                        </div>
                        <div>
                            <h4 style={{ marginTop: 0 }}>Carpeta de Tuberculosis</h4>
                            <div className="form-group">
                                <label className="form-label">Fecha del Protocolo</label>
                                <input type="date" className="form-input" value={tbForm.protocoloDate} onChange={e => setTbForm({ ...tbForm, protocoloDate: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">N° de Protocolo</label>
                                <input className="form-input" value={tbForm.protocoloNumber} onChange={e => setTbForm({ ...tbForm, protocoloNumber: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Vencimiento: <strong>{formatDMY(addMonths(tbForm.protocoloDate, 12))}</strong>
                                </div>
                                {(() => {
                                    const s = statusFor(addMonths(tbForm.protocoloDate, 12));
                                    return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
                                })()}
                            </div>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '0.75rem' }}
                                onClick={() => {
                                    const current = client.sanitary || {};
                                    const updated = { ...current, tuberculosis: { ...tbForm } };
                                    updateClient(id, { sanitary: updated });
                                }}
                            >
                                Guardar Tuberculosis
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="table-wrapper">
                        <table style={{ fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--background)' }}>
                                    <th>Fecha</th>
                                    <th>Detalle</th>
                                    <th style={{ textAlign: 'right' }}>Neto</th>
                                    <th style={{ textAlign: 'right' }}>IVA {ivaRate === 0 ? '(EXENTO)' : '(21%)'}</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                    <th style={{ textAlign: 'right' }}>Kilos</th>
                                    <th style={{ textAlign: 'right', color: 'var(--success)' }}>Pagos</th>
                                    <th style={{ textAlign: 'right', fontWeight: 'bold' }}>Saldo</th>
                                    <th style={{ width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Sin movimientos</td></tr>
                                ) : (
                                    history
                                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                                        .map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.date.split('-').reverse().join('/')}</td>
                                            <td>
                                                {item.type === 'JOB' ? (
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>{item.practiceName}</div>
                                                        {practices.find(p => p.id === item.practiceId)?.leyenda && (
                                                            <div className="text-muted text-sm" style={{ marginTop: '2px' }}>
                                                                {practices.find(p => p.id === item.practiceId)?.leyenda}
                                                            </div>
                                                        )}
                                                        {item.notes && (
                                                            <div className="text-muted text-sm" style={{ marginTop: '2px' }}>
                                                                {item.notes}
                                                            </div>
                                                        )}
                                                        <div className="text-muted text-sm">
                                                            {item.quantity} x ${item.unitPrice}
                                                    </div>
                                                    {((item.convertToKilos || client.convertToKilos) && Number(businessInfo?.inmag) > 0) && (
                                                        <div className="text-muted text-sm">
                                                            ≈ {(Number(item.total) / Number(businessInfo.inmag)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg novillo (INMAG ${Number(businessInfo.inmag).toLocaleString('es-AR')})
                                                        </div>
                                                    )}
                                                    </div>
                                                ) : item.type === 'PAYMENT' ? (
                                                    <div>
                                                        <div style={{ fontWeight: 500, color: 'var(--success)' }}>
                                                            PAGO ({item.method})
                                                        </div>
                                                        {item.destination && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>Destino: {item.destination}</div>}
                                                        {item.notes && <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#888' }}>"{item.notes}"</div>}
                                                        <div className="text-muted text-sm">Imputaciones: Neto ${Number(item.netImputed || 0).toLocaleString('es-AR')} · IVA ${Number(item.ivaImputed || 0).toLocaleString('es-AR')}</div>
                                                        {item.method === 'CHEQUE' && (
                                                            <div className="text-muted text-sm">
                                                                {item.cheques && item.cheques.length > 0 ? (
                                                                    <div style={{ marginTop: '2px' }}>
                                                                        <div style={{ fontWeight: 600 }}>Múltiples cheques ({item.cheques.length}):</div>
                                                                        {item.cheques.map((c, idx) => (
                                                                            <div key={idx} style={{ paddingLeft: '0.5rem', fontSize: '0.75rem' }}>
                                                                                • {c.bank} #{c.number} (${Number(c.amount).toLocaleString('es-AR')})
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div>#{item.chequeNumber} - {item.chequeBank}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {item.method === 'TRANSFER' && <div className="text-muted text-sm">#{item.transferNumber} - {item.transferBank}</div>}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div style={{ fontWeight: 500, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {item.operationType === 'IVA_COMP' ? 'AJUSTE: Compensación IVA' : `AJUSTE: Descuento ${Number(item.percentage) > 1 ? Number(item.percentage) + '%' : (Number(item.percentage) * 100).toFixed(0) + '%'}`}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                                {item.type === 'JOB'
                                                    ? `$${Number(item.total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    : item.type === 'PAYMENT'
                                                        ? `${-Number(item.netImputed || 0) < 0 ? '-' : ''}$${Math.abs(Number(item.netImputed || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                        : (item.type === 'ADJUSTMENT' && item.deltaNet)
                                                            ? `${item.deltaNet < 0 ? '-' : ''}$${Math.abs(item.deltaNet).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                            : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                                {item.type === 'JOB'
                                                    ? `$${(Number(item.total) * ivaRate).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    : item.type === 'PAYMENT'
                                                        ? `${-Number(item.ivaImputed || 0) < 0 ? '-' : ''}$${Math.abs(Number(item.ivaImputed || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                        : (item.type === 'ADJUSTMENT' && item.deltaIVA)
                                                            ? `${item.deltaIVA < 0 ? '-' : ''}$${Math.abs(item.deltaIVA).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                            : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                                {item.type === 'JOB' ? `$${(Number(item.total) * (1 + ivaRate)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {(item.type === 'JOB' && item.convertToKilos && Number(businessInfo?.inmag) > 0)
                                                    ? (Number(item.total) / Number(businessInfo.inmag)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                    : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 500 }}>
                                                {item.type === 'PAYMENT' ? `$${Number(item.amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                                                <div>${item.balanceTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                                <div style={{ fontSize: '0.7em', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                                                    Neto: ${item.balanceNet.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    {item.type === 'JOB' && (
                                                        <button
                                                            onClick={() => handleEditClick(item)}
                                                            className="btn-icon"
                                                            style={{ color: 'var(--text-secondary)' }}
                                                            title="Editar"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm(`¿Eliminar ${item.type === 'JOB' ? 'trabajo' : item.type === 'PAYMENT' ? 'pago' : 'ajuste'}?`)) {
                                                                if (item.type === 'JOB') deleteJob(item.id);
                                                                else if (item.type === 'PAYMENT') deletePayment(item.id);
                                                                else deleteAdjustment(item.id);
                                                            }
                                                        }}
                                                        className="btn-icon"
                                                        style={{ color: 'var(--danger)' }}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {history.length > 0 && (
                                <tfoot style={{ background: 'var(--surface-hover)', fontWeight: 'bold' }}>
                                    <tr>
                                        <td colSpan="2" style={{ textAlign: 'right', padding: '1rem 0.5rem' }}>Totales:</td>
                                        <td style={{ textAlign: 'right', padding: '1rem 0.5rem' }}>
                                            ${history.reduce((sum, item) => sum + (item.type === 'JOB' ? Number(item.total) : 0), 0).toLocaleString('es-AR')}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '1rem 0.5rem' }}>
                                            ${(history.reduce((sum, item) => sum + (item.type === 'JOB' ? Number(item.total) : 0), 0) * ivaRate).toLocaleString('es-AR')}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '1rem 0.5rem' }}>
                                            ${(history.reduce((sum, item) => sum + (item.type === 'JOB' ? Number(item.total) : 0), 0) * (1 + ivaRate)).toLocaleString('es-AR')}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '1rem 0.5rem' }}>
                                            {history.reduce((sum, item) => {
                                                if (item.type === 'JOB' && item.convertToKilos && Number(businessInfo?.inmag) > 0) {
                                                    return sum + (Number(item.total) / Number(businessInfo.inmag));
                                                }
                                                return sum;
                                            }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '1rem 0.5rem', color: 'var(--success)' }}>
                                            ${history.reduce((sum, item) => sum + (item.type === 'PAYMENT' ? Number(item.amount) : 0), 0).toLocaleString('es-AR')}
                                        </td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'report' && (
                <div className="card">
                    <h3>Reporte por Cliente</h3>
                    <div className="no-print" style={{ display: 'flex', gap: '1rem', margin: '0.75rem 0 1rem 0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input type="radio" name="repotype" checked={reportType === 'resumen'} onChange={() => setReportType('resumen')} />
                            Resumen de cuenta
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input type="radio" name="repotype" checked={reportType === 'agenda'} onChange={() => setReportType('agenda')} />
                            Agenda
                        </label>
                    </div>
                    {reportType === 'resumen' && (
                        <>
                            <p className="text-muted text-sm" style={{ marginBottom: '1.5rem' }}>
                                Seleccione el rango de fechas para el resumen. Se calculará el saldo anterior a la fecha de inicio automáticamente.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Desde</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={reportDates.from}
                                        onChange={e => setReportDates({ ...reportDates, from: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hasta</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={reportDates.to}
                                        onChange={e => setReportDates({ ...reportDates, to: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                onClick={() => navigate(`/reports/custom-statement/${id}/${reportDates.from}/${reportDates.to}`)}
                            >
                                <Printer size={18} /> Ver Reporte Imprimible
                            </button>
                        </>
                    )}
                    {reportType === 'agenda' && (
                        <>
                            <div className="card" style={{ marginTop: '0.5rem', paddingBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0 }}>{client.name}</h3>
                                        <div className="text-secondary text-sm">IVA: {client.ivaCondition || '-'}</div>
                                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {(() => {
                                                const addMonths = (iso, m) => {
                                                    if (!iso) return '';
                                                    const d = new Date(iso);
                                                    return new Date(d.getFullYear(), d.getMonth() + m, d.getDate()).toLocaleDateString('en-CA');
                                                };
                                                const formatDMY = (iso) => {
                                                    if (!iso) return '-';
                                                    const [y, mm, dd] = iso.split('-');
                                                    return `${dd}/${mm}/${y}`;
                                                };
                                                const statusFor = (expIso) => {
                                                    if (!expIso) return { label: '-', color: '#64748b', bg: '#f1f5f9' };
                                                    const t = new Date(new Date().toLocaleDateString('en-CA'));
                                                    const e = new Date(expIso);
                                                    const diffDays = Math.ceil((e - t) / (1000 * 60 * 60 * 24));
                                                    if (diffDays < 0) return { label: 'Vencido', color: 'var(--danger)', bg: 'var(--danger-soft)' };
                                                    if (diffDays <= 30) return { label: 'Por vencer', color: 'var(--warning)', bg: 'var(--warning-soft)' };
                                                    return { label: 'Vigente', color: 'var(--success)', bg: 'var(--success-soft)' };
                                                };
                                                const acta = client?.sanitary?.brucelosis?.actaDate || '';
                                                const proto = client?.sanitary?.tuberculosis?.protocoloDate || '';
                                                const expB = addMonths(acta, 12);
                                                const expT = addMonths(proto, 12);
                                                const sB = statusFor(expB);
                                                const sT = statusFor(expT);
                                                return (
                                                    <>
                                                        <span className="badge" style={{ background: sB.bg, color: sB.color }}>Brucelosis: {formatDMY(expB)} · {sB.label}</span>
                                                        <span className="badge" style={{ background: sT.bg, color: sT.color }}>Tuberculosis: {formatDMY(expT)} · {sT.label}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    <div className="no-print" style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">Desde</label>
                                            <input type="date" className="form-input" value={agendaFrom} onChange={e => setAgendaFrom(e.target.value)} />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">Hasta</label>
                                            <input type="date" className="form-input" value={agendaTo} onChange={e => setAgendaTo(e.target.value)} />
                                        </div>
                                        <button className="btn btn-primary" onClick={() => navigate(`/reports/agenda-statement/${id}/${agendaFrom || ''}/${agendaTo || ''}`)}><Printer size={16} /> Ver Agenda Imprimible</button>
                                    </div>
                                </div>
                            </div>
                            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1rem' }}>
                                <div className="table-wrapper">
                                    <table style={{ fontSize: '0.875rem' }}>
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Hora</th>
                                                <th>Trabajo / Servicio</th>
                                                <th>Observaciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {agendaEvents
                                                .filter(e => e.clientId === id)
                                                .filter(e => {
                                                    if (agendaFrom && e.date < agendaFrom) return false;
                                                    if (agendaTo && e.date > agendaTo) return false;
                                                    return true;
                                                })
                                                .sort((a, b) => new Date(a.date) - new Date(b.date) || (a.time || '').localeCompare(b.time || ''))
                                                .map(e => (
                                                    <tr key={e.id}>
                                                        <td>{e.date.split('-').reverse().join('/')}</td>
                                                        <td>{e.time || '-'}</td>
                                                        <td>{e.title}</td>
                                                        <td>{e.notes || '-'}</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
