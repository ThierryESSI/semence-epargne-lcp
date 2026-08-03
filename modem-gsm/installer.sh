#!/bin/bash
# Script d'installation automatique du pont GSM
# A executer sur le serveur/PC qui recevra les SMS
# © 2024-2026 MaGestion Facile — M. Thierry ESSI

echo "Installation du pont GSM Semence Epargne..."

# Creer les dossiers
sudo mkdir -p /var/spool/sms/{inbox,outbox,sent,error}
sudo mkdir -p /opt/semenceep
sudo mkdir -p /var/log

# Copier le script
sudo cp recevoir_sms.py /opt/semenceep/
sudo chmod +x /opt/semenceep/recevoir_sms.py

# Installer les dependances
sudo apt update -qq
sudo apt install -y python3 python3-pip gammu gammu-smsd
pip3 install requests

# Configurer les variables
echo "SEMENCEEP_API_URL=https://api.semenceep.ci/api/sms/entrant" | sudo tee -a /etc/environment
echo "SMS_WEBHOOK_SECRET=lcp_sms_secret_2026" | sudo tee -a /etc/environment

# Creer le service systemd pour demarrage automatique
sudo tee /etc/systemd/system/gammu-smsd.service << 'SERVICE'
[Unit]
Description=Gammu SMS Daemon — Semence Epargne
After=network.target

[Service]
Type=forking
ExecStart=/usr/bin/gammu-smsd --config /etc/gammu-smsdrc --daemon
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl enable gammu-smsd
sudo systemctl start gammu-smsd

echo "Installation terminee !"
echo "Verifiez avec : sudo systemctl status gammu-smsd"
echo "Logs : tail -f /var/log/semenceep-sms.log"
