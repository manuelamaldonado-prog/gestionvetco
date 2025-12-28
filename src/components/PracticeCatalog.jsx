import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Plus, Tag, Edit2, Pill, Stethoscope, Trash2 } from 'lucide-react';

export default function PracticeCatalog() {
    const { practices, addPractice, updatePractice, deletePractice, businessInfo, updateBusinessInfo, exportAllData, importAllData } = useData();
    const [showForm, setShowForm] = useState(false);
    const [activeTab, setActiveTab] = useState('SERVICE'); // SERVICE, PRODUCT, ACCOUNT
    const [formData, setFormData] = useState({ name: '', defaultPrice: '', type: 'SERVICE', leyenda: '' });
    const [bizFormData, setBizFormData] = useState(businessInfo || {
        name: '',
        cuit: '',
        inmag: '',
        inmagSourceUrl: '',
        bank: '',
        accountNumber: '',
        cbu: '',
        alias: '',
        phone: '',
        email: '',
        extraDetails: ''
    });
    const [editingId, setEditingId] = useState(null);
    const fetchInmagFromUrl = async () => {
        const url = bizFormData.inmagSourceUrl;
        if (!url) {
            alert('Ingrese el enlace del INMAG');
            return;
        }
        try {
            const res = await fetch(url, { cache: 'no-store' });
            const txt = await res.text();
            let val = NaN;
            try {
                const j = JSON.parse(txt);
                const cand = j.inmag ?? j.value ?? j.price ?? j.data ?? j;
                val = Number(typeof cand === 'string' ? cand.replace(/\./g, '').replace(',', '.') : cand);
            } catch {
                const m = txt.match(/[\d.,]+/);
                if (m) val = Number(m[0].replace(/\./g, '').replace(',', '.'));
            }
            if (!isFinite(val) || val <= 0) {
                alert('No se pudo obtener un INMAG válido');
                return;
            }
            const vstr = String(val);
            updateBusinessInfo({ inmag: vstr, inmagUpdatedAt: new Date().toISOString(), inmagSourceUrl: url });
            setBizFormData({ ...bizFormData, inmag: vstr });
            alert('INMAG actualizado automáticamente');
        } catch {
            alert('No se pudo consultar el enlace. Verifique CORS y formato');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.defaultPrice) return;

        if (editingId) {
            updatePractice(editingId, formData);
        } else {
            addPractice(formData);
        }

        resetForm();
    };

    const resetForm = () => {
        setFormData({ name: '', defaultPrice: '', type: activeTab, leyenda: '' });
        setEditingId(null);
        setShowForm(false);
    };

    const handleEdit = (practice) => {
        setFormData({
            name: practice.name,
            defaultPrice: practice.defaultPrice,
            type: practice.type || 'SERVICE',
            leyenda: practice.leyenda || ''
        });
        setEditingId(practice.id);
        setShowForm(true);
    };

    const filteredItems = practices.filter(p => {
        const pType = p.type || 'SERVICE';
        return pType === activeTab;
    });
    const sortedItems = [...filteredItems].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>Configuración</h2>
                {activeTab !== 'ACCOUNT' && (
                    <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(!showForm); }}>
                        <Plus size={20} /> Nuevo
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--surface-hover)', paddingBottom: '0.5rem' }}>
                <button
                    className={`btn ${activeTab === 'SERVICE' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('SERVICE')}
                    style={{ flex: 1, justifyContent: 'center', gap: '8px' }}
                >
                    <Stethoscope size={18} /> Prácticas
                </button>
                <button
                    className={`btn ${activeTab === 'PRODUCT' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('PRODUCT')}
                    style={{ flex: 1, justifyContent: 'center', gap: '8px' }}
                >
                    <Pill size={18} /> Medicamentos
                </button>
                <button
                    className={`btn ${activeTab === 'INMAG' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('INMAG')}
                    style={{ flex: 1, justifyContent: 'center', gap: '8px' }}
                >
                    <Tag size={18} /> INMAG
                </button>
                <button
                    className={`btn ${activeTab === 'ACCOUNT' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('ACCOUNT')}
                    style={{ flex: 1, justifyContent: 'center', gap: '8px' }}
                >
                    <Edit2 size={18} /> Mi Cuenta
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ borderLeft: `4px solid ${editingId ? 'var(--accent)' : 'var(--primary)'}` }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>{editingId ? 'Editar Ítem' : 'Nuevo Ítem'}</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Tipo</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'SERVICE' })}
                                    className={formData.type === 'SERVICE' ? 'btn btn-primary' : 'btn btn-secondary'}
                                    style={{ flex: 1, justifyContent: 'center', gap: '6px' }}
                                >
                                    <Stethoscope size={18} /> Práctica
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'PRODUCT' })}
                                    className={formData.type === 'PRODUCT' ? 'btn btn-primary' : 'btn btn-secondary'}
                                    style={{ flex: 1, justifyContent: 'center', gap: '6px' }}
                                >
                                    <Pill size={18} /> Medicamento
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nombre</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder={formData.type === 'SERVICE' ? "Ej. Tacto Rectal" : "Ej. Antibiótico 500ml"}
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Precio Unitario Sugerido ($)</label>
                            <input
                                className="form-input"
                                type="number"
                                placeholder="0.00"
                                value={formData.defaultPrice}
                                onChange={e => setFormData({ ...formData, defaultPrice: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Leyenda</label>
                            <textarea
                                className="form-input"
                                rows="2"
                                style={{ resize: 'none' }}
                                placeholder="Texto adicional que acompaña la práctica/medicamento"
                                value={formData.leyenda}
                                onChange={e => setFormData({ ...formData, leyenda: e.target.value })}
                            ></textarea>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
                            <button type="submit" className="btn btn-primary">{editingId ? 'Guardar Cambios' : 'Guardar'}</button>
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'INMAG' && (
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem' }}>INMAG</h3>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const updates = { inmag: bizFormData.inmag || '' };
                        if ((businessInfo?.inmag || '') !== (bizFormData?.inmag || '')) {
                            updates.inmagUpdatedAt = new Date().toISOString();
                        }
                        updateBusinessInfo(updates);
                        alert('INMAG actualizado correctamente');
                    }}>
                        <div className="form-group">
                            <label className="form-label">Valor INMAG</label>
                            <input
                                className="form-input"
                                type="text"
                                value={bizFormData.inmag || ''}
                                onChange={e => setBizFormData({ ...bizFormData, inmag: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Enlace para actualizar INMAG</label>
                            <input
                                className="form-input"
                                type="url"
                                placeholder="https://..."
                                value={bizFormData.inmagSourceUrl || ''}
                                onChange={e => setBizFormData({ ...bizFormData, inmagSourceUrl: e.target.value })}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={fetchInmagFromUrl} style={{ flex: 1 }}>
                                Actualizar desde enlace
                            </button>
                        </div>
                        <div className="text-sm text-muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
                            Última actualización: {businessInfo?.inmagUpdatedAt ? new Date(businessInfo.inmagUpdatedAt).toLocaleDateString('es-AR') : '-'}
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar</button>
                    </form>
                </div>
            )}

            {activeTab === 'ACCOUNT' && (
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem' }}>Datos de mi Cuenta</h3>
                    <p className="text-muted text-sm" style={{ marginBottom: '1.5rem' }}>
                        Estos datos aparecerán al final de los reportes y resúmenes de cuenta de tus clientes.
                    </p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const updates = { ...bizFormData };
                        if ((businessInfo?.inmag || '') !== (bizFormData?.inmag || '')) {
                            updates.inmagUpdatedAt = new Date().toISOString();
                        }
                        updateBusinessInfo(updates);
                        alert('Datos actualizados correctamente');
                    }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Nombre / Titular</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={bizFormData.name}
                                    onChange={e => setBizFormData({ ...bizFormData, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">CUIT</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={bizFormData.cuit}
                                    onChange={e => setBizFormData({ ...bizFormData, cuit: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">INMAG</label>
                            <input
                                className="form-input"
                                type="text"
                                value={bizFormData.inmag || ''}
                                onChange={e => setBizFormData({ ...bizFormData, inmag: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Enlace para actualizar INMAG</label>
                            <input
                                className="form-input"
                                type="url"
                                placeholder="https://..."
                                value={bizFormData.inmagSourceUrl || ''}
                                onChange={e => setBizFormData({ ...bizFormData, inmagSourceUrl: e.target.value })}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={fetchInmagFromUrl} style={{ flex: 1 }}>
                                Actualizar INMAG automáticamente
                            </button>
                        </div>
                        <div className="text-sm text-muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
                            Última actualización: {businessInfo?.inmagUpdatedAt ? new Date(businessInfo.inmagUpdatedAt).toLocaleDateString('es-AR') : '-'}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Banco</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={bizFormData.bank}
                                    onChange={e => setBizFormData({ ...bizFormData, bank: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nº de Cuenta</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={bizFormData.accountNumber}
                                    onChange={e => setBizFormData({ ...bizFormData, accountNumber: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">CBU</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={bizFormData.cbu}
                                    onChange={e => setBizFormData({ ...bizFormData, cbu: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Alias</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={bizFormData.alias}
                                    onChange={e => setBizFormData({ ...bizFormData, alias: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Detalles de Pago Extra / CVU</label>
                            <textarea
                                className="form-input"
                                rows="2"
                                style={{ resize: 'none' }}
                                value={bizFormData.extraDetails}
                                onChange={e => setBizFormData({ ...bizFormData, extraDetails: e.target.value })}
                            ></textarea>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Teléfono de Contacto</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={bizFormData.phone}
                                    onChange={e => setBizFormData({ ...bizFormData, phone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    className="form-input"
                                    type="email"
                                    value={bizFormData.email}
                                    onChange={e => setBizFormData({ ...bizFormData, email: e.target.value })}
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                            Guardar Cambios
                        </button>
                    </form>
                    <div style={{ borderTop: '1px solid var(--surface-hover)', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Respaldos</h3>
                        <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
                            Exporta tus datos a un archivo JSON para usarlos en otro dispositivo, o importa un respaldo para sincronizar.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    try {
                                        const json = exportAllData();
                                        const blob = new Blob([json], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `comervet-respaldo-${new Date().toISOString().slice(0,10)}.json`;
                                        document.body.appendChild(a);
                                        a.click();
                                        a.remove();
                                        URL.revokeObjectURL(url);
                                    } catch (e) {
                                        alert('No se pudo exportar los datos');
                                    }
                                }}
                            >
                                Descargar Respaldo (JSON)
                            </button>
                            <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                Importar Respaldo
                                <input
                                    type="file"
                                    accept="application/json"
                                    style={{ display: 'none' }}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            const text = await file.text();
                                            const ok = importAllData(text);
                                            if (ok) alert('Respaldo importado correctamente');
                                            else alert('El archivo no es válido');
                                        } catch {
                                            alert('No se pudo importar el respaldo');
                                        } finally {
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {activeTab !== 'ACCOUNT' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {filteredItems.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Tag size={48} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                            <p>No hay {activeTab === 'SERVICE' ? 'prácticas registradas' : 'medicamentos registrados'}.</p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px' }}></th>
                                        <th>Nombre</th>
                                        <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                                        <th style={{ width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedItems.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ color: p.type === 'PRODUCT' ? 'var(--accent)' : 'var(--primary)' }}>
                                                {p.type === 'PRODUCT' ? <Pill size={18} /> : <Stethoscope size={18} />}
                                            </td>
                                            <td style={{ fontWeight: 500 }}>
                                                <div>{p.name}</div>
                                                {p.leyenda && <div className="text-muted text-sm" style={{ marginTop: '2px' }}>{p.leyenda}</div>}
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1rem' }}>
                                                ${Number(p.defaultPrice).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => handleEdit(p)}
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => { if (window.confirm('¿Eliminar ítem del catálogo?')) deletePractice(p.id) }}
                                                        style={{ color: 'var(--danger)' }}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
