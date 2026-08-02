# PPP On Up — несколько VPN (RedirectDNS)

/ip dns cache flush;
/ip firewall nat remove [find comment="Redirect to Router"];
/ip firewall nat add action=redirect chain=dstnat src-address-list="RedirectDNS" comment="Redirect to Router" dst-port=53,5353,1253 protocol=udp;
/ip dns set servers=""
