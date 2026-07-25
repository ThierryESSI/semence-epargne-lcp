# Guide — Recharge par SMS (Zone Rurale)

## Comment ça fonctionne

Le client envoie un SMS depuis son téléphone GSM (même basique, pas besoin d'internet) :

```
RECHARGE SE-A1B2C3D4 CSEM-NHR-010-8C0G 5781
```

Le serveur LCP reçoit le SMS, vérifie les informations, et crédite le compte automatiquement.
Le client reçoit un SMS de confirmation avec son nouveau solde.

---

## Format du SMS

```
RECHARGE [NUMÉRO-COMPTE] [RÉFÉRENCE-CARTE] [CODE-4-CHIFFRES]
```

| Champ | Exemple | Description |
|---|---|---|
| Commande | `RECHARGE` ou `R` | Mot-clé (insensible à la casse) |
| N° compte | `SE-A1B2C3D4` | Numéro de compte LCP du client |
| Réf. carte | `CSEM-NHR-010-8C0G` | Référence imprimée sur la carte |
| Code | `5781` | Code 4 chiffres imprimé au verso |

**Exemple complet :**
```
RECHARGE SE-A1B2C3D4 CSEM-NHR-010-8C0G 5781
```

---

## Configuration SpecialSMS (specialsms.net)

### 1. Obtenir un numéro court Côte d'Ivoire
- Contacter SpecialSMS pour un numéro entrant CI (ex: 1234)
- Les clients enverront leurs SMS à ce numéro

### 2. Configurer le webhook dans le dashboard SpecialSMS
- URL du webhook : `https://ton-api.railway.app/api/sms/entrant`
- Méthode : `POST`
- Ajouter l'en-tête : `X-Webhook-Secret: votre_secret_dans_env`

### 3. Variables d'environnement backend
```env
SMS_WEBHOOK_SECRET="votre_secret_partagé_avec_specialsms"
```

---

## Vérifications de sécurité côté serveur

1. ✅ Secret webhook (header X-Webhook-Secret)
2. ✅ Numéro expéditeur = propriétaire du compte (anti-fraude)
3. ✅ Carte DISPONIBLE ou VENDUE (pas UTILISEE ou ANNULEE)
4. ✅ Code 4 chiffres vérifié par hash bcrypt
5. ✅ Transaction atomique Prisma (crédit + marquage carte en même temps)
6. ✅ Audit log complet pour chaque opération

---

## Tester le webhook (admin)

```bash
# Tester sans SMS réel (depuis Postman ou curl)
POST /api/sms/test
Authorization: Bearer <token_master>
{
  "telephone": "+22507123456",
  "message": "RECHARGE SE-A1B2C3D4 CSEM-NHR-010-8C0G 5781"
}
```

---

## SMS reçus par le client

**Succès :**
```
LCP SEMENCE: Recharge OK Aya Marie KOUAME!
Carte: CSEM-NHR-010-8C0G
+24 750 F credite.
Solde: 49 500 F.
Ref: TXN-SMS-1234567890
```

**Erreur code incorrect :**
```
LCP SEMENCE: Code incorrect pour la carte CSEM-8C0G. Verifiez le verso.
Format: RECHARGE [N-COMPTE] [REF-CARTE] [CODE4]
```

**Erreur carte déjà utilisée :**
```
LCP SEMENCE: Carte CSEM-8C0G deja utilisee.
```

---

## Comparaison des canaux d'activation

| Canal | Réseau requis | Téléphone | Délai |
|---|---|---|---|
| Application web (QR) | 4G/5G/WiFi | Smartphone | Immédiat |
| SMS entrant ← **nouveau** | 2G suffit | Tout GSM | Immédiat |
| USSD (*123#) | 2G | Tout GSM | 3-6 mois (agrément ARTCI) |

