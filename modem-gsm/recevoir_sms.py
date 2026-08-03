#!/usr/bin/env python3
# recevoir_sms.py — Pont Modem GSM → API Semence Epargne
# Appelé automatiquement par Gammu à chaque SMS reçu
# © 2024-2026 MaGestion Facile — M. Thierry ESSI

import os
import sys
import json
import requests
import logging
from datetime import datetime

# Configuration
API_URL       = os.environ.get('SEMENCEEP_API_URL', 'https://api.semenceep.ci/api/sms/entrant')
WEBHOOK_SECRET = os.environ.get('SMS_WEBHOOK_SECRET', 'lcp_sms_secret_2026')
LOG_FILE      = '/var/log/semenceep-sms.log'

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='%(asctime)s — %(levelname)s — %(message)s'
)

def main():
    # Gammu passe les SMS via variables d'environnement
    expediteur = os.environ.get('SMS_1_NUMBER', '')
    message    = os.environ.get('SMS_1_TEXT', '')
    
    # Fallback : lire depuis les arguments ou stdin
    if not expediteur and len(sys.argv) > 1:
        expediteur = sys.argv[1]
    if not message and len(sys.argv) > 2:
        message = sys.argv[2]

    if not expediteur or not message:
        logging.error('SMS recu sans expediteur ou message')
        sys.exit(1)

    logging.info(f'SMS recu de {expediteur}: {message[:50]}...')

    # Envoyer à l'API Semence Epargne
    payload = {
        'expediteur': expediteur,
        'message':    message,
        'canal':      'GSM_MODEM',
        'timestamp':  datetime.now().isoformat()
    }

    try:
        response = requests.post(
            API_URL,
            json=payload,
            headers={
                'Content-Type':    'application/json',
                'X-Webhook-Secret': WEBHOOK_SECRET
            },
            timeout=30
        )
        
        if response.status_code == 200:
            logging.info(f'API OK — {expediteur} traite avec succes')
        else:
            logging.error(f'API erreur {response.status_code}: {response.text}')
            
    except requests.exceptions.ConnectionError:
        logging.error(f'Connexion API impossible — verifier internet')
    except requests.exceptions.Timeout:
        logging.error(f'Timeout API — reessai dans 60s')
    except Exception as e:
        logging.error(f'Erreur inattendue: {str(e)}')

if __name__ == '__main__':
    main()
