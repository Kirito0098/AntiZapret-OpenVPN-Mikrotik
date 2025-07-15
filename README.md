# 🚀 Настройка OpenVPN на MikroTik

> **Инструкция по подключению MikroTik к VPN-серверу через OpenVPN**  
> Все шаги сопровождаются пояснениями и иллюстрациями.

---

## 📦 Что понадобится

- **Роутер MikroTik** с RouterOS (6+)
- **Доступ** к интерфейсу MikroTik (WinBox, WebFig или терминал)
- **Данные для VPN**: адрес сервера, порт, имя пользователя, пароль, сертификаты
- **Базовые знания** MikroTik (но всё объяснено максимально просто)

---

## 1️⃣ Подготовка сертификатов

### Вариант 1. Извлечение сертификатов из `.ovpn`

1. Откройте файл `.ovpn` и найдите блоки:
    - `<ca></ca>` → `ca.crt`
    - `<cert></cert>` → `client.crt`
    - `<key></key>` → `client.key`
2. Загрузите файлы на MikroTik:
    - **WinBox**:  
      `Files → Upload → выберите ca.crt, client.crt, client.key`
3. Импортируйте сертификаты:
    - **WinBox**:  
      `System → Certificates → Import (по одному)`
    - **Терминал**:
      ```
      /certificate import file-name=ca.crt
      /certificate import file-name=client.crt
      /certificate import file-name=client.key
      ```

### Вариант 2. Импортировать весь `.ovpn`

1. Загрузите `.ovpn`-файл:
    - **WinBox**:  
      `Files → Upload`
2. Импортируйте:
    - **WinBox**:  
      `PPP → Import .ovpn`

> **Проверьте сертификаты**  
> `System → Certificates`, колонка `trusted` должна быть **yes**

---

**💡 Пример: Загрузка и импорт сертификатов через WinBox**

