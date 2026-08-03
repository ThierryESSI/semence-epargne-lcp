# Modem GSM USB — Recharge SMS Zone Rurale
# © 2024-2026 MaGestion Facile — M. Thierry ESSI

## Matériel requis
- Modem GSM USB : Huawei E3131 ou ZTE MF190 (~15 000 FCFA sur Jumia CI)
- Carte SIM CI dédiée LCP (Orange/MTN/Moov — numéro 10 chiffres)
- Un ordinateur/serveur toujours allumé (peut être un vieux PC)

## Installation (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install python3 python3-pip gammu gammu-smsd -y
pip3 install requests pyserial
```

## Configuration Gammu
Créer /etc/gammu-smsdrc :
```
[gammu]
device = /dev/ttyUSB0
connection = at115200

[smsd]
service = files
logfile = /var/log/gammu-smsd.log
inboxpath = /var/spool/sms/inbox/
outboxpath = /var/spool/sms/outbox/
sentsmspath = /var/spool/sms/sent/
errorsmspath = /var/spool/sms/error/
RunOnReceive = /opt/semenceep/recevoir_sms.py
```

## Démarrage
```bash
sudo gammu-smsd --config /etc/gammu-smsdrc --daemon
```
