# Audit fonctionnel Solana — 11 novembre 2026

Cet audit couvre les pages publiques de l’Analyzer et le site de présentation. Il distingue les vérifications réellement exécutées des limites encore ouvertes. Un HTTP 200 ne constitue pas, à lui seul, une validation fonctionnelle.

## Défauts corrigés dans cette livraison

- Deux images globales absentes (404) et un visuel portant encore une pilule Pump.fun : seules les identités officielles sans ce marquage sont utilisées.
- Activity, Holders et Token-2022 ignoraient Helius en l’absence de SOLANA_RPC_URL. Tous privilégient désormais le RPC explicite, puis Helius, puis le RPC public. Les pannes RPC restent indisponibles, réessayables, sans message privé du fournisseur.
- Le répertoire supprimait des caractères Unicode de la recherche (Gǒu devenait Gu), conservait des résultats obsolètes, ne figeait pas la pagination et annonçait une page inaccessible après sa limite. Les filtres sont cités, la recherche reste littérale, les requêtes périmées sont ignorées, la pagination dispose d’un instantané et d’une borne explicite.
- Les noms manquants du répertoire sont complétés par les métadonnées Token-2022 du mint exact. Les valeurs de marché stockées sont explicitement historiques, avec actualité non vérifiée.
- Les sauvegardes locales d’alertes illisibles pouvaient être remplacées par une liste vide ; un identifiant navigateur non sauvegardé pouvait donner une fausse impression de persistance. Ces cas bloquent maintenant les écritures et affichent une erreur.
- Les actions de création/modification/suppression d’alertes sont désactivées pendant leur requête.
- Les recherches Analyzer sont temporisées et les précédentes annulées. Une saisie de symbole ne déclenche plus une analyse de mint invalide sans demander la sélection d’un résultat.
- Les cotations d’un ancien token ne peuvent plus apparaître pour un nouveau token. Le montant coté et la référence en euros sont indiqués. Changer la quantité invalide le résultat précédent.
- Jupiter V2 `priceImpact` est déjà exprimé en points de pourcentage ; l’ancien `priceImpactPct` est un ratio. L’affichage normalise ces deux formats au lieu de sous-estimer le ratio d’un facteur 100.
- Le logo d’une paire DEX où le mint était en contrepartie pouvait appartenir à l’autre token. Seul le token de base correspondant exactement au mint peut désormais fournir ce logo.
- Les restrictions de source sont indiquées dans Compare et le répertoire ; les recherches n’affichent plus « aucun résultat » avant la fin de leur temporisation.
- Les anciens chemins Intelligence Test et Search Backup utilisent désormais la page ou l’implémentation courante.
- Le titre Watchlist, les retours d’échec de copie et les contraintes de largeur des petites grilles sont corrigés.

## Parcours vérifiés pendant l’audit

| Page / fonction | Vérification exécutée |
| --- | --- |
| Site principal | Page, sections, mint, lien Analyzer, liens Raydium et avertissement de faible liquidité inspectés. |
| Analyzer | Mint transmis depuis Watchlist ; analyse PFX ; cotation SOL et aller-retour indicatif 10 € réellement obtenus ; aucune transaction construite ou envoyée. |
| Compare | Champs vides ; recherches PFX et BONK ; sélection des mints exacts ; comparaison des valeurs, réserves et limites de score. |
| Radar | Réponse de 100 lignes ; récupération des noms depuis le mint exact ; pagination, tri et filtres relus ; restrictions des sources et valeurs manquantes couvertes par les tests existants. |
| Répertoire | API, recherche Unicode et identification des défauts ; nouveaux cas de recherche, pagination, métadonnées et données historiques couverts par tests. |
| Watchlist | Saisie invalide rejetée ; copie exacte ; export réel ; réimport du même fichier sans doublon ; lien vers Analyzer avec le mint exact. Suppression locale relue dans le code ; pas de suppression de données utilisateur pendant l’audit. |
| Alertes | Création, lecture, mise en pause, isolation entre deux identifiants et suppression d’une alerte temporaire dédiée par l’API ; vérification manuelle du seuil avec valeur et date. La règle de test n’a jamais été activée dans le moniteur automatique. |
| Intelligence | Parcours Analyzer vers Intelligence et résultat réel PFX ; statut partiel, limites Token-2022 et absence de conclusion globale de sécurité vérifiés. |
| Obtenir PFX | Copie exacte, mints et identifiants des liens, guide et risques inspectés ; aucun wallet connecté et aucun échange exécuté. |
| Modules | Activity, Holders, Security, Token-2022, cotations, pool Raydium, santé des alertes interrogés ; tests ciblés pour routage RPC et pannes. |

