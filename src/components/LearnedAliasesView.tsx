import React, { useState } from 'react';
import {
  BrainCircuit,
  Check,
  CheckCircle,
  Clock,
  Info,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { useConcilia } from '../context/ConciliaContext';

export const LearnedAliasesView: React.FC = () => {
  const { learnedAliases, clients, addLearnedAlias, deleteLearnedAlias, runMatchingEngine } = useConcilia();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [newAliasText, setNewAliasText] = useState<string>('');
  const [newAliasClientId, setNewAliasClientId] = useState<string>(clients[0]?.id || '');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [aliasToDelete, setAliasToDelete] = useState<{ id: string; text: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const filteredAliases = learnedAliases.filter(
    a =>
      a.texto_referencia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAliasText.trim() || !newAliasClientId) return;

    addLearnedAlias(newAliasText.trim().toUpperCase(), newAliasClientId);
    setSuccessMsg(`¡Alias "${newAliasText.toUpperCase()}" agregado con éxito!`);
    setNewAliasText('');
    setShowAddForm(false);

    setTimeout(() => {
      runMatchingEngine();
      setSuccessMsg(null);
    }, 2000);
  };

  const handleConfirmDelete = () => {
    if (!aliasToDelete) return;
    deleteLearnedAlias(aliasToDelete.id);
    setSuccessMsg(`Alias "${aliasToDelete.text}" eliminado.`);
    setAliasToDelete(null);
    setTimeout(() => {
      runMatchingEngine();
      setSuccessMsg(null);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Diccionario de Alias Aprendidos</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
              {learnedAliases.length} reglas activas
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Agregar Alias Manual</span>
        </button>
      </div>

      {/* Add Alias Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateAlias}
          className="bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 border-blue-500/40 shadow-sm space-y-4 animate-in fade-in duration-200"
        >
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-1.5">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span>Enseñar nuevo patrón de texto al motor</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Texto / Patrón en la descripción del banco *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. DEP CAJA SUC 42, CARLOS MENDEZ BAZAR, etc."
                value={newAliasText}
                onChange={(e) => setNewAliasText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cliente al que debe vincularse *
              </label>
              <select
                value={newAliasClientId}
                onChange={(e) => setNewAliasClientId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (RUT: {c.rut_ci})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
            >
              Guardar Alias
            </button>
          </div>
        </form>
      )}

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative w-full sm:w-80">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="Buscar alias o cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Aliases Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-600">
              <tr>
                <th className="px-4 py-3">Texto / Patrón Bancario</th>
                <th className="px-4 py-3">Cliente Asociado</th>
                <th className="px-4 py-3 text-center">Veces Confirmado</th>
                <th className="px-4 py-3">Última Vez Usado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredAliases.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                    No se encontraron alias registrados.
                  </td>
                </tr>
              ) : (
                filteredAliases.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <Tag className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                      <span>{a.texto_referencia}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-blue-700 dark:text-blue-400">{a.cliente_nombre}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {a.veces_confirmado} veces
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.ultima_vez}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setAliasToDelete({ id: a.id, text: a.texto_referencia })}
                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                        title="Eliminar regla"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanatory callout */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700 flex items-start space-x-3 text-xs text-slate-600 dark:text-slate-400">
        <BrainCircuit className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-900 dark:text-white">
          </p>
          <p className="leading-relaxed">
            A diferencia de un modelo de IA probabilístico, los alias aprendidos son reglas auditables y 100% predecibles. El sistema nunca inventa una asociación sin que un humano la haya aprobado previamente.
          </p>
        </div>
      </div>

      {/* In-app Delete Confirmation Modal */}
      {aliasToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">¿Eliminar alias aprendido?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Se eliminará la regla de emparejamiento automático.</p>
                </div>
              </div>
              <button
                onClick={() => setAliasToDelete(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 my-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
              ¿Estás seguro de eliminar el alias <strong className="text-slate-900 dark:text-white font-mono">"{aliasToDelete.text}"</strong>? Los próximos movimientos con este texto ya no se sugerirán automáticamente con este cliente.
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setAliasToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer"
              >
                Eliminar Alias
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
