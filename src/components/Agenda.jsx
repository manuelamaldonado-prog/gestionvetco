import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { ChevronLeft, ChevronRight, PlusCircle, X, Trash2, Edit2, Calendar as CalendarIcon } from 'lucide-react';

export default function Agenda() {
    const { agendaEvents, clients, addAgendaEvent, updateAgendaEvent, deleteAgendaEvent } = useData();

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    
    // Form State
    const [formData, setFormData] = useState({
        date: '',
        time: '',
        title: '',
        clientId: '',
        notes: ''
    });

    // --- Calendar Logic ---
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday, etc.
    };

    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const monthKey = currentDate.toISOString().slice(0, 7); // YYYY-MM

    // Events for current month
    const monthEvents = useMemo(() => {
        return agendaEvents.filter(e => e.date.startsWith(monthKey));
    }, [agendaEvents, monthKey]);

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    // --- Modal Logic ---
    const openNewEvent = (day) => {
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${monthKey}-${dayStr}`;
        setEditingEvent(null);
        setSelectedDate(dateStr);
        setFormData({
            date: dateStr,
            time: '',
            title: '',
            clientId: '',
            notes: ''
        });
        setShowModal(true);
    };

    const openEditEvent = (e, event) => {
        e.stopPropagation();
        setEditingEvent(event);
        setFormData({
            date: event.date,
            time: event.time || '',
            title: event.title,
            clientId: event.clientId,
            notes: event.notes || ''
        });
        setShowModal(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingEvent) {
            updateAgendaEvent(editingEvent.id, formData);
        } else {
            addAgendaEvent(formData);
        }
        setShowModal(false);
    };

    const handleDelete = () => {
        if (editingEvent && window.confirm('¿Eliminar este evento?')) {
            deleteAgendaEvent(editingEvent.id);
            setShowModal(false);
        }
    };

    // Calendar Grid Generation
    const days = [];
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="calendar-day empty" style={{ background: 'var(--background)' }}></div>);
    }
    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        const dayStr = String(i).padStart(2, '0');
        const dateStr = `${monthKey}-${dayStr}`;
        const dayEvents = monthEvents.filter(e => e.date === dateStr);
        const isToday = new Date().toISOString().slice(0, 10) === dateStr;

        days.push(
            <div 
                key={i} 
                className={`calendar-day ${isToday ? 'today' : ''}`}
                onClick={() => openNewEvent(i)}
                style={{
                    background: 'white',
                    border: '1px solid var(--surface-hover)',
                    minHeight: '100px',
                    padding: '0.5rem',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    ...(isToday ? { border: '2px solid var(--primary)' } : {})
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            >
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: isToday ? 'var(--primary)' : 'inherit' }}>{i}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {dayEvents.map(event => {
                        const clientName = clients.find(c => c.id === event.clientId)?.name || 'Sin Cliente';
                        return (
                            <div 
                                key={event.id}
                                onClick={(e) => openEditEvent(e, event)}
                                style={{
                                    background: 'var(--primary-soft)',
                                    color: 'var(--primary-dark)',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    borderLeft: '3px solid var(--primary)'
                                }}
                                title={`${event.title} - ${clientName}\n${event.notes}`}
                            >
                                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {event.time ? `${event.time} ` : ''}{event.title}
                                </div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {clientName}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={prevMonth} className="btn-icon"><ChevronLeft /></button>
                    <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{monthName}</h2>
                    <button onClick={nextMonth} className="btn-icon"><ChevronRight /></button>
                </div>
                <button className="btn btn-primary" onClick={() => openNewEvent(new Date().getDate())}>
                    <PlusCircle size={18} /> Nuevo Evento
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, 1fr)', 
                    background: 'var(--surface-hover)',
                    borderBottom: '1px solid var(--surface-hover)'
                }}>
                    {WEEKDAYS.map(d => (
                        <div key={d} style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center', 
                            fontWeight: 'bold', 
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem'
                        }}>
                            {d}
                        </div>
                    ))}
                </div>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, 1fr)', 
                    background: 'var(--surface-hover)',
                    gap: '1px' // Grid lines
                }}>
                    {days}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', margin: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</h3>
                            <button onClick={() => setShowModal(false)} className="btn-icon"><X size={24} /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Fecha</label>
                                <input 
                                    type="date" 
                                    className="form-input" 
                                    value={formData.date}
                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Hora</label>
                                <input 
                                    type="time" 
                                    className="form-input" 
                                    value={formData.time}
                                    onChange={e => setFormData({...formData, time: e.target.value})}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Tarea / Servicio</label>
                                <input 
                                    className="form-input" 
                                    placeholder="Ej: Vacunación, Tacto, Sangrado..."
                                    value={formData.title}
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Cliente</label>
                                <select 
                                    className="form-input"
                                    value={formData.clientId}
                                    onChange={e => setFormData({...formData, clientId: e.target.value})}
                                    required
                                >
                                    <option value="">Seleccionar Cliente...</option>
                                    {clients
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Observaciones</label>
                                <textarea 
                                    className="form-input" 
                                    rows="3"
                                    style={{ resize: 'none' }}
                                    value={formData.notes}
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                ></textarea>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                {editingEvent && (
                                    <button 
                                        type="button" 
                                        className="btn btn-icon" 
                                        style={{ color: 'var(--danger)', border: '1px solid var(--danger-soft)', marginRight: 'auto' }}
                                        onClick={handleDelete}
                                        title="Eliminar Evento"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingEvent ? 'Guardar Cambios' : 'Crear Evento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
