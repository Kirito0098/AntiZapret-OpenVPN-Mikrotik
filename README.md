# 🚀 AntiZapret OpenVPN → MikroTik

> Инструкция и **онлайн-генератор** для подключения MikroTik (RouterOS 7) к [AntiZapret-VPN](https://github.com/GubernievS/AntiZapret-VPN) через OpenVPN.  
> Скриншоты WinBox сохранены; команды и порты приведены к актуальным артефактам сервера.

---

## Оглавление

- [Онлайн-генератор](#онлайн-генератор-github-pages)
- [Что понадобится](#-что-понадобится)
- [Схемы IP и порты](#-схемы-ip-и-порты)
- [1️⃣ Подготовка сертификатов](#1️⃣-подготовка-сертификатов)
- [2️⃣ PPP-профиль (On Up / On Down)](#2️⃣-ppp-профиль-on-up--on-down)
- [3️⃣ OpenVPN-клиент](#3️⃣-openvpn-клиент)
- [4️⃣ Маскарадинг](#4️⃣-маскарадинг)
- [5️⃣ DNS](#5️⃣-dns)
- [6️⃣ WAN: DHCP или PPPoE](#6️⃣-wan-dhcp-или-pppoe)
- [7️⃣ Проверка](#7️⃣-проверка)
- [Автоустановка fill/](#автоустановка-fill)
- [Полезные советы](#-полезные-советы)
- [Ссылки](#ссылки)

---

### Онлайн-генератор (GitHub Pages)

Откройте **[генератор](https://kirito0098.github.io/AntiZapret-OpenVPN-Mikrotik/)** → вставьте `*.ovpn` → скачайте `ca.crt` / `client.crt` / `client.key` и `az-ovpn-ready.rsc` → загрузите на MikroTik → импортируйте сертификаты → `/import file-name=az-ovpn-ready.rsc`.

Сертификаты и пароль обрабатываются **только в браузере**.

---

## 📦 Что понадобится

- Роутер MikroTik с **RouterOS 7.x**
- Файлы с сервера AntiZapret: `/root/antizapret/client/` — `antizapret-*-udp.ovpn` (рекомендуется) или `*-tcp.ovpn`
- Доступ WinBox / Terminal
- Для обхода блокировок протокола на сервере: патч OpenVPN UDP; для MikroTik часто удобен режим **Error-free** в setup AntiZapret

> Нужен WireGuard вместо OpenVPN? → [AntiZapret-WG-Mikrotik](https://github.com/Kirito0098/AntiZapret-WG-Mikrotik)

---

## 📡 Схемы IP и порты

| | OpenVPN UDP | OpenVPN TCP |
|--|-------------|-------------|
| Типичный DNS / шлюз | `10.29.0.1` или `172.29.0.1` | `10.29.4.1` или `172.29.4.1` |
| Основные порты | **50080**, **50443** | те же |
| Резервные порты | 80, 443, 504, 508 | те же |

- Схема **10…** — клиенты по умолчанию AntiZapret  
- Схема **172…** — альтернативные клиенты  
- Cipher по умолчанию: **AES-128-GCM** (`aes128-gcm` на MikroTik); без AES-NI попробуйте CHACHA20-POLY1305  

**Маршруты:** сервер пушит их через OpenVPN (CCD `DEFAULT`). Отдельного `mikrotik-openvpn-routes.txt` нет. После обновления списков AntiZapret на сервере достаточно **переподключить** OVPN-клиент на роутере.

---

## 1️⃣ Подготовка сертификатов

### Вариант A — из `.ovpn` (или генератор)

1. Блоки `<ca>`, `<cert>`, `<key>` → файлы `ca.crt`, `client.crt`, `client.key` (генератор делает это кнопками).
2. **Files → Upload** на MikroTik.
3. **System → Certificates → Import** (по очереди CA, cert, key) или:

```mikrotik
/certificate import file-name=ca.crt
/certificate import file-name=client.crt
/certificate import file-name=client.key
```

Убедитесь, что CA **trusted**, запомните имя клиентского сертификата (часто `client.crt_0`).

### Вариант B — PPP → Import .ovpn

Загрузите `.ovpn` в Files → **PPP → Import .ovpn**.

![Загрузка сертификатов в Files](screenshot/WinBox_O7tKKLxq7T.png)
*Files → Upload и System → Certificates → Import*

---

## 2️⃣ PPP-профиль (On Up / On Down)

Профиль задаёт скрипты при поднятии/падении туннеля.

### Один VPN (только AntiZapret)

**On Up:**

```
/ip dns cache flush;
```

**On Down:**

```
/ip dns cache flush;
/ip dns set servers=8.8.8.8
```

Готовые тексты: [`scripts/ovpn-monitor-up.rsc`](scripts/ovpn-monitor-up.rsc), [`scripts/ovpn-monitor-down.rsc`](scripts/ovpn-monitor-down.rsc).

### Несколько VPN

On Up добавляет Redirect DNS; On Down снимает его. См. `scripts/ovpn-monitor-*-multi.rsc` и режим «Несколько VPN» в генераторе.

Дополнительно mangle (LAN → OVPN):

```mikrotik
/ip firewall mangle add chain=postrouting src-address=192.168.88.0/24 \
    action=add-src-to-address-list address-list=RedirectDNS address-list-timeout=1m \
    out-interface=ovpn-out1
```

![PPP Profiles и On Up/On Down](screenshot/WinBox_NlGBITlPFB.png)
*PPP → Profiles → On Up / On Down*

---

## 3️⃣ OpenVPN-клиент

**WinBox:** Interfaces → OVPN Client → Add:

| Поле | Значение |
|------|----------|
| Connect To | хост из `remote` |
| Port | 50080 / 50443 / резерв |
| Mode | ip |
| Protocol | **udp** (предпочтительно) или tcp |
| User / Password | из профиля сервера |
| Profile | `VPN_PROFILE` |
| Certificate | `client.crt_0` (ваше имя) |
| Verify Server Certificate | yes |
| TLS Version | any |
| Auth | null (часто при GCM) |
| Cipher | aes128-gcm |
| Use Peer DNS | **yes** |
| Add Default Route | **no** |
| Route No Pull | **no** (маршруты с сервера) |

```mikrotik
/interface ovpn-client add name=ovpn-out1 connect-to=vpn.example.com port=50080 mode=ip \
    protocol=udp user=antizapret-client profile=VPN_PROFILE certificate=client.crt_0 \
    verify-server-certificate=yes tls-version=any auth=null cipher=aes128-gcm \
    use-peer-dns=yes add-default-route=no route-nopull=no
```

![OVPN Client Add](screenshot/WinBox_wfWeU2MNUz.png)
*Interfaces → OVPN Client → Add*

---

## 4️⃣ Маскарадинг

```mikrotik
/ip firewall nat add chain=srcnat action=masquerade out-interface=ovpn-out1 comment="Masquerade VPN"
```

![Masquerade VPN Rule](screenshot/WinBox_o3pm3kl1zC.png)
*IP → Firewall → NAT*

---

## 5️⃣ DNS

Разрешите роутеру отвечать LAN:

```mikrotik
/ip dns set allow-remote-requests=yes
```

DNS AntiZapret приходит с OVPN (`use-peer-dns=yes`). Не дублируйте жёсткий DNS в On Up в режиме одного VPN.

![DNS Allow Remote Requests](screenshot/WinBox_hLyiGo2JIy.png)
*IP → DNS*

---

## 6️⃣ WAN: DHCP или PPPoE

Отключите DNS провайдера, иначе он перебьёт AntiZapret.

### DHCP / кабель (`ether1`)

```mikrotik
/ip dhcp-client set [find interface=ether1] use-peer-dns=no
```

### PPPoE

Указывайте имя **PPPoE-клиента** (`pppoe-out1`), не физический `ether1`:

```mikrotik
/interface pppoe-client set [find name=pppoe-out1] use-peer-dns=no
/interface list member add list=WAN interface=pppoe-out1
```

(Автоустановщик / генератор добавят член списка WAN, если его ещё нет.)

![DHCP Client Add](screenshot/WinBox_WfS4CCVDPU.png)
*IP → DHCP Client (для варианта DHCP)*

---

## 7️⃣ Проверка

```mikrotik
/interface ovpn-client print
/ip route print
/ip dns print
```

Статус интерфейса должен быть **R** (running). С LAN проверьте IP (2ip.ru и т.п.) — для доменов AntiZapret трафик пойдёт через OVPN.

---

## Автоустановка fill/

1. Извлеките сертификаты, импортируйте на роутер  
2. Скопируйте [`fill/az-ovpn-vars.rsc.example`](fill/az-ovpn-vars.rsc.example) → `az-ovpn-vars.rsc`, заполните  
3. Загрузите вместе с [`fill/az-ovpn-install.rsc`](fill/az-ovpn-install.rsc)  

```mikrotik
/import file-name=az-ovpn-vars.rsc
/import file-name=az-ovpn-install.rsc
```

Пример команд: [`example-ovpn.rsc`](example-ovpn.rsc).

---

## 💡 Полезные советы

- Не поднимается: сертификаты trusted? порт/proto совпадают с `.ovpn`? на сервере патч UDP / Error-free для MikroTik?
- Нет обхода: маршруты приходят с сервера — переподключите OVPN после обновления списков AntiZapret; проверьте `use-peer-dns=yes` и что WAN peer-dns выключен
- MTU/TCPMSS: в профиле `change-tcp-mss=yes`; при обрывах уменьшите MTU на сервере/клиенте
- Не публикуйте `.ovpn`, `.crt`, `.key` в git (см. `.gitignore`)

---

## Ссылки

- [Онлайн-генератор](https://kirito0098.github.io/AntiZapret-OpenVPN-Mikrotik/)
- [GubernievS/AntiZapret-VPN](https://github.com/GubernievS/AntiZapret-VPN)
- [AntiZapret-WG-Mikrotik](https://github.com/Kirito0098/AntiZapret-WG-Mikrotik)
- [MikroTik OpenVPN](https://help.mikrotik.com/docs/display/ROS/OpenVPN)
