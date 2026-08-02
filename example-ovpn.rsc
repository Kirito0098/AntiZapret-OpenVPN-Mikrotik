# Фрагмент OVPN-части (сертификат и пароль замените)

/ppp profile
add name=AZ_VPN change-tcp-mss=yes \
    on-up="/ip dns cache flush;" \
    on-down="/ip dns cache flush;\r\n/ip dns set servers=8.8.8.8"

/interface ovpn-client
add name=ovpn-out1 connect-to=vpn.example.com port=50443 mode=ip protocol=tcp \
    user=user profile=AZ_VPN certificate=client.crt_0 \
    verify-server-certificate=yes tls-version=any auth=null cipher=aes128-gcm max-mtu=1420 \
    use-peer-dns=yes add-default-route=no route-nopull=no

/ip firewall nat
add chain=srcnat action=masquerade out-interface=ovpn-out1 comment="Masquerade VPN"

/ip dhcp-client
set [find interface=ether1] use-peer-dns=no
# PPPoE:
# /interface pppoe-client set [find name=pppoe-out1] use-peer-dns=no
# /interface list member add list=WAN interface=pppoe-out1

/ip dns
set allow-remote-requests=yes
