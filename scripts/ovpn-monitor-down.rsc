# PPP profile On Down — один VPN (AntiZapret)
# Замените 8.8.8.8 на DNS fallback / провайдера при необходимости

/ip dns cache flush;
/ip dns set servers=8.8.8.8
