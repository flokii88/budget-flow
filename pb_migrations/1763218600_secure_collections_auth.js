/// <reference path="../pb_data/types.d.ts" />

/**
 * Sécurisation complète des collections PocketBase (Modèle Foyer Partagé) :
 * 1. Vue publique `app_status` exposant uniquement le nombre de comptes (`user_count`)
 *    afin de permettre la création du 1er compte lors de la transition sans exposer les utilisateurs.
 * 2. Collection `users` :
 *    - Champ caché `recovery_key` (hidden: true) pour la réinitialisation du mot de passe sans SMTP
 *    - `createRule` autorisée uniquement si 0 utilisateur existe ou si le demandeur est déjà connecté
 *    - `manageRule` & `updateRule` autorisant la réinitialisation du mot de passe via `recovery_key`
 * 3. Verrouillage des 6 collections métier (`@request.auth.id != ''`).
 */
migrate((app) => {
  // 1. Créer ou mettre à jour la vue app_status
  let appStatus = null
  try {
    appStatus = app.findCollectionByNameOrId("app_status")
  } catch (_) {
    appStatus = null
  }

  if (!appStatus) {
    appStatus = new Collection({
      id: "pbc_app_status",
      name: "app_status",
      type: "view",
      listRule: "",
      viewRule: "",
      viewQuery: "SELECT 'status' as id, COUNT(id) as user_count FROM users",
    })
  } else {
    appStatus.listRule = ""
    appStatus.viewRule = ""
    appStatus.viewQuery = "SELECT 'status' as id, COUNT(id) as user_count FROM users"
  }
  app.save(appStatus)

  // 2. Sécuriser la collection users et ajouter recovery_key + must_change_password
  const users = app.findCollectionByNameOrId("users")
  if (!users.fields.getByName("recovery_key")) {
    users.fields.add(new TextField({
      id: "user_recovery_key",
      name: "recovery_key",
      hidden: true,
      required: false,
      max: 255,
    }))
  }
  if (!users.fields.getByName("must_change_password")) {
    users.fields.add(new BoolField({
      id: "user_must_change_pwd",
      name: "must_change_password",
      required: false,
    }))
  }

  const recoveryRule = "id = @request.auth.id || (recovery_key != '' && @request.body.recovery_key != '' && @request.body.recovery_key = recovery_key)"
  users.listRule = "@request.auth.id != ''"
  users.viewRule = "@request.auth.id != ''"
  users.createRule = "@request.auth.id != '' || @collection.app_status.user_count = 0"
  users.updateRule = recoveryRule
  users.manageRule = recoveryRule
  users.deleteRule = "id = @request.auth.id"
  if (users.authAlert) {
    users.authAlert.enabled = false
  }
  app.save(users)

  // 3. Verrouiller les 6 collections métier du foyer
  const protectedCollections = [
    "transactions",
    "fixed_expenses",
    "budget_rules",
    "categories",
    "budget_types",
    "categorization_rules",
  ]

  const authRequiredRule = "@request.auth.id != ''"

  for (const name of protectedCollections) {
    try {
      const col = app.findCollectionByNameOrId(name)
      col.listRule = authRequiredRule
      col.viewRule = authRequiredRule
      col.createRule = authRequiredRule
      col.updateRule = authRequiredRule
      col.deleteRule = authRequiredRule
      app.save(col)
    } catch (_) {
      // Collection absente, ignorée
    }
  }
}, (app) => {
  const protectedCollections = [
    "transactions",
    "fixed_expenses",
    "budget_rules",
    "categories",
    "budget_types",
    "categorization_rules",
  ]

  for (const name of protectedCollections) {
    try {
      const col = app.findCollectionByNameOrId(name)
      col.listRule = ""
      col.viewRule = ""
      col.createRule = ""
      col.updateRule = ""
      col.deleteRule = ""
      app.save(col)
    } catch (_) {}
  }

  try {
    const users = app.findCollectionByNameOrId("users")
    users.listRule = "id = @request.auth.id"
    users.viewRule = "id = @request.auth.id"
    users.createRule = ""
    users.updateRule = "id = @request.auth.id"
    users.manageRule = null
    users.deleteRule = "id = @request.auth.id"
    if (users.fields.getByName("recovery_key")) {
      users.fields.removeByName("recovery_key")
    }
    if (users.fields.getByName("must_change_password")) {
      users.fields.removeByName("must_change_password")
    }
    app.save(users)
  } catch (_) {}

  try {
    const appStatus = app.findCollectionByNameOrId("app_status")
    app.delete(appStatus)
  } catch (_) {}
})