## Limites qui ne doivent pas être présentées comme validées

- Les cycles automatiques des 12 et 13 novembre restent à observer via les tâches déjà programmées. Les tests du cron ne remplacent pas ces observations.
- La vérification visuelle exhaustive sur un téléphone réel / plusieurs tailles de navigateur n’a pas pu être exécutée dans cet environnement. Les styles étroits ont été relus et renforcés ; cela ne constitue pas une certification mobile.
- Les sources externes peuvent refuser, limiter ou différer leurs données. Pump.fun renvoie actuellement des refus HTTP 403. L’absence de source reste explicitement signalée.
- Les noms et symboles restent des métadonnées déclarées ; un nom récupéré ne valide ni le projet ni sa sécurité.
- Les endpoints d’ingestion et les tâches privées sont testés sans déclencher une ingestion arbitraire ni un traitement des alertes des utilisateurs.
- Les notifications e-mail, le multichain, Android et le paiement ne font pas partie de cette livraison Solana.

## Vérification de livraison

La compilation de production et la suite de régression doivent passer avant fusion. La préproduction sert à confirmer les filtres PostgREST avec de vraies données ; les pages publiques sont revérifiées après déploiement. Les journaux d’exécution sont inspectés sur le déploiement livré. Aucun résultat de ces contrôles à venir n’est présumé dans ce document.

## Complément de vérification de livraison

- Les huit pages publiques renvoient HTTP 200 ; Intelligence Test redirige vers Intelligence. Les deux seules images référencées par ces pages sont présentes (200). L’ancien visuel avec marquage Pump.fun n’est plus référencé.
- Token-2022 répond avec les données PFX via le RPC configuré. Le répertoire a retourné 25 noms sur 25 dans l’échantillon testé ; les noms récupérés sont aussi indexés pour que la recherche par nom puisse les retrouver. Une panne d’indexation conserve le nom affiché et signale l’attente.
- La recherche Gǒu ne se transforme plus en Gu. Les deux pages successives testées gardent le même instant de référence et ne contiennent aucun mint commun.
- La cotation de vente répond avec une unité explicite en points de pourcentage. L’ancienne route Search Backup renvoie le mint PFX déclaré en premier.
- Le contrôle de santé du moniteur distingue la configuration du passage quotidien d’une preuve d’exécution : il ne prétend pas que la dernière exécution a été vérifiée.
- Les requêtes POST de contrôle vers le webhook et le moniteur privé n’ont pas été validées comme test en production : le contrôle automatique d’autorisation les a refusées, à cause du risque d’ingestion ou de déclenchement d’un traitement. Leurs protections sont vérifiées par lecture du code et tests isolés. Aucune autorisation d’exécuter un traitement privé réel n’est présumée.
- Les parcours complémentaires du navigateur sont consignés dans la description de la livraison ; les limites mobile et cycles futurs ci-dessus restent ouvertes.

## Vérifications complémentaires

- Le compte rendu enregistré de la surveillance confirme le passage du cron du 11 novembre à 05:33:28 heure de Paris : HTTP 200, 779 ms, marqueur « PFX alerts cron completed ». Aucun bilan individuel des alertes : leur réussite complète n’est pas déduite de ce passage. Les contrôles des 12 et 13 restent programmés.
- Le répertoire masque immédiatement les résultats et bloque la pagination pendant la temporisation de saisie ; les anciens résultats ne sont plus présentés sous une nouvelle requête.
- Le champ de recherche inclut ses bordures et son espacement dans sa largeur, évitant un débordement sur les écrans étroits. La validation visuelle sur téléphone reste ouverte.

- Radar : l’absence de résultats filtrés est désormais affichée même lorsque le bloc PFX officiel reste visible. Le message précise la portée de la page et n’apparaît pas pendant une recherche externe en cours.

- Intelligence : validation du mint avant tout appel, rejet d’une réponse Analyzer portant un autre mint, blocage des doubles lancements, champ non modifiable pendant le traitement et suppression de l’ancien résultat dès modification du mint.
- Alertes persistantes : les objets/listes/booléens ne sont plus convertis en seuils numériques ; une valeur enabled non booléenne ou un objet alerte mal formé est rejeté avant écriture. Tests isolés uniquement, sans déclenchement du moniteur privé.
- Validation de cette livraison : 143 tests et compilation de production réussis.
