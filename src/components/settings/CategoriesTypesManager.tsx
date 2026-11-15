import { useState, useMemo, useEffect } from 'react'
import { BudgetCategory, BudgetType } from '@/lib/types'
import {
  fetchCategories,
  fetchBudgetTypes,
  saveCategoryPB,
  deleteCategoryPB,
  saveBudgetTypePB,
  deleteBudgetTypePB,
} from '@/lib/sync'
import { Plus, Trash2, Tag, Layers, Check, X, Pencil, AlertCircle } from 'lucide-react'
import { PocketBaseGuard } from '@/components/ui/PocketBaseRequiredState'
import { generateId, cn } from '@/lib/utils'
import { useTranslation, translateType } from '@/i18n'

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#64748b', // Slate
]

export default function CategoriesTypesManager() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [types, setTypes] = useState<BudgetType[]>([])
  const [loading, setLoading] = useState(true)
  const [pbError, setPbError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setPbError(null)
      try {
        const [fetchedCats, fetchedTypes] = await Promise.all([
          fetchCategories(),
          fetchBudgetTypes(),
        ])
        setCategories(fetchedCats)
        setTypes(fetchedTypes)
        if (fetchedTypes.length > 0) {
          setNewCatTypes([fetchedTypes[0].nom])
        }
      } catch (err: any) {
        setPbError(err?.message || "Aucun serveur PocketBase n'est connecté.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Listes triées par ordre alphabétique
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })),
    [categories]
  )

  const sortedTypes = useMemo(
    () => [...types].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })),
    [types]
  )

  // Edit / Add category state (with MULTI-TYPES support)
  const [newCatName, setNewCatName] = useState('')
  const [newCatTypes, setNewCatTypes] = useState<string[]>([])

  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatTypes, setEditCatTypes] = useState<string[]>([])

  // Edit / Add type state
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeColor, setNewTypeColor] = useState(PRESET_COLORS[0])
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [editTypeName, setEditTypeName] = useState('')
  const [editTypeColor, setEditTypeColor] = useState('')

  // ─── Duplicate Detection ──────────────────────────────────────────────────

  const isNewCatDuplicate = categories.some(
    c => c.nom.trim().toLowerCase() === newCatName.trim().toLowerCase()
  )

  const isEditCatDuplicate = categories.some(
    c => c.id !== editingCatId && c.nom.trim().toLowerCase() === editCatName.trim().toLowerCase()
  )

  const isNewTypeDuplicate = types.some(
    t => t.nom.trim().toLowerCase() === newTypeName.trim().toLowerCase()
  )

  const isEditTypeDuplicate = types.some(
    t => t.id !== editingTypeId && t.nom.trim().toLowerCase() === editTypeName.trim().toLowerCase()
  )

  // ─── Categories Actions (Multi-Types) ──────────────────────────────────────

  const toggleNewCatType = (typeName: string) => {
    setNewCatTypes(prev =>
      prev.includes(typeName)
        ? prev.length > 1
          ? prev.filter(t => t !== typeName)
          : prev
        : [...prev, typeName]
    )
  }

  const toggleEditCatType = (typeName: string) => {
    setEditCatTypes(prev =>
      prev.includes(typeName)
        ? prev.length > 1
          ? prev.filter(t => t !== typeName)
          : prev
        : [...prev, typeName]
    )
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim() || newCatTypes.length === 0 || isNewCatDuplicate) return
    const newCat: BudgetCategory = {
      id: generateId(),
      nom: newCatName.trim(),
      types: newCatTypes,
    }
    try {
      const saved = await saveCategoryPB(newCat)
      setCategories(prev => [...prev, saved])
      setNewCatName('')
      setNewCatTypes([types[0]?.nom || 'Essentielle'])
    } catch (err) {
      console.warn('PB saveCategoryPB err:', err)
    }
  }

  const startEditCategory = (cat: BudgetCategory) => {
    setEditingCatId(cat.id)
    setEditCatName(cat.nom)
    setEditCatTypes(cat.types && cat.types.length > 0 ? cat.types : ['Essentielle'])
  }

  const saveEditCategory = async (id: string) => {
    if (!editCatName.trim() || editCatTypes.length === 0 || isEditCatDuplicate) return
    const cat = categories.find(c => c.id === id)
    if (!cat) return
    const updated: BudgetCategory = { ...cat, nom: editCatName.trim(), types: editCatTypes }
    try {
      const saved = await saveCategoryPB(updated)
      setCategories(prev => prev.map(c => (c.id === id ? saved : c)))
      setEditingCatId(null)
    } catch (err) {
      console.warn('PB saveCategoryPB err:', err)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategoryPB(id)
      setCategories(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.warn('PB deleteCategoryPB err:', err)
    }
  }

  // ─── Types Actions ────────────────────────────────────────────────────────

  const handleAddType = async () => {
    if (!newTypeName.trim() || isNewTypeDuplicate) return
    const newT: BudgetType = {
      id: generateId(),
      nom: newTypeName.trim(),
      couleur: newTypeColor,
    }
    try {
      const saved = await saveBudgetTypePB(newT)
      setTypes(prev => [...prev, saved])
      setNewTypeName('')
    } catch (err) {
      console.warn('PB saveBudgetTypePB err:', err)
    }
  }

  const startEditType = (type: BudgetType) => {
    setEditingTypeId(type.id)
    setEditTypeName(type.nom)
    setEditTypeColor(type.couleur || PRESET_COLORS[0])
  }

  const saveEditType = async (id: string) => {
    if (!editTypeName.trim() || isEditTypeDuplicate) return
    const prevType = types.find(t => t.id === id)
    const type = types.find(t => t.id === id)
    if (!type) return
    const updatedType: BudgetType = { ...type, nom: editTypeName.trim(), couleur: editTypeColor }
    try {
      const saved = await saveBudgetTypePB(updatedType)
      setTypes(prev => prev.map(t => (t.id === id ? saved : t)))

      // Update categories containing the renamed type
      if (prevType && prevType.nom !== editTypeName.trim()) {
        const updatedCats = categories.map(c => ({
          ...c,
          types: c.types.map(t => (t === prevType.nom ? editTypeName.trim() : t)),
        }))
        setCategories(updatedCats)
        for (const cat of updatedCats) {
          if (cat.types.includes(editTypeName.trim())) {
            saveCategoryPB(cat).catch(err => console.warn('PB saveCategoryPB err:', err))
          }
        }
      }

      setEditingTypeId(null)
    } catch (err) {
      console.warn('PB saveBudgetTypePB err:', err)
    }
  }

  const handleDeleteType = async (id: string) => {
    const typeToDelete = types.find(t => t.id === id)
    if (!typeToDelete) return

    const linkedCount = categories.filter(c => c.types.includes(typeToDelete.nom)).length
    if (linkedCount > 0) {
      if (
        !confirm(
          t('cats.confirmDeleteType', { count: linkedCount, name: translateType(typeToDelete.nom) })
        )
      ) {
        return
      }
      const updatedCats = categories.map(c => {
        const filtered = c.types.filter(t => t !== typeToDelete.nom)
        return {
          ...c,
          types: filtered.length > 0 ? filtered : [types.find(t => t.id !== id)?.nom || 'Essentielle'],
        }
      })
      setCategories(updatedCats)
      for (const cat of updatedCats) {
        saveCategoryPB(cat).catch(err => console.warn('PB saveCategoryPB err:', err))
      }
    }

    try {
      await deleteBudgetTypePB(id)
      setTypes(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.warn('PB deleteBudgetTypePB err:', err)
    }
  }

  if (loading) {
    return (
      <div className="card p-5 flex items-center justify-center h-32 text-gray-400 text-sm">
        {t('cats.loadingPb')}
      </div>
    )
  }

  return (
    <PocketBaseGuard error={pbError}>
    <div className="space-y-6 animate-fade-in">
      {/* SECTION 1: GESTION DES CATÉGORIES & LIAISON MULTI-TYPES */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl text-primary-600 dark:text-primary-400">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {t('cats.title')}
            </h3>
            <p className="text-xs text-gray-400">
              {t('cats.desc')}
            </p>
          </div>
        </div>

        {/* Formulaire d'ajout d'une catégorie avec détection de doublon */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <input
                className={cn(
                  'input text-xs py-1.5 px-3 w-full',
                  isNewCatDuplicate ? 'border-red-400 focus:ring-red-400 bg-red-50/30' : ''
                )}
                placeholder={t('cats.newPlaceholder')}
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              />
              {isNewCatDuplicate && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-red-600 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {t('cats.duplicateCat')}
                </div>
              )}
            </div>

            <button
              onClick={handleAddCategory}
              disabled={!newCatName.trim() || newCatTypes.length === 0 || isNewCatDuplicate}
              className="btn-primary text-xs py-1.5 px-3.5 disabled:opacity-40 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> {t('cats.addCatBtn')}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-500 font-semibold uppercase">
              {t('cats.linkToTypes')}
            </span>
            {types.map(tp => {
              const isSelected = newCatTypes.includes(tp.nom)
              return (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => toggleNewCatType(tp.nom)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5',
                    isSelected
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: tp.couleur || '#6366f1' }}
                  />
                  <span>{translateType(tp.nom)}</span>
                  {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Grille des catégories existantes (Triées par ordre alphabétique) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
          {sortedCategories.map(cat => {
            const isEditing = editingCatId === cat.id

            if (isEditing) {
              return (
                <div
                  key={cat.id}
                  className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 space-y-2 col-span-full md:col-span-1"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className={cn(
                          'input text-xs py-1 px-2 flex-1 font-semibold',
                          isEditCatDuplicate ? 'border-red-400 focus:ring-red-400 bg-red-50/40' : ''
                        )}
                        value={editCatName}
                        onChange={e => setEditCatName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveEditCategory(cat.id)}
                      />
                      <button
                        onClick={() => saveEditCategory(cat.id)}
                        disabled={isEditCatDuplicate || !editCatName.trim()}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-sm disabled:opacity-40"
                        title={t('tx.saveEnterTitle')}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingCatId(null)}
                        className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
                        title={t('tx.cancelEscTitle')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {isEditCatDuplicate && (
                      <p className="text-[11px] font-semibold text-red-600">
                        {t('cats.duplicateCatEdit')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">
                      {t('cats.typesLabel')}
                    </span>
                    {types.map(tp => {
                      const isSel = editCatTypes.includes(tp.nom)
                      return (
                        <button
                          key={tp.id}
                          type="button"
                          onClick={() => toggleEditCatType(tp.nom)}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-semibold transition-all border',
                            isSel
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700'
                          )}
                        >
                          {translateType(tp.nom)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            }

            return (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors bg-white dark:bg-gray-900 group"
              >
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {cat.nom}
                </span>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {cat.types.map(typeName => {
                      const tObj = types.find(t => t.nom === typeName)
                      return (
                        <span
                          key={typeName}
                          className="badge text-[10px] py-0.5 px-2 text-white font-medium shadow-sm"
                          style={{ backgroundColor: tObj?.couleur || '#6366f1' }}
                        >
                          {translateType(typeName)}
                        </span>
                      )
                    })}
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <button
                      onClick={() => startEditCategory(cat)}
                      className="p-1 text-gray-400 hover:text-primary-600 rounded"
                      title={t('cats.editCatTitle')}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SECTION 2: GESTION DES TYPES AVEC DÉTECTION DE DOUBLON */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {t('cats.typesTitle')}
            </h3>
            <p className="text-xs text-gray-400">
              {t('cats.typesDesc')}
            </p>
          </div>
        </div>

        {/* Ajout d'un type avec détection de doublon */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <input
                className={cn(
                  'input text-xs py-1.5 px-3 w-full',
                  isNewTypeDuplicate ? 'border-red-400 focus:ring-red-400 bg-red-50/30' : ''
                )}
                placeholder={t('cats.newTypePlaceholder')}
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddType()}
              />
              {isNewTypeDuplicate && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-red-600 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {t('cats.duplicateType')}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewTypeColor(color)}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    newTypeColor === color ? 'scale-125 ring-2 ring-offset-2 ring-primary-500' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <button
              onClick={handleAddType}
              disabled={!newTypeName.trim() || isNewTypeDuplicate}
              className="btn-primary text-xs py-1.5 px-3.5 disabled:opacity-40 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> {t('cats.addTypeBtn')}
            </button>
          </div>
        </div>

        {/* Liste des types (Triés par ordre alphabétique) */}
        <div className="space-y-2">
          {sortedTypes.map(type => {
            const isEditing = editingTypeId === type.id
            const catCount = categories.filter(c => c.types.includes(type.nom)).length

            if (isEditing) {
              return (
                <div
                  key={type.id}
                  className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className={cn(
                        'input text-xs py-1 px-2 flex-1 font-semibold',
                        isEditTypeDuplicate ? 'border-red-400 focus:ring-red-400 bg-red-50/40' : ''
                      )}
                      value={editTypeName}
                      onChange={e => setEditTypeName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEditType(type.id)}
                    />
                    <div className="flex items-center gap-1">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setEditTypeColor(color)}
                          className={`w-4 h-4 rounded-full ${
                            editTypeColor === color ? 'ring-2 ring-offset-1 ring-primary-500' : 'opacity-70'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => saveEditType(type.id)}
                      disabled={isEditTypeDuplicate || !editTypeName.trim()}
                      className="p-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingTypeId(null)}
                      className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isEditTypeDuplicate && (
                    <p className="text-[11px] font-semibold text-red-600">
                      {t('cats.duplicateTypeEdit')}
                    </p>
                  )}
                </div>
              )
            }

            return (
              <div
                key={type.id}
                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3.5 h-3.5 rounded-full shadow-sm"
                    style={{ backgroundColor: type.couleur || '#6366f1' }}
                  />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {translateType(type.nom)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {catCount > 1
                      ? t('cats.linkedCountPlural', { count: catCount })
                      : t('cats.linkedCountSingular', { count: catCount })}
                  </span>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEditType(type)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title={t('cats.editTypeTitle')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteType(type.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title={t('cats.deleteTypeTitle')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
    </PocketBaseGuard>
  )
}
