# Примеры для AntiZapret OpenVPN → MikroTik
#
# Порты (шаблон AZ): первый remote 50443, затем 504, 443; также 50080 / 80 / 508
# DNS:
#   UDP 10… → 10.29.0.1 · UDP 172… → 172.29.0.1
#   TCP 10… → 10.29.4.1 · TCP 172… → 172.29.4.1
# Маршруты: CCD push с сервера (не mikrotik-*-routes.txt)
# MTU: 1420 · патч UDP MikroTik: patch-openvpn.sh 2 (Error-free)
#
# Онлайн-генератор: docs/ (GitHub Pages)
