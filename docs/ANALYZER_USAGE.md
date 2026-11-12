# Compteurs publics de l’Analyzer

Deux mesures démarrent lors de l’activation ; aucun historique antérieur n’est inventé.

- Visites : ouvertures de la page Analyzer. Recharger peut ajouter une visite ; ce n’est pas un décompte de personnes uniques ou de comptes connectés.
- Analyses : réponses réussies du moteur aux lancements manuels depuis Analyzer, même si les données sont partielles. Les requêtes internes, Compare, Intelligence, alertes et robots identifiés n’ajoutent pas ce compteur.
- Totaux et journée Europe/Paris ; rafraîchissement toutes les 30 secondes et après une analyse.

Aucun cookie ou identifiant persistant de visiteur. Aucun IP, mint, portefeuille ou profil dans les tables de statistiques. Un UUID aléatoire par événement sert uniquement à éviter les doubles incréments ; le journal de déduplication est nettoyé après sept jours, par lots bornés. Une empreinte réseau temporaire en mémoire serveur limite les abus ; elle n’est pas enregistrée dans la base.

Ces mesures sont indicatives : trafic automatisé non identifié, bloqueurs et interruptions peuvent modifier les chiffres. Le suivi ne doit jamais bloquer une analyse. Un service indisponible affiche N/D, pas un faux zéro.

## Mise en place

Le SQL `db/analyzer-usage.sql` crée deux tables et deux fonctions SECURITY INVOKER à search_path fixe. RLS active ; aucune permission pour anon/authenticated ; accès par clé serveur existante seulement. Les fonctions d’écriture sont réservées à service_role. `/api/usage` n’expose que des agrégats et ne permet publiquement que l’événement visite ; les analyses sont comptées côté serveur après réussite.

VERCEL_ENV=production, origine et hôte officiels obligatoires pour les écritures. Les previews ne comptent pas. Pour vérifier la production sans polluer les chiffres, ouvrir `/?usage=off` ; les tests automatisés utilisent ce paramètre.

## Validation

172 tests passent : contrats d’API, origine, production/preview, robots, limites de débit, UUID/type, zéro authentique, agrégats mal formés, panne de mesure et exclusion des analyses internes. Le comptage atomique et la déduplication SQL doivent être vérifiés en transaction annulée avant activation. La lecture privée des tables doit rester inaccessible aux rôles publics.
