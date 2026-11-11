// Explain known API signals without treating missing information as a safe result.
export function securityWarningText(value) {
  const labels = {
    MINT_AUTHORITY_ACTIVE: "L’autorité d’émission est active : de nouveaux tokens peuvent encore être créés.",
    FREEZE_AUTHORITY_ACTIVE: "L’autorité de gel est active : des comptes de tokens peuvent être gelés.",
    TOKEN_2022_REQUIRES_EXTENSION_ANALYSIS: "Les extensions Token-2022 nécessitent des contrôles complémentaires ; le score de sécurité reste limité à son périmètre.",
    UNKNOWN_TOKEN_PROGRAM: "Le programme du token n’est pas identifié ; ses propriétés de sécurité ne sont pas confirmées.",
    MINT_NOT_CONFIRMED_INITIALIZED: "L’initialisation du mint n’a pas pu être confirmée.",
    TOKEN_SUPPLY_RPC_UNAVAILABLE: "La quantité de tokens en circulation n’a pas pu être confirmée par la source Solana."
  };
  return typeof value === "string" ? labels[value] || value : "Information de sécurité indisponible.";
}
