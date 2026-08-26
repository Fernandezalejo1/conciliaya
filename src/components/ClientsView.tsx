import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Save,
  Mail,
  Phone,
  MapPin,
  User,
  CreditCard,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useConcilia } from '../context/ConciliaContext';
import { Client } from '../types';

export const ClientsView: React.FC = () => {
  const { clients, invoices, addClient, updateClient, deleteClient } = useConcilia();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formRut, setFormRut] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAliases, setFormAliases] = useState('');

  const resetForm = () => {
    setFormName('');
    setFormRut('');
    setFormEmail('');
    setFormPhone('');
    setFormContact('');
    setFormAddress('');
    setFormAliases('');
    setEditingId(null);
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (client: Client) => {
    setFormName(client.name);
    setFormRut(client.rut_ci);
    setFormEmail(client.email || '');
    setFormPhone(client.phone || '');
    setFormContact(client.contactPerson || '');
    setFormAddress(client.address || '');
    setFormAliases(client.alias_conocidos.join(', '));
    setEditingId(client.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const aliases = formAliases
      .split(',')
      .map(a => a.trim().toUpperCase())
      .filter(a => a.length > 0);

    if (editingId) {
      updateClient(editingId, {
        name: formName.trim(),
        rut_ci: formRut.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        contactPerson: formContact.trim() || undefined,
        address: formAddress.trim() || undefined,
        alias_conocidos: aliases
      });
      setSavedMsg('Cliente actualizado correctamente');
    } else {
      addClient({
        name: formName.trim(),
        rut_ci: formRut.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        contactPerson: formContact.trim() || undefined,
        address: formAddress.trim() || undefined,
        alias_conocidos: aliases
      });
      setSavedMsg('Cliente registrado correctamente');
    }

    setShowForm(false);
    resetForm();
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const handleDelete = (id: string) => {
    deleteClient(id);
    setDeleteConfirmId(null);
    setSavedMsg('Cliente eliminado');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.rut_ci.includes(search) ||
    c.alias_conocidos.some(a => a.toLowerCase().includes(search.toLowerCase()))
  );

  const getClientInvoiceCount = (clientId: string) =>
    invoices.filter(i => i.cliente_id === clientId && i.saldo_pendiente > 0 && i.estado !== 'pagada' && i.estado !== 'anulada').length;

  const getClientDebt = (clientId: string) =>
    invoices
      .filter(i => i.cliente_id === clientId && i.saldo_pendiente > 0 && i.estado !== 'pagada' && i.estado !== 'anulada')
      .reduce((sum, i) => sum + i.saldo_pendiente, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Gestión de Clientes
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {clients.length} cliente{clients.length !== 1 ? 's' : ''} registrado{clients.length !== 1 ? 's' : ''} en el padrón.
            </p>
          </div>
          <button
            onClick={openNewForm}
            className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 px-4 py-3 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {/* Search */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, RUT o alias..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Clients List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 border border-slate-200/80 dark:border-slate-700 shadow-xs text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {clients.length === 0
                ? 'No hay clientes registrados. Creá el primero.'
                : 'No se encontraron clientes con ese criterio.'}
            </p>
          </div>
        )}

        {filtered.map(client => {
          const pendingInvoices = getClientInvoiceCount(client.id);
          return (
            <div key={client.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{client.name}</h3>
                    {pendingInvoices > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                        {pendingInvoices} factura{pendingInvoices !== 1 ? 's' : ''} pendiente{pendingInvoices !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {client.rut_ci && (
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        RUT: {client.rut_ci}
                      </span>
                    )}
                    {client.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </span>
                    )}
                    {client.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </span>
                    )}
                    {client.contactPerson && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {client.contactPerson}
                      </span>
                    )}
                  </div>

                  {client.alias_conocidos.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {client.alias_conocidos.map((alias, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-600">
                          {alias}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">
                      Deuda: <span className={`font-bold ${getClientDebt(client.id) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        ${getClientDebt(client.id).toLocaleString()}
                      </span>
                    </span>
                    {client.creditBalance > 0 && (
                      <span className="text-slate-500 dark:text-slate-400">
                        Saldo a favor: <span className="font-bold text-emerald-600">
                          ${client.creditBalance.toLocaleString()}
                        </span>
                      </span>
                    )}
                    <span className="text-slate-500 dark:text-slate-400">
                      Total facturado: <span className="font-bold text-slate-700 dark:text-slate-300">
                        ${client.totalInvoiced.toLocaleString()}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-3">
                  <button
                    onClick={() => openEditForm(client)}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Editar cliente"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(client.id)}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Eliminar cliente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Delete confirmation */}
              {deleteConfirmId === client.id && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span>¿Eliminar <strong>{client.name}</strong>? Esta acción no se puede deshacer.</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      className="px-3 py-1.5 text-[11px] font-bold text-white bg-red-600 rounded-lg hover:bg-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre / Razón Social *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="Ej: Supermercados El Dorado S.A."
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">RUT / Cédula</label>
                  <input
                    type="text"
                    value={formRut}
                    onChange={(e) => setFormRut(e.target.value)}
                    placeholder="21.847.291.0014"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Contacto</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="Nombre del contacto"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="pagos@empresa.com"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+598 2900 0000"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Dirección</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Av. 18 de Julio 1420, Montevideo"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alias Conocidos
                  <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">(separados por coma)</span>
                </label>
                <input
                  type="text"
                  value={formAliases}
                  onChange={(e) => setFormAliases(e.target.value)}
                  placeholder="SUPER EL DORADO, ELDORADO SA"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Estos alias se usan para identificar transferencias bancarias con descripciones crípticas.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  {editingId ? 'Guardar Cambios' : 'Registrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
