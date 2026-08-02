# 🚀 AntiZapret OpenVPN на MikroTik

> Инструкция по подключению MikroTik к **[AntiZapret-VPN](https://github.com/GubernievS/AntiZapret-VPN)** через OpenVPN.  
> Шаги с пояснениями и скриншотами WinBox + онлайн-генератор конфига.

Рекомендуется **RouterOS 7.20+** (лучше **7.21.4+** для OVPN push-routes); генератор также отдаёт профиль под **7.19.x**.  
На **RouterOS ниже 7.20** OpenVPN **UDP** на клиенте MikroTik часто работает плохо — берите **TCP** (см. [сноску про UDP](#udp-на-ros--720)). Для WireGuard: [AntiZapret-WG-Mikrotik](https://github.com/Kirito0098/AntiZapret-WG-Mikrotik).

---

## Оглавление

- [Онлайн-генератор](#онлайн-генератор-github-pages)
- [Что понадобится](#-что-понадобится)
- [Схемы IP и порты](#-схемы-ip-и-порты)
- [UDP на ROS &lt; 7.20](#udp-на-ros--720)
- [1️⃣ Подготовка сертификатов](#1️⃣-подготовка-сертификатов)
- [2️⃣ PPP-профиль (On Up / On Down)](#2️⃣-ppp-профиль-on-up--on-down)
- [3️⃣ OpenVPN-клиент](#3️⃣-openvpn-клиент)
- [4️⃣ Masquerade](#4️⃣-masquerade)
- [5️⃣ DNS](#5️⃣-dns)
- [6️⃣ WAN: DHCP или PPPoE](#6️⃣-wan-dhcp-или-pppoe)
- [7️⃣ Проверка](#7️⃣-проверка)
- [Автоустановка fill/](#автоустановка-fill)
- [Полезные советы](#-полезные-советы)

---

### Онлайн-генератор (GitHub Pages)

Откройте **[генератор конфига](https://kirito0098.github.io/AntiZapret-OpenVPN-Mikrotik/)** → выберите версию (**7.20+** или **7.19.x**) → вставьте `*.ovpn` → скачайте сертификаты и `az-ovpn-ready-7.20.rsc` (или `…-7.19.rsc`) → загрузите в Files → импортируйте сертификаты → `/import file-name=az-ovpn-ready-7.20.rsc`.

Ключи обрабатываются **только в браузере**.

---

## 📦 Что понадобится

- Роутер MikroTik с **RouterOS 7.x** (рекомендуется **7.20+**, лучше **7.21.4+** из‑за фикса OVPN push-routes; есть профиль генератора и под **7.19.x**)
- WinBox / WebFig / Terminal
- Клиентский файл с сервера AntiZapret:  
  `/root/antizapret/client/` → на **7.20+** удобнее **`*-udp.ovpn`**; на **&lt; 7.20** надёжнее **`*-tcp.ovpn`** ([почему](#udp-на-ros--720))
- На сервере AntiZapret для MikroTik часто ставят патч OpenVPN **Error-free** (см. setup AntiZapret-VPN)

---

## 🔢 Схемы IP и порты

| | OpenVPN UDP | OpenVPN TCP |
|--|-------------|-------------|
| Клиент / DNS (схема `10…`) | `10.29.0.x` / `10.29.0.1` | `10.29.4.x` / `10.29.4.1` |
| Клиент / DNS (схема `172…`) | `172.29.0.x` / `172.29.0.1` | `172.29.4.x` / `172.29.4.1` |

**Порты:** в клиентских шаблонах AntiZapret первый `remote` — **50443**, затем резерв **504**, **443** (при включённых резервных портах на сервере также **50080**, **80**, **508**).  
На MikroTik указывается **один** `connect-to` + `port` (в отличие от нескольких `remote` в `.ovpn`).

**Маршруты:** сервер пушит их через OpenVPN CCD (`route-nopull=no` на клиенте).  
Отдельного `mikrotik-openvpn-routes.txt` нет (в отличие от WireGuard — там `mikrotik-wireguard-routes.txt`).  
После `/root/antizapret/doall.sh` на сервере — **переподключите** OVPN на MikroTik.

**DNS:** push `dhcp-option DNS *.29.0.1` / `*.29.4.1` + `block-outside-dns`. На MikroTik: `use-peer-dns=yes` на OVPN и `use-peer-dns=no` на WAN.

**Шифрование:** AES-128-GCM → `cipher=aes128-gcm`. При OpenVPN DCO на сервере — только GCM/ChaCha. Без AES-NI на роутере попробуйте `chacha20-poly1305`.

**MTU:** на сервере `tun-mtu 1420` — в клиенте ставим `max-mtu=1420` (у OVPN-клиента параметр именно `max-mtu`, не `mtu`).

**Патч UDP:** для MikroTik на сервере часто `/root/antizapret/patch-openvpn.sh 2` (**Error-free**).

**Fake 198.18:** опция сервера для подменных IP в маршрутах; DNS-шлюз клиента остаётся `*.29.0.1` / `*.29.4.1`.

<a id="udp-на-ros--720"></a>

> **UDP на RouterOS &lt; 7.20.** У OVPN-клиента MikroTik транспорт **UDP** на старых 7.x неоднократно ломался: туннель поднимается (IP есть), а трафик не ходит, либо зависает TLS/handshake — при этом **TCP** обычно работает. У самого MikroTik у клиента по умолчанию как раз `protocol=tcp` ([документация OpenVPN](https://help.mikrotik.com/docs/spaces/ROS/pages/2031655/OpenVPN)).  
> Доказательства с форума: [UDP не форвардит после 7.10.1, TCP ок](https://forum.mikrotik.com/t/mikrotik-openvpn-client-over-udp-stopped-forwarding-traffic-on-routeros-7-10-1/167951); [UDP «Link established», handshake нестабилен vs TCP](https://forum.mikrotik.com/viewtopic.php?t=211836); [OVPN UDP к Linux-серверу / unroutable control packet](https://forum.mikrotik.com/t/ovpn-in-udp-with-linux-ovpn-server/167789); [UDP TLS timeout к pfSense](https://forum.mikrotik.com/t/openvpn-udp-between-pfsense-and-mikrotik/168480); на **7.19.4** ещё и [UDP/MTU/DF](https://forum.mikrotik.com/t/openvpn-udp-packet-size-too-big-for-the-configured-mtu-ros-7-19-4-solved/264177).  
> **Итог:** на **&lt; 7.20** ставьте **TCP** (`*-tcp.ovpn`, порт всё тот же **50443**). На **7.20+** UDP обычно приемлемее (+ патч Error-free на сервере), но TCP по-прежнему самый предсказуемый вариант на MikroTik.

---

## 1️⃣ Подготовка сертификатов

### Вариант A — генератор / извлечение из `.ovpn`

1. В [генераторе](https://kirito0098.github.io/AntiZapret-OpenVPN-Mikrotik/) вставьте `.ovpn` и скачайте `ca.crt`, `client.crt`, `client.key`  
   **или** вырежьте блоки `<ca>`, `<cert>`, `<key>` вручную.
2. **Files → Upload** на MikroTik.
3. **System → Certificates → Import** (по очереди: CA, cert, key):

```mikrotik
/certificate import file-name=ca.crt
/certificate import file-name=client.crt
/certificate import file-name=client.key
```

Проверьте, что у CA **trusted = yes**. Имя клиентского сертификата часто `client.crt_0` — его укажите в OVPN Client / генераторе.

### Вариант B — PPP → Import .ovpn

Загрузите весь `.ovpn` в Files → **PPP → Import .ovpn**. Сертификаты и часть настроек появятся сами; профиль и NAT всё равно проверьте по инструкции ниже.

![Загрузка сертификатов в Files](screenshot/WinBox_O7tKKLxq7T.png)
*Files → Upload и System → Certificates → Import*

---

## 2️⃣ PPP-профиль (On Up / On Down)

Создайте профиль, например `VPN_PROFILE`.

### Один VPN (только AntiZapret) — рекомендуется

- **On Up:**
  ```
  /ip dns cache flush;
  ```
- **On Down:**
  ```
  /ip dns cache flush;
  /ip dns set servers=8.8.8.8
  ```

Готовые тексты: [`scripts/ovpn-monitor-up.rsc`](scripts/ovpn-monitor-up.rsc), [`scripts/ovpn-monitor-down.rsc`](scripts/ovpn-monitor-down.rsc).

DNS AntiZapret приходит с OVPN (`use-peer-dns=yes` на клиенте) — не дублируйте жёсткий DNS в On Up.

### Несколько VPN

Нужны Redirect DNS + mangle. Скрипты: [`scripts/ovpn-monitor-up-multi.rsc`](scripts/ovpn-monitor-up-multi.rsc), [`scripts/ovpn-monitor-down-multi.rsc`](scripts/ovpn-monitor-down-multi.rsc).

```mikrotik
/ip firewall mangle add chain=postrouting src-address=192.168.88.0/24 \
    action=add-src-to-address-list address-list=RedirectDNS address-list-timeout=1m \
    out-interface=ovpn-out1
```

![PPP Profiles и On Up/On Down](screenshot/WinBox_NlGBITlPFB.png)
*PPP → Profiles → Add и вкладки On Up/On Down*

---

## 3️⃣ OpenVPN-клиент

**Interfaces → OVPN Client → Add:**

| Поле | Значение |
|------|----------|
| Connect To | хост из `remote` |
| Port | из `.ovpn` (часто **50443**) |
| Mode | ip |
| Protocol | **tcp** на ROS **&lt; 7.20**; на **7.20+** — **udp** или **tcp** ([сноска](#udp-на-ros--720)) |
| User / Password | из `.ovpn` (часто `user` + пароль) |
| Profile | `AZ_VPN` (или своё имя) |
| Certificate | имя после Import (например `cert_ovpn-import…`) |
| Verify Server Certificate | yes |
| TLS Version | any |
| Auth | `null` |
| Cipher | `aes128-gcm` |
| Use Peer DNS | **yes** |
| Add Default Route | **no** |
| Route No Pull | **no** (галочка Don't Add Pushed Routes снята) |

Рабочий эталон Dial Out: Port **50443**, Protocol **tcp**, Auth **null**, Cipher **aes 128 gcm**, Peer DNS **yes**, Default Route off → Status **connected / RUNNING**.

```mikrotik
/interface ovpn-client add name=ovpn-out1 connect-to=vpn.example.com port=50443 mode=ip \
    protocol=tcp user=user profile=AZ_VPN certificate=client.crt_0 \
    verify-server-certificate=yes tls-version=any auth=null cipher=aes128-gcm max-mtu=1420 \
    use-peer-dns=yes add-default-route=no route-nopull=no
```

![OVPN Client Add](screenshot/WinBox_wfWeU2MNUz.png)
*Interfaces → OVPN Client → Add*

---

## 4️⃣ Masquerade

Чтобы LAN ходила в интернет через VPN:

```mikrotik
/ip firewall nat add chain=srcnat action=masquerade out-interface=ovpn-out1 comment="Masquerade VPN"
```

![Masquerade VPN Rule](screenshot/WinBox_o3pm3kl1zC.png)
*IP → Firewall → NAT*

---

## 5️⃣ DNS

Разрешите роутеру отвечать клиентам LAN:

```mikrotik
/ip dns set allow-remote-requests=yes
```

![DNS Allow Remote Requests](screenshot/WinBox_hLyiGo2JIy.png)
*IP → DNS*

---

## 6️⃣ WAN: DHCP или PPPoE

Отключите DNS провайдера, иначе он перебьёт AntiZapret.

### DHCP / кабель (часто `ether1`)

```mikrotik
/ip dhcp-client set [find interface=ether1] use-peer-dns=no
```

### PPPoE

Укажите **имя PPPoE-клиента** (`pppoe-out1`), не физический `ether1`:

```mikrotik
/interface pppoe-client set [find name=pppoe-out1] use-peer-dns=no
/interface list member add list=WAN interface=pppoe-out1
```

(Автоустановщик / генератор добавят член WAN, если его ещё нет.)

![DHCP Client Add](screenshot/WinBox_WfS4CCVDPU.png)
*IP → DHCP Client (вариант DHCP)*

---

## 7️⃣ Проверка

```mikrotik
/interface ovpn-client print
```

Статус **R** (running) — туннель поднят. Проверьте IP на 2ip.ru с устройства в LAN.

```mikrotik
/ip route print
/log print
```

После обновления списков на сервере AntiZapret: отключите/включите OVPN-клиент (reconnect), чтобы подтянуть новые маршруты.

---

## Автоустановка (`fill/`)

1. Импортируйте сертификаты (см. §1).
2. Скопируйте [`fill/az-ovpn-vars.rsc.example`](fill/az-ovpn-vars.rsc.example) → `az-ovpn-vars.rsc`, заполните.
3. Загрузите вместе с [`fill/az-ovpn-install.rsc`](fill/az-ovpn-install.rsc).
4. Терминал:

```mikrotik
/import file-name=az-ovpn-vars.rsc
/import file-name=az-ovpn-install.rsc
```

Пример команд: [`example-ovpn.rsc`](example-ovpn.rsc).

---

## 💡 Полезные советы

- Не подключается: сертификаты trusted? порт/proto? имя `certificate` совпадает с Certificates?
- UDP «connected», а сайты не открываются (особенно на **&lt; 7.20**): переключитесь на **TCP** — [сноска](#udp-на-ros--720)
- Нет интернета через VPN: есть ли Masquerade на `ovpn-out1`? `route-nopull=no`?
- DNS «ломается»: на WAN `use-peer-dns=no`; на OVPN `use-peer-dns=yes`
- MTU / FastTrack: при обрывах попробуйте clamp MSS в профиле (`change-tcp-mss=yes`) или временно отключить FastTrack
- Не публикуйте `.ovpn`, `.crt`, `.key` в git (см. `.gitignore`)

> Сервер и клиенты: [GubernievS/AntiZapret-VPN](https://github.com/GubernievS/AntiZapret-VPN)  
> WireGuard на MikroTik: [AntiZapret-WG-Mikrotik](https://github.com/Kirito0098/AntiZapret-WG-Mikrotik)
