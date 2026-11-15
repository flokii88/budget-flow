/// <reference path="../pb_data/types.d.ts" />

/**
 * Ajoute les champs nécessaires au rapprochement des dépenses fixes :
 * - fixed_expenses.pattern (text) : mot-clé recherché dans le libellé
 * - transactions.fixed_expense_id (text) : lien manuel vers une dépense fixe
 * - budget_rules.fixed_match_tolerance (number) : marge de tolérance globale en €
 */
migrate((app) => {
  // 1. fixed_expenses.pattern
  const fixedExpenses = app.findCollectionByNameOrId("fixed_expenses")
  if (!fixedExpenses.fields.getByName("pattern")) {
    fixedExpenses.fields.add(new TextField({
      name: "pattern",
      required: false,
    }))
    app.save(fixedExpenses)
  }

  // 2. transactions.fixed_expense_id
  const transactions = app.findCollectionByNameOrId("transactions")
  if (!transactions.fields.getByName("fixed_expense_id")) {
    transactions.fields.add(new TextField({
      name: "fixed_expense_id",
      required: false,
    }))
    app.save(transactions)
  }

  // 3. budget_rules.fixed_match_tolerance
  const budgetRules = app.findCollectionByNameOrId("budget_rules")
  if (!budgetRules.fields.getByName("fixed_match_tolerance")) {
    budgetRules.fields.add(new NumberField({
      name: "fixed_match_tolerance",
      min: 0,
      onlyInt: false,
      required: false,
    }))
    app.save(budgetRules)
  }
}, (app) => {
  const fixedExpenses = app.findCollectionByNameOrId("fixed_expenses")
  if (fixedExpenses.fields.getByName("pattern")) {
    fixedExpenses.fields.removeByName("pattern")
    app.save(fixedExpenses)
  }

  const transactions = app.findCollectionByNameOrId("transactions")
  if (transactions.fields.getByName("fixed_expense_id")) {
    transactions.fields.removeByName("fixed_expense_id")
    app.save(transactions)
  }

  const budgetRules = app.findCollectionByNameOrId("budget_rules")
  if (budgetRules.fields.getByName("fixed_match_tolerance")) {
    budgetRules.fields.removeByName("fixed_match_tolerance")
    app.save(budgetRules)
  }
})
