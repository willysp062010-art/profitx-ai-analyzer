# PROFITX AI Analyzer

Analyse structurelle de tokens Solana pour le projet PROFITX.

## Architecture

- Interface Next.js
- API server-side `/api/analyze`
- Données marché via DexScreener
- RPC Solana
- Helius optionnel côté serveur
- Score structurel pondéré : liquidité 25, distribution 25, activité 20, volume 15, maturité 15
- Données absentes conservées à `null` et listées dans `missingData`
- Statuts : `NO_MARKET`, `LOW_LIQUIDITY`, `INSUFFICIENT_DATA`, `VALID`

## Lancer

```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Déploiement Vercel

Importer ce dépôt dans Vercel. Les variables `HELIUS_API_KEY` et `SOLANA_RPC_URL` sont optionnelles. Ne jamais exposer une clé privée ou une clé API dans le navigateur.

Le mint PFX utilisé comme exemple est celui fourni pour le projet :
`6FwDVfnnETqUe2UrxZEeLA6u7Vo5Td2Nm79z7s38pump`

Ce logiciel est un outil d'analyse technique/structurelle et ne constitue pas un conseil financier.
