# Guide Installation Modem GSM — Semence Epargne
# © 2024-2026 MaGestion Facile — M. Thierry ESSI

## MATERIEL A ACHETER (une seule fois)

### Modem GSM USB (~15 000 FCFA)
Commandez sur Jumia CI ou achetez dans une boutique informatique :
- Huawei E3131 (recommande)
- ZTE MF190
- OU tout modem USB 3G compatible Linux

### Carte SIM LCP dédiée
- Achetez une carte SIM Orange CI, MTN CI ou Moov Africa
- Choisissez un numéro facile à retenir (c'est LE numéro que vos clients vont mémoriser)
- Rechargez-la avec des crédits SMS (pas besoin d'internet)
- Exemple : 07 XX XX XX XX → c'est le "numéro LCP" que vous communiquez aux clients

### PC/Ordinateur dédié
- Un vieux PC Windows ou Linux suffit
- Doit rester allumé 24h/24
- Connecté à internet (WiFi ou câble)

---

## INSTALLATION (Ubuntu/Linux — recommandé)

```bash
# 1. Cloner ou copier le dossier modem-gsm sur le PC
cd /opt && sudo mkdir semenceep && cd semenceep

# 2. Lancer le script d'installation
chmod +x installer.sh
sudo ./installer.sh

# 3. Brancher le modem USB et vérifier qu'il est détecté
ls /dev/ttyUSB*
# Doit afficher /dev/ttyUSB0

# 4. Configurer Gammu avec votre modem
sudo nano /etc/gammu-smsdrc
# Remplissez device = /dev/ttyUSB0 (ou ttyUSB1 selon le modem)

# 5. Démarrer le service
sudo systemctl start gammu-smsd
sudo systemctl status gammu-smsd
```

---

## INSTALLATION (Windows — alternatif)

1. Installez Python 3.10+ depuis python.org
2. Installez Gammu pour Windows : gammu.org/gammu/download
3. Installez les dépendances :
   ```
   pip install requests pyserial
   ```
4. Modifiez recevoir_sms.py avec votre port COM (ex: COM3)
5. Configurez Gammu pour appeler recevoir_sms.py

---

## CONFIGURATION FINALE

Modifiez les variables dans /etc/environment (Linux) :
```
SEMENCEEP_API_URL=https://api.semenceep.ci/api/sms/entrant
SMS_WEBHOOK_SECRET=lcp_sms_secret_2026
```

---

## TEST

Envoyez ce SMS depuis un téléphone client enregistré vers votre carte SIM LCP :
```
RECHARGE SE-XXXXXXXX CSEM-REF-CARTE 1234
```

Vérifiez les logs :
```bash
tail -f /var/log/semenceep-sms.log
```

---

## CE QUE VOS CLIENTS DOIVENT SAVOIR

Communiquez ce message simple à vos clients en zone rurale :

---
"Pour recharger votre compte Semence Epargne par SMS :
Envoyez : RECHARGE [votre numero de compte] [reference de votre carte] [code 4 chiffres]
Au numéro : 07XXXXXXXX (votre numéro LCP)
Exemple : RECHARGE SE-A1B2C3D4 CSEM-NHR-010 5781"
---

Imprimez ce message sur des fiches distribuées par vos conseillers terrain.

---

## OPTION C — WhatsApp Business (en plus du GSM)

Pour les clients avec smartphone, configurez également WhatsApp Business :

1. Créez un compte Meta Business sur business.facebook.com
2. Ajoutez WhatsApp Business API
3. Configurez le webhook :
   - URL : https://api.semenceep.ci/api/sms/whatsapp
   - Token de vérification : SemenceEpWhatsApp2026
4. Ajoutez dans Railway :
   - WHATSAPP_VERIFY_TOKEN = SemenceEpWhatsApp2026
5. Les clients envoient le MEME format sur WhatsApp :
   RECHARGE SE-XXXXXXXX CSEM-REF-CARTE 1234

Le serveur traite SMS GSM et WhatsApp exactement de la même façon.
