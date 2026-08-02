# PPP On Down — несколько VPN

/ip dns cache flush;
/ip firewall nat remove [find comment="Redirect to Router"];
/ip dns set servers=8.8.8.8
