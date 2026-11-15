import { useState, FormEvent, useEffect } from 'react'
import { Transaction, TransactionType } from '@/lib/types'
import { dateToMois, getCurrencySymbol, resolveTypeForCategory } from '@/lib/utils'
import { useCategories, useBudgetTypes } from '@/lib/queries'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import { useTranslation, translateType } from '@/i18n'

interface TransactionFormProps {
  open: boolean
  onClose: () => void
  onSave: (tx: Omit<Transaction, 'id' | 'created' | 'updated'>) => void
  initial?: Transaction | null
}

const today = () => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function TransactionForm({ open, onClose, onSave, initial }: TransactionFormProps) {
  const { t } = useTranslation()
  const { data: categories = [] } = useCategories()
  const { data: types = [] } = useBudgetTypes()

  const [date, setDate] = useState(initial?.date || today())
  const [libelle, setLibelle] = useState(initial?.libelle_simplifie || '')
  const [libelleOp, setLibelleOp] = useState(initial?.libelle_operation || '')
  const [categorie, setCategorie] = useState<string>(initial?.categorie || categories[0]?.nom || 'Divers')
  const [type, setType] = useState<TransactionType>(initial?.type || 'Essentielle')
  const [debit, setDebit] = useState(initial?.debit ? String(initial.debit) : '')
  const [credit, setCredit] = useState(initial?.credit ? String(initial.credit) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initial) {
      setDate(initial.date)
      setLibelle(initial.libelle_simplifie)
      setLibelleOp(initial.libelle_operation)
      setCategorie(initial.categorie)
      setType(initial.type)
      setDebit(initial.debit ? String(initial.debit) : '')
      setCredit(initial.credit ? String(initial.credit) : '')
    } else {
      setDate(today())
      setLibelle('')
      setLibelleOp('')
      setCategorie(categories[0]?.nom || 'Divers')
      setType('Essentielle')
      setDebit('')
      setCredit('')
    }
  }, [initial, open])

  const handleCategorieChange = (cat: string) => {
    setCategorie(cat)
    const inferredType = resolveTypeForCategory(categories, cat)
    if (inferredType) setType(inferredType)
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!date.match(/^\d{2}\/\d{2}\/\d{4}$/)) errs.date = t('tx.errDate')
    if (!libelle.trim()) errs.libelle = t('tx.errLabel')
    if (!debit && !credit) errs.amount = t('tx.errAmount')
    return errs
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const creditNum = parseFloat(credit || '0') || 0
    const debitNum = parseFloat(debit || '0') || 0

    onSave({
      date,
      mois: dateToMois(date),
      libelle_simplifie: libelle.trim(),
      libelle_operation: libelleOp.trim() || libelle.trim(),
      categorie,
      type: creditNum > 0 ? 'Revenu' : type,
      debit: creditNum > 0 ? 0 : debitNum,
      credit: creditNum > 0 ? creditNum : 0,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? t('tx.formEditTitle') : t('tx.formNewTitle')} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('tx.formDate')}
            value={date}
            onChange={e => setDate(e.target.value)}
            placeholder={t('tx.formDatePlaceholder')}
            error={errors.date}
          />
          <Input
            label={t('tx.formShortLabel')}
            value={libelle}
            onChange={e => setLibelle(e.target.value)}
            placeholder={t('tx.formShortLabelPlaceholder')}
            error={errors.libelle}
          />
        </div>

        <Input
          label={t('tx.formFullLabel')}
          value={libelleOp}
          onChange={e => setLibelleOp(e.target.value)}
          placeholder={t('tx.formFullLabelPlaceholder')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t('tx.formType')}
            value={type}
            onChange={e => setType(e.target.value as TransactionType)}
            options={types.map(tp => ({ value: tp.nom, label: translateType(tp.nom) }))}
          />
          <Select
            label={t('tx.formCategory')}
            value={categorie}
            onChange={e => handleCategorieChange(e.target.value)}
            options={categories.map(c => ({ value: c.nom, label: c.nom }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('tx.formDebit', { symbol: getCurrencySymbol() })}
            type="number"
            step="0.01"
            min="0"
            value={debit}
            onChange={e => {
              setDebit(e.target.value)
              if (e.target.value) setCredit('')
            }}
            placeholder="0.00"
            error={errors.amount}
          />
          <Input
            label={t('tx.formCredit', { symbol: getCurrencySymbol() })}
            type="number"
            step="0.01"
            min="0"
            value={credit}
            onChange={e => {
              setCredit(e.target.value)
              if (e.target.value) {
                setDebit('')
                setType('Revenu')
              }
            }}
            placeholder="0.00"
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary">
            {initial ? t('common.save') : t('common.add')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