![Загрузка сертификатов в Files](https://private-user-images.githubusercontent.com/58187639/466618642-d254604a-05b7-4267-8e03-7520a855c037.png)
*Files → Upload и System → Certificates → Import*

---

## 2️⃣ Настройка PPP-профиля

1. Создайте профиль, например, `VPN_PROFILE`:
    - **WinBox**:  
      `PPP → Profiles → Add (+)`  
      Заполните имя, остальные параметры по умолчанию или настройте.
    - **Терминал**:
      ```bash
      /ppp profile add name=VPN_PROFILE use-ipv6=yes use-mpls=default use-compression=default use-encryption=default only-one=default change-tcp-mss=default use-upnp=default
      ```
2. Добавьте скрипты для DNS и NAT:
    - **WinBox**:  
      `PPP → Profiles → выберите профиль → вкладки On Up/On Down`
      ```
      on-up
      /ip dns cache flush;
      /ip firewall nat add action=redirect chain=dstnat src-address=ВАША_ЛОКАЛЬНАЯ_СЕТЬ/24 comment="Redirect to Router" dst-port=53,5353,1253 protocol=udp;
      /ip dns set servers=""
      on-down
      /ip dns cache flush;
      /ip firewall nat remove [find comment="Redirect to Router"];
      /ip dns set servers=DNS_ПРОВАЙДЕРА
      ```
    - **Терминал**:
      ```bash
      /ppp profile set VPN_PROFILE on-up="/ip dns cache flush;\n/ip firewall nat add action=redirect chain=dstnat src-address='ВАША_ЛОКАЛЬНАЯ_СЕТЬ'/24 comment=\"Redirect to Router\" dst-port=53,5353,1253 protocol=udp;\n/ip dns set servers=\"\""
      /ppp profile set VPN_PROFILE on-down="/ip dns cache flush;\n/ip firewall nat remove [find comment=\"Redirect to Router\"];\n/ip dns set servers='DNS_ПРОВАЙДЕРА'"
      ```

> **Как узнать параметры:**
> - `ВАША_ЛОКАЛЬНАЯ_СЕТЬ`  
>   - **Консоль:** `/ip address print`
>   - **WinBox:** IP → Addresses → поле "Address"
> - `DNS_ПРОВАЙДЕРА`  
>   - **Консоль:** `/ip dhcp-client print detail` (ищите "dns-server")
>   - **WinBox:** IP → DHCP Client → выберите активный клиент → поле "DNS"

> **Описание:**
> - `on-up`: очищает кэш DNS, добавляет правило NAT, сбрасывает DNS
> - `on-down`: очищает кэш DNS, удаляет правило NAT, возвращает DNS

---

**💡 Пример: Создание PPP-профиля и добавление скриптов**

![PPP Profiles и On Up/On Down](https://private-user-images.githubusercontent.com/58187639/466618644-05d1862f-ce70-42a8-99ef-4d33e8c3cab8.png)
*PPP → Profiles → Add и вкладки On Up/On Down*

---

## 3️⃣ Настройка OpenVPN-клиента

- **WinBox**:  
  `Interfaces → OVPN Client → Add (+)`  
  Заполните поля:
  - Connect To: `VPN_SERVER_ADDRESS`
  - Port: `VPN_PORT`
  - Mode: ip
  - Protocol: tcp
  - User: `VPN_USER`
  - Password: `VPN_PASSWORD`
  - Profile: `VPN_PROFILE`
  - Certificate: `VPN_CERTIFICATE`
  - Verify Server Certificate: yes
  - TLS Version: any
  - Auth: null
  - Cipher: aes128-gcm
  - Use Peer DNS: yes
  - Add Default Route: no
  - Route No Pull: no

- **Терминал**:
  ```bash
  /interface ovpn-client add name=ovpn-out1 connect-to=VPN_SERVER_ADDRESS port=VPN_PORT mode=ip protocol=tcp user=VPN_USER password="VPN_PASSWORD" profile=VPN_PROFILE certificate=VPN_CERTIFICATE verify-server-certificate=yes tls-version=any auth=null cipher=aes128-gcm use-peer-dns=yes add-default-route=no route-nopull=no
  ```

> **Пояснения параметров:**  
> - `VPN_SERVER_ADDRESS` — адрес VPN-сервера  
> - `VPN_PORT` — порт  
> - `VPN_USER` — имя пользователя  
> - `VPN_PASSWORD` — пароль  
> - `VPN_CERTIFICATE` — имя сертификата

---

**💡 Пример: Добавление OpenVPN-клиента**

![OVPN Client Add](https://private-user-images.githubusercontent.com/58187639/466618645-196956aa-e098-4299-b241-bea19f1472dc.png)
*Interfaces → OVPN Client → Add*

---

## 4️⃣ Настройка DNS

- **WinBox**:  
  `IP → DNS → галочка "Allow Remote Requests"`
- **Терминал**:
  ```bash
  /ip dns set allow-remote-requests=yes
  ```

---

**💡 Пример: Включение Allow Remote Requests**

![DNS Allow Remote Requests](https://private-user-images.githubusercontent.com/58187639/466618641-312e50e6-3a2c-4c86-abaf-7c2e951ab44b.png)
*IP → DNS*

---

## 5️⃣ Настройка DHCP-клиента

- **WinBox**:  
  `IP → DHCP Client → Add (+)`  
  Interface: `ether1`, уберите галочку "Use Peer DNS", поставьте галочку "Add Default Route"
- **Терминал**:
  ```bash
  /ip dhcp-client add interface=ether1 use-peer-dns=no add-default-route=yes
  ```

> - `use-peer-dns=no` — отключает DNS от провайдера  
> - `add-default-route=yes` — добавляет маршрут по умолчанию

---

**💡 Пример: Добавление DHCP Client**

![DHCP Client Add](https://private-user-images.githubusercontent.com/58187639/466618643-d24ff7ec-3d85-4be8-a111-d217535e5e4a.png)
*IP → DHCP Client → Add*

---

## 6️⃣ Проверка подключения

1. **Статус OpenVPN:**
    - **WinBox**:  
      `Interfaces → OVPN Client → смотрите статус ("R" — running)`
    - **Терминал**:
      ```bash
      /interface ovpn-client print
      ```
2. **Проверка интернета через VPN:**  
   Зайдите на сайт проверки IP.
3. **Проверка логов:**
    ```bash
    /log print
    ```

---

**💡 Пример: Проверка статуса OVPN Client**

![Статус OVPN Client](https://private-user-images.githubusercontent.com/58187639/466618645-196956aa-e098-4299-b241-bea19f1472dc.png)
*Interfaces → OVPN Client (столбец Status)*

---

## 💡 Полезные советы

- Если VPN не подключается:
  - Проверьте сертификаты
  - Адрес и порт сервера
  - Имя пользователя и пароль
- Если интернет не работает через VPN:
  ```bash
  /tool torch interface=ovpn-out1  
  ```
- Для безопасности:  
  В профиле используйте `use-encryption=yes`

---

