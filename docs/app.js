(() => {
  const $ = (sel) => document.querySelector(sel);
  const form = $("#cfgForm");
  const preview = $("#preview");
  const confPaste = $("#confPaste");
  const toastEl = $("#toast");

  let extracted = { ca: "", cert: "", key: "" };

  const fields = [
    "connectTo",
    "port",
    "protocol",
    "cipher",
    "auth",
    "user",
    "password",
    "certificate",
    "dnsHint",
    "lanNetwork",
    "wanInterface",
    "defaultDns",
    "ovpnName",
    "profileName",
    "tlsVersion",
    "vpnMode",
    "rosVersion",
  ];

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function q(s) {
    return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }

  function setField(name, value) {
    const el = form.elements.namedItem(name);
    if (el && value != null) el.value = value;
  }

  function getValues() {
    const fd = new FormData(form);
    const v = Object.fromEntries(fields.map((k) => [k, String(fd.get(k) || "").trim()]));
    v.vpnMode = $("#vpnMode")?.value || v.vpnMode || "single";
    return v;
  }

  function mapCipher(raw) {
    if (!raw) return "aes128-gcm";
    const s = raw.toLowerCase().replace(/_/g, "-");
    if (s.includes("chacha20")) return "chacha20-poly1305";
    if (s.includes("aes-256-gcm") || s.includes("aes256-gcm")) return "aes256-gcm";
    if (s.includes("aes-128-gcm") || s.includes("aes128-gcm")) return "aes128-gcm";
    if (s.includes("aes-256") || s.includes("aes256")) return "aes256-cbc";
    if (s.includes("aes-128") || s.includes("aes128")) return "aes128-cbc";
    return s;
  }

  function extractBlock(text, tag) {
    const re = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, "i");
    const m = text.match(re);
    return m ? m[1].trim() + "\n" : "";
  }

  function parseOvpn(text) {
    if (!text || !text.trim()) {
      toast("Вставьте содержимое .ovpn");
      return;
    }

    const remotes = [...text.matchAll(/^\s*remote\s+(\S+)(?:\s+(\d+))?(?:\s+(\S+))?/gim)];
    if (remotes.length) {
      setField("connectTo", remotes[0][1]);
      if (remotes[0][2]) {
        setField("port", remotes[0][2]);
        document.querySelectorAll("[data-port]").forEach((b) =>
          b.classList.toggle("active", b.dataset.port === remotes[0][2])
        );
      }
      if (remotes[0][3] && /tcp|udp/i.test(remotes[0][3])) {
        const p = remotes[0][3].toLowerCase().includes("tcp") ? "tcp" : "udp";
        setField("protocol", p);
        setProto(p, false);
      }
    }

    const proto = text.match(/^\s*proto\s+(\S+)/im);
    if (proto) {
      const p = proto[1].toLowerCase().includes("tcp") ? "tcp" : "udp";
      setField("protocol", p);
      setProto(p, false);
    }

    const cipher = text.match(/^\s*cipher\s+(\S+)/im) || text.match(/^\s*data-ciphers\s+(\S+)/im);
    if (cipher) setField("cipher", mapCipher(cipher[1].split(":")[0]));

    const auth = text.match(/^\s*auth\s+(\S+)/im);
    if (auth) {
      const a = auth[1].toLowerCase();
      setField("auth", a === "none" ? "null" : a);
    }

    const user = text.match(/^\s*user\s+(\S+)/im);
    if (user) setField("user", user[1].replace(/"/g, ""));

    extracted = {
      ca: extractBlock(text, "ca"),
      cert: extractBlock(text, "cert"),
      key: extractBlock(text, "key"),
    };

    updateCertButtons();
    refresh();
    toast("Конфиг разобран");
  }

  function updateCertButtons() {
    const st = $("#certsStatus");
    const has = Boolean(extracted.ca || extracted.cert || extracted.key);
    $("#btnDlCa").disabled = !extracted.ca;
    $("#btnDlCert").disabled = !extracted.cert;
    $("#btnDlKey").disabled = !extracted.key;
    if (st) {
      st.innerHTML = has
        ? "Сертификаты извлечены. Скачайте файлы → Files на MikroTik → System → Certificates → Import (сначала CA, потом cert, потом key)."
        : "В .ovpn нет блоков <code>&lt;ca&gt;</code>/<code>&lt;cert&gt;</code>/<code>&lt;key&gt;</code> — импортируйте файлы вручную или через PPP → Import .ovpn.";
    }
  }

  function downloadText(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Скачан " + filename);
  }

  function dnsFor(scheme, proto) {
    const base = scheme === "10" ? "10.29" : "172.29";
    return proto === "tcp" ? `${base}.4.1` : `${base}.0.1`;
  }

  function setProto(proto, fillPort) {
    document.querySelectorAll("[data-proto]").forEach((b) => {
      b.classList.toggle("active", b.dataset.proto === proto);
    });
    setField("protocol", proto);
    if (fillPort) {
      const port = "50443";
      setField("port", port);
      document.querySelectorAll("[data-port]").forEach((b) =>
        b.classList.toggle("active", b.dataset.port === port)
      );
    }
    const scheme = currentScheme();
    setField("dnsHint", dnsFor(scheme, proto));
    refreshSchemeHint();
    refresh();
  }

  function currentScheme() {
    return document.querySelector("[data-scheme].active")?.dataset.scheme || "172";
  }

  function activateScheme(scheme) {
    document.querySelectorAll("[data-scheme]").forEach((b) => {
      b.classList.toggle("active", b.dataset.scheme === scheme);
    });
    const proto = form.elements.protocol?.value || "udp";
    setField("dnsHint", dnsFor(scheme, proto));
    refreshSchemeHint();
    refresh();
  }

  function refreshSchemeHint() {
    const hint = $("#schemeHint");
    if (!hint) return;
    const scheme = currentScheme();
    const proto = form.elements.protocol?.value || "udp";
    const dns = dnsFor(scheme, proto);
    const ros = form.elements.rosVersion?.value || "7.20";
    const udpWarn =
      ros === "7.19" && proto === "udp"
        ? ` <strong>На 7.19.x UDP часто нестабилен</strong> — лучше TCP (` +
          `<a href="https://forum.mikrotik.com/t/mikrotik-openvpn-client-over-udp-stopped-forwarding-traffic-on-routeros-7-10-1/167951" target="_blank" rel="noopener">форум</a>).`
        : "";
    hint.innerHTML =
      `${proto.toUpperCase()} · схема <strong>${scheme}…</strong> · ожидаемый DNS <code>${dns}</code>. ` +
      `Порты шаблона AZ: <strong>50443</strong> (+ резерв 504, 443; также 50080 / 80 / 508). На MikroTik — один connect-to.` +
      udpWarn;
  }

  function setVpnMode(mode) {
    $("#vpnMode").value = mode;
    document.querySelectorAll("[data-mode]").forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });
    const hint = $("#modeHint");
    if (hint) {
      hint.innerHTML =
        mode === "multi"
          ? "Несколько VPN: On Up добавляет Redirect DNS + mangle на LAN → OVPN."
          : "Один туннель: DNS от OVPN (<code>use-peer-dns=yes</code>), On Up только flush кэша.";
    }
    refresh();
  }

  const WAN_HINTS = {
    dhcp: "Укажите интерфейс с DHCP от провайдера (часто <code>ether1</code>). Скрипт выключит <code>use-peer-dns</code>.",
    pppoe:
      "Укажите имя PPPoE-клиента (часто <code>pppoe-out1</code>), не физический <code>ether1</code>. Скрипт выключит peer DNS и при необходимости добавит интерфейс в список WAN.",
  };

  function setWanType(type) {
    document.querySelectorAll("[data-wan]").forEach((btn) => {
      const on = btn.dataset.wan === type;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });
    const hint = $("#wanHint");
    if (hint) hint.innerHTML = WAN_HINTS[type] || WAN_HINTS.dhcp;
    const defIf = type === "pppoe" ? "pppoe-out1" : "ether1";
    const cur = form.elements.wanInterface?.value?.trim();
    if (!cur || cur === "ether1" || cur === "pppoe-out1") {
      setField("wanInterface", defIf);
      document.querySelectorAll("[data-wan-if]").forEach((b) =>
        b.classList.toggle("active", b.dataset.wanIf === defIf)
      );
    }
    refresh();
  }

  function escOnUp(script) {
    return script.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  }

  function buildOnUp(v) {
    if (v.vpnMode === "multi") {
      return `/ip dns cache flush;
/ip firewall nat remove [find comment="Redirect to Router"];
/ip firewall nat add action=redirect chain=dstnat src-address-list="RedirectDNS" comment="Redirect to Router" dst-port=53,5353,1253 protocol=udp;
/ip dns set servers=""`;
    }
    return `/ip dns cache flush;`;
  }

  function buildOnDown(v) {
    if (v.vpnMode === "multi") {
      return `/ip dns cache flush;
/ip firewall nat remove [find comment="Redirect to Router"];
/ip dns set servers=${v.defaultDns}`;
    }
    return `/ip dns cache flush;
/ip dns set servers=${v.defaultDns}`;
  }

  function buildRsc(v) {
    const onUp = escOnUp(buildOnUp(v));
    const onDown = escOnUp(buildOnDown(v));
    const passArg = v.password ? ` \\\n        password=${q(v.password)}` : "";
    const is720 = v.rosVersion !== "7.19";
    const verNote = is720
      ? "# Целевая версия: RouterOS 7.20+ (рекомендуется 7.21.4+ — фикс OVPN push-routes)"
      : "# Целевая версия: RouterOS 7.19.x (OVPN API тот же; при проблемах с маршрутами обновитесь до 7.21.4+)";
    const fileHint = is720 ? "az-ovpn-ready-7.20.rsc" : "az-ovpn-ready-7.19.rsc";
    const mangle =
      v.vpnMode === "multi"
        ? `
/ip firewall mangle remove [find address-list="RedirectDNS" out-interface=$azOvpnName]
/ip firewall mangle add chain=postrouting src-address=$azLanNetwork out-interface=$azOvpnName \\
    action=add-src-to-address-list address-list=RedirectDNS address-list-timeout=1m
`
        : `
# single-VPN: mangle RedirectDNS не нужен
`;

    return `###############################################################################
# AntiZapret OpenVPN — готовый скрипт для MikroTik
${verNote}
# Сгенерировано локально в браузере (секреты никуда не отправлялись)
# Перед импортом: загрузите ca.crt, client.crt, client.key в Files и:
#   /certificate import file-name=ca.crt
#   /certificate import file-name=client.crt
#   /certificate import file-name=client.key
# Проверьте имя сертификата (часто client.crt_0) и подставьте в azCertificate
# Импорт: /import file-name=${fileHint}
# Маршруты AntiZapret пушатся сервером OVPN — после обновления списков переподключите клиент
###############################################################################

:global azConnectTo ${q(v.connectTo)}
:global azPort ${q(v.port)}
:global azProtocol ${q(v.protocol)}
:global azCipher ${q(v.cipher)}
:global azAuth ${q(v.auth || "null")}
:global azUser ${q(v.user)}
:global azCertificate ${q(v.certificate)}
:global azLanNetwork ${q(v.lanNetwork)}
:global azWanInterface ${q(v.wanInterface)}
:global azDefaultDns ${q(v.defaultDns)}
:global azOvpnName ${q(v.ovpnName)}
:global azProfileName ${q(v.profileName)}
:global azTlsVersion ${q(v.tlsVersion || "any")}

/log warning "[AZ-OVPN] Установка OpenVPN AntiZapret..."

:if ([:len [/ppp profile find name=$azProfileName]] = 0) do={
    /ppp profile add name=$azProfileName change-tcp-mss=yes
} else={
    /ppp profile set [find name=$azProfileName] change-tcp-mss=yes
}
/ppp profile set [find name=$azProfileName] on-up="${onUp}" on-down="${onDown}"

:if ([:len [/interface ovpn-client find name=$azOvpnName]] = 0) do={
    /interface ovpn-client add name=$azOvpnName connect-to=$azConnectTo port=$azPort mode=ip \\
        protocol=$azProtocol user=$azUser${passArg} \\
        profile=$azProfileName certificate=$azCertificate verify-server-certificate=yes \\
        tls-version=$azTlsVersion auth=$azAuth cipher=$azCipher max-mtu=1420 \\
        use-peer-dns=yes add-default-route=no route-nopull=no disabled=no
} else={
    /interface ovpn-client set [find name=$azOvpnName] connect-to=$azConnectTo port=$azPort \\
        protocol=$azProtocol user=$azUser${passArg} \\
        profile=$azProfileName certificate=$azCertificate verify-server-certificate=yes \\
        tls-version=$azTlsVersion auth=$azAuth cipher=$azCipher max-mtu=1420 \\
        use-peer-dns=yes add-default-route=no route-nopull=no disabled=no
}

/ip firewall nat remove [find comment="Masquerade VPN" out-interface=$azOvpnName]
/ip firewall nat add chain=srcnat action=masquerade out-interface=$azOvpnName comment="Masquerade VPN"
${mangle}
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
/log warning "[AZ-OVPN] DNS peer hint: ${v.dnsHint} (фактический — от сервера OVPN)"
`;
  }

  function isReady(v) {
    return Boolean(v.connectTo && v.port && v.protocol && v.cipher && v.certificate && v.ovpnName);
  }

  function refresh() {
    const v = getValues();
    const btnDl = $("#btnDownload");
    const btnCp = $("#btnCopy");
    if (!isReady(v)) {
      preview.textContent =
        "Заполните connect-to, port, protocol, cipher и имя сертификата…\nСекреты обрабатываются только в браузере.";
      btnDl.disabled = true;
      btnCp.disabled = true;
      return;
    }
    preview.textContent = buildRsc(v);
    btnDl.disabled = false;
    btnCp.disabled = false;
  }

  function download() {
    const v = getValues();
    if (!isReady(v)) return;
    const name = v.rosVersion === "7.19" ? "az-ovpn-ready-7.19.rsc" : "az-ovpn-ready-7.20.rsc";
    downloadText(name, buildRsc(v));
  }

  async function copy() {
    const v = getValues();
    if (!isReady(v)) return;
    try {
      await navigator.clipboard.writeText(buildRsc(v));
      toast("Скопировано");
    } catch {
      toast("Не удалось скопировать");
    }
  }

  $("#btnParse").addEventListener("click", () => parseOvpn(confPaste.value));
  $("#btnClearPaste").addEventListener("click", () => {
    confPaste.value = "";
    extracted = { ca: "", cert: "", key: "" };
    updateCertButtons();
  });
  $("#btnDownload").addEventListener("click", download);
  $("#btnCopy").addEventListener("click", copy);
  $("#btnDlCa").addEventListener("click", () => downloadText("ca.crt", extracted.ca));
  $("#btnDlCert").addEventListener("click", () => downloadText("client.crt", extracted.cert));
  $("#btnDlKey").addEventListener("click", () => downloadText("client.key", extracted.key));

  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);

  const VERSION_HINTS = {
    "7.20":
      'Конфиг под <strong>7.20+</strong> (лучше <strong>7.21.4+</strong>): стабильнее приём push-маршрутов OpenVPN от AntiZapret. UDP обычно ок (+ Error-free на сервере); TCP — запасной надёжный вариант. Файл: <code>az-ovpn-ready-7.20.rsc</code>.',
    "7.19":
      'Конфиг под <strong>7.19.x</strong>: на ROS &lt; 7.20 OpenVPN <strong>UDP</strong> часто ломается (туннель up, трафик нет) — берите <strong>TCP</strong>. ' +
      'См. <a href="https://forum.mikrotik.com/t/mikrotik-openvpn-client-over-udp-stopped-forwarding-traffic-on-routeros-7-10-1/167951" target="_blank" rel="noopener">форум 7.10.1</a>, ' +
      '<a href="https://forum.mikrotik.com/t/openvpn-udp-packet-size-too-big-for-the-configured-mtu-ros-7-19-4-solved/264177" target="_blank" rel="noopener">MTU на 7.19.4</a>, ' +
      '<a href="https://help.mikrotik.com/docs/spaces/ROS/pages/2031655/OpenVPN" target="_blank" rel="noopener">docs: protocol default tcp</a>. ' +
      'Если маршруты не пушатся — обновите до 7.21.4+. Файл: <code>az-ovpn-ready-7.19.rsc</code>.',
  };

  function setRosVersion(ver) {
    const input = $("#rosVersion");
    if (input) input.value = ver;
    document.querySelectorAll(".version-btn").forEach((btn) => {
      const on = btn.dataset.ros === ver;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });
    const hint = $("#versionHint");
    if (hint) hint.innerHTML = VERSION_HINTS[ver] || VERSION_HINTS["7.20"];
    // На <7.20 UDP у OVPN-клиента часто ломается — предлагаем TCP.
    if (ver === "7.19") {
      setProto("tcp", true);
    } else {
      refreshSchemeHint();
      refresh();
    }
  }

  document.querySelectorAll(".version-btn").forEach((btn) => {
    btn.addEventListener("click", () => setRosVersion(btn.dataset.ros));
  });

  document.querySelectorAll("[data-proto]").forEach((btn) => {
    btn.addEventListener("click", () => setProto(btn.dataset.proto, true));
  });
  document.querySelectorAll("[data-scheme]").forEach((btn) => {
    btn.addEventListener("click", () => activateScheme(btn.dataset.scheme));
  });
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setVpnMode(btn.dataset.mode));
  });
  document.querySelectorAll("[data-port]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setField("port", btn.dataset.port);
      document.querySelectorAll("[data-port]").forEach((b) => b.classList.toggle("active", b === btn));
      refresh();
    });
  });
  document.querySelectorAll("[data-wan]").forEach((btn) => {
    btn.addEventListener("click", () => setWanType(btn.dataset.wan));
  });
  document.querySelectorAll("[data-wan-if]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setField("wanInterface", btn.dataset.wanIf);
      document.querySelectorAll("[data-wan-if]").forEach((b) => b.classList.toggle("active", b === btn));
      const type = btn.dataset.wanIf.startsWith("pppoe") ? "pppoe" : "dhcp";
      setWanType(type);
    });
  });

  confPaste.addEventListener("paste", () => {
    setTimeout(() => {
      if (/remote\s+/i.test(confPaste.value) || /<ca>/i.test(confPaste.value)) {
        parseOvpn(confPaste.value);
      }
    }, 0);
  });

  refreshSchemeHint();
  updateCertButtons();
  refresh();
})();
