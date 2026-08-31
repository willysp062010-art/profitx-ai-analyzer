# PROFITX AI — Solana Token Analyzer

Version 2.0 — correction du moteur de récupération DEX Screener.

## Ce qui est corrigé

- Endpoint DEX Screener officiel `/tokens/v1/solana/{tokenAddress}`.
- Sélection robuste de la paire principale.
- Liquidité USD.
- Volume 24h.
- Transactions 24h.
- Maturité de la paire.
- Score recalculé uniquement avec les données réellement disponibles.
- Les données non exposées par DEX Screener (ex. nombre fiable de holders) restent `N/D` au lieu d'être inventées.
- Gestion explicite de `NO_MARKET`, `PARTIAL_DATA`, `VALID` et erreurs amont.
- Timeout réseau côté API.

## Déploiement

Le projet utilise Next.js Pages Router. Aucun secret n'est nécessaire pour DEX Screener.

Après import GitHub → Vercel, utiliser le preset Next.js et le répertoire racine `./`.

## Important

Ne pas ajouter de clé privée, seed phrase ou secret dans le dépôt.

La documentation DEX Screener décrit les endpoints token/pairs utilisés par ce projet.
