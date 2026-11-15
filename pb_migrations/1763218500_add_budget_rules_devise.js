/// <reference path="../pb_data/types.d.ts" />

/**
 * Ajoute le champ devise sur budget_rules :
 * - budget_rules.devise (text) : code ISO 4217 de la devise d'affichage (défaut EUR)
 */
migrate((app) => {
  const budgetRules = app.findCollectionByNameOrId("budget_rules")
  if (!budgetRules.fields.getByName("devise")) {
    budgetRules.fields.add(new TextField({
      name: "devise",
      required: false,
    }))
    app.save(budgetRules)
  }
}, (app) => {
  const budgetRules = app.findCollectionByNameOrId("budget_rules")
  if (budgetRules.fields.getByName("devise")) {
    budgetRules.fields.removeByName("devise")
    app.save(budgetRules)
  }
})
