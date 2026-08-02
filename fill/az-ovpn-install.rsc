###############################################################################
# AntiZapret OpenVPN — автоустановка на MikroTik
# Рекомендуется RouterOS 7.20+ (лучше 7.21.4+ — фикс OVPN push-routes).
# На 7.19.x скрипт тот же по API клиента.
#
# Перед запуском:
#   1. ca.crt / client.crt / client.key в Files → Certificates Import
#   2. Заполните и импортируйте az-ovpn-vars.rsc
#
# Запуск: /import file-name=az-ovpn-install.rsc
###############################################################################

:global azConnectTo
:global azPort
:global azProtocol
:global azCipher
:global azAuth
:global azUser
:global azPassword
:global azCertificate
:global azLanNetwork
:global azWanInterface
:global azDefaultDns
:global azOvpnName
:global azProfileName
:global azTlsVersion
:global azVpnMode

:if ([:typeof $azConnectTo] = "nothing" || $azConnectTo = "" || $azConnectTo ~ "example.com") do={
    /log error "[AZ-OVPN] Сначала заполните и импортируйте az-ovpn-vars.rsc"
    :error "az-ovpn-vars.rsc not loaded"
}
:if ([:typeof $azCertificate] = "nothing" || $azCertificate = "") do={
    /log error "[AZ-OVPN] Не задан azCertificate"
    :error "azCertificate missing"
}

:if ([:typeof $azPort] = "nothing" || $azPort = "") do={ :set azPort "50443" }
:if ([:typeof $azProtocol] = "nothing" || $azProtocol = "") do={ :set azProtocol "udp" }
:if ([:typeof $azCipher] = "nothing" || $azCipher = "") do={ :set azCipher "aes128-gcm" }
:if ([:typeof $azAuth] = "nothing" || $azAuth = "") do={ :set azAuth "null" }
:if ([:typeof $azUser] = "nothing" || $azUser = "") do={ :set azUser "antizapret-client" }
:if ([:typeof $azOvpnName] = "nothing" || $azOvpnName = "") do={ :set azOvpnName "ovpn-out1" }
:if ([:typeof $azProfileName] = "nothing" || $azProfileName = "") do={ :set azProfileName "VPN_PROFILE" }
:if ([:typeof $azDefaultDns] = "nothing" || $azDefaultDns = "") do={ :set azDefaultDns "8.8.8.8" }
:if ([:typeof $azTlsVersion] = "nothing" || $azTlsVersion = "") do={ :set azTlsVersion "any" }
:if ([:typeof $azVpnMode] = "nothing" || $azVpnMode = "") do={ :set azVpnMode "single" }
:if ([:typeof $azWanInterface] = "nothing" || $azWanInterface = "") do={ :set azWanInterface "ether1" }
:if ([:typeof $azLanNetwork] = "nothing" || $azLanNetwork = "") do={ :set azLanNetwork "192.168.88.0/24" }

/log warning "[AZ-OVPN] Начинаю установку OpenVPN AntiZapret..."

:local onUp "/ip dns cache flush;"
:local onDown ("/ip dns cache flush;\r\n/ip dns set servers=" . $azDefaultDns)
:if ($azVpnMode = "multi") do={
    :set onUp "/ip dns cache flush;\r\n/ip firewall nat remove [find comment=\"Redirect to Router\"];\r\n/ip firewall nat add action=redirect chain=dstnat src-address-list=\"RedirectDNS\" comment=\"Redirect to Router\" dst-port=53,5353,1253 protocol=udp;\r\n/ip dns set servers=\"\""
    :set onDown ("/ip dns cache flush;\r\n/ip firewall nat remove [find comment=\"Redirect to Router\"];\r\n/ip dns set servers=" . $azDefaultDns)
}

:if ([:len [/ppp profile find name=$azProfileName]] = 0) do={
    /ppp profile add name=$azProfileName change-tcp-mss=yes
} else={
    /ppp profile set [find name=$azProfileName] change-tcp-mss=yes
}
/ppp profile set [find name=$azProfileName] on-up=$onUp on-down=$onDown

:if ([:len [/interface ovpn-client find name=$azOvpnName]] = 0) do={
    /interface ovpn-client add name=$azOvpnName connect-to=$azConnectTo port=$azPort mode=ip \
        protocol=$azProtocol user=$azUser profile=$azProfileName certificate=$azCertificate \
        verify-server-certificate=yes tls-version=$azTlsVersion auth=$azAuth cipher=$azCipher mtu=1420 \
        use-peer-dns=yes add-default-route=no route-nopull=no disabled=no
} else={
    /interface ovpn-client set [find name=$azOvpnName] connect-to=$azConnectTo port=$azPort \
        protocol=$azProtocol user=$azUser profile=$azProfileName certificate=$azCertificate \
        verify-server-certificate=yes tls-version=$azTlsVersion auth=$azAuth cipher=$azCipher mtu=1420 \
        use-peer-dns=yes add-default-route=no route-nopull=no disabled=no
}
:if ([:typeof $azPassword] != "nothing" && $azPassword != "") do={
    /interface ovpn-client set [find name=$azOvpnName] password=$azPassword
}

/ip firewall nat remove [find comment="Masquerade VPN" out-interface=$azOvpnName]
/ip firewall nat add chain=srcnat action=masquerade out-interface=$azOvpnName comment="Masquerade VPN"

/ip firewall mangle remove [find address-list="RedirectDNS" out-interface=$azOvpnName]
:if ($azVpnMode = "multi") do={
    /ip firewall mangle add chain=postrouting src-address=$azLanNetwork out-interface=$azOvpnName \
        action=add-src-to-address-list address-list=RedirectDNS address-list-timeout=1m
}

:if ([:len [/ip dhcp-client find interface=$azWanInterface]] > 0) do={
    /ip dhcp-client set [find interface=$azWanInterface] use-peer-dns=no
}
:if ([:len [/interface pppoe-client find name=$azWanInterface]] > 0) do={
    /interface pppoe-client set [find name=$azWanInterface] use-peer-dns=no
    :if ([:len [/interface list find name=WAN]] > 0) do={
        :if ([:len [/interface list member find list=WAN interface=$azWanInterface]] = 0) do={
            /interface list member add list=WAN interface=$azWanInterface comment="AZ-OVPN: PPPoE WAN"
        }
    }
}

/ip dns set allow-remote-requests=yes

/log warning "[AZ-OVPN] Готово. Статус: /interface ovpn-client print"
/log warning "[AZ-OVPN] Certificate=$azCertificate — сверьте с System → Certificates"
