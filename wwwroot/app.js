const sessionInput = document.getElementById("sessionId");
const connectButton = document.getElementById("connectButton");
const commandInput = document.getElementById("commandInput");
const sendButton = document.getElementById("sendButton");
const sampleSatelliteButton = document.getElementById("sampleSatelliteButton");
const sampleStationButton = document.getElementById("sampleStationButton");
const connectionStatus = document.getElementById("connectionStatus");
const logList = document.getElementById("logList");

function getHubUrlFromHash() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) {
    return null;
  }
  const qs = raw.startsWith("?") ? raw.slice(1) : raw;
  if (!qs.includes("=")) {
    return null;
  }
  try {
    return new URLSearchParams(qs).get("hubUrl");
  } catch {
    return null;
  }
}

const hubUrl =
  window.CESIUM_COMMAND_HUB_URL ||
  new URLSearchParams(window.location.search).get("hubUrl") ||
  getHubUrlFromHash() ||
  "/hubs/commands";

function hubSignalRTargetsCurrentOrigin(url) {
  try {
    const absolute = /^https?:\/\//i.test(url)
      ? url
      : new URL(url, window.location.origin).href;
    return new URL(absolute).origin === window.location.origin;
  } catch {
    return true;
  }
}

function isVercelPreviewOrProductionHost() {
  const host = window.location.hostname;
  return host === "vercel.app" || host.endsWith(".vercel.app");
}

function vercelHubHintMessage() {
  const example = `${window.location.origin}/?hubUrl=https://你的-dotnet-域名/hubs/commands`;
  return (
    "当前站点在 Vercel 上仅为静态页面，没有 SignalR 服务；默认连接同源 /hubs/commands 会失败，浏览器或 SignalR 可能提示与 proxy/WebSocket 有关。" +
    `请把 .NET 后端单独部署后，用查询参数指定 Hub，例如：${example}` +
    "（后端需在 CORS 中允许本 Vercel 域名。）"
  );
}

function maybeShowStaticHostingHubHint() {
  if (!isVercelPreviewOrProductionHost() || !hubSignalRTargetsCurrentOrigin(hubUrl)) {
    return;
  }
  const panel = document.querySelector(".panel");
  if (!panel || panel.querySelector(".deploy-hint")) {
    return;
  }
  const box = document.createElement("div");
  box.className = "deploy-hint";
  box.setAttribute("role", "status");
  box.textContent = vercelHubHintMessage();
  panel.insertBefore(box, panel.firstChild);
}

Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4M2ZhYzM4My1lN2NhLTRjNTktODY1OC1jZDdmOTU3Y2ZjMGEiLCJpZCI6MTMwNTAsInNjb3BlcyI6WyJhc3IiLCJnYyJdLCJpYXQiOjE1NjI0NzA5NzB9.rRTs6chsWJdo9KNYe5VjJj2fUzMHeniIJvFQOd0aLJU";

const viewer = new Cesium.Viewer("cesiumContainer", {
  animation: false,
  baseLayerPicker: true,
  geocoder: false,
  homeButton: true,
  sceneModePicker: true,
  timeline: false,
  navigationHelpButton: false
});

viewer.scene.globe.enableLighting = true;
viewer.camera.flyHome(0);

maybeShowStaticHostingHubHint();

const connection = new signalR.HubConnectionBuilder()
  .withUrl(hubUrl)
  .withAutomaticReconnect()
  .build();

// 注册响应函数: ReceiveCommand
connection.on("ReceiveCommand", async (command) => {
    appendLog("收到指令", command);
    executeCesiumCommand(command);

    // 回传执行结果（可选）
    if (command.senderSessionId != null) {
        const response = {
            sessionId: command.senderSessionId,
            status: `指令 ${command.action} 已执行`,
            params: {}
        };
        await connection.invoke("SendResponse", response);
    }
});

connection.onreconnecting(() => setConnectionState("正在重连...", "warn"));
connection.onreconnected(async () => {
  setConnectionState("已重连", "ok");
  await joinCurrentSession();
});
connection.onclose(() => setConnectionState("已断开", "error"));

connectButton.addEventListener("click", async () => {
  try {
    if (connection.state === signalR.HubConnectionState.Disconnected) {
      await connection.start();
    }

    await joinCurrentSession();
  } catch (error) {
    setConnectionState("连接失败", "error");
    const payload = { hubUrl, error: error.message };
    if (isVercelPreviewOrProductionHost() && hubSignalRTargetsCurrentOrigin(hubUrl)) {
      payload.hint = vercelHubHintMessage();
    }
    appendLog("连接失败", payload);
  }
});

sendButton.addEventListener("click", async () => {
  const command = parseCommand();
  if (!command) {
    return;
  }

  await sendCommand(command);
});

sampleSatelliteButton.addEventListener("click", () => {
  commandInput.value = JSON.stringify(
    {
      target: "entity",
      action: "createSatellite",
      params: {
        id: "SAT-01",
        name: "Starlink Demo",
        longitude: 116.391,
        latitude: 39.907,
        altitude: 550000,
        color: "#00d4ff"
      }
    },
    null,
    2
  );
});

sampleStationButton.addEventListener("click", () => {
  commandInput.value = JSON.stringify(
    {
      target: "entity",
      action: "createGroundStation",
      params: {
        id: "GS-01",
        name: "Beijing Station",
        longitude: 116.391,
        latitude: 39.907,
        altitude: 0,
        color: "#ffca3a"
      }
    },
    null,
    2
  );
});

async function joinCurrentSession() {
  const sessionId = getSessionId();
  await connection.invoke("JoinSession", sessionId);
  setConnectionState(`已连接会话：${sessionId}`, "ok");
  appendLog("加入会话", { sessionId });
}

async function sendCommand(command) {
  if (connection.state !== signalR.HubConnectionState.Connected) {
    appendLog("发送失败", { error: "请先连接 SignalR 会话" });
    return;
  }

  const commandWithSession = {
    ...command,
    sessionId: getSessionId()
  };

  await connection.invoke("SendCommand", commandWithSession);
  appendLog("已发送指令", commandWithSession);
}



function parseCommand() {
  try {
    const command = JSON.parse(commandInput.value);
    if (!command.action || typeof command.action !== "string") {
      throw new Error("JSON 必须包含字符串 action 字段");
    }

    command.params ??= {};
    const t = command.target;
    if (typeof t !== "string" || !t.trim()) {
      command.target = "entity";
    } else {
      command.target = t.trim();
    }
    return command;
  } catch (error) {
    appendLog("指令格式错误", { error: error.message });
    return null;
  }
}

// Cesium客户端，所有响应指令json的都在这里处理
function executeCesiumCommand(command) {
  const target =
    typeof command.target === "string" && command.target.trim()
      ? command.target.trim()
      : "entity";
  if (target !== "entity") {
    appendLog("未实现的 target", { target, action: command.action });
    return;
  }
  switch (command.action) {
    case "createSatellite":
      createSatellite(command.params);
      break;
    case "createGroundStation":
      createGroundStation(command.params);
      break;
    case "clearScene":
      viewer.entities.removeAll();
      break;
    case "flyTo":
      flyTo(command.params);
      break;
    default:
      appendLog("未知 action", command);
      break;
  }
}


function createSatellite(params) {
  removeEntityIfExists(params.id);
  const position = positionFromParams(params, 550000);
  const entity = viewer.entities.add({
    id: params.id,
    name: params.name ?? params.id ?? "Satellite",
    position,
    point: {
      pixelSize: 12,
      color: colorFromParam(params.color, Cesium.Color.CYAN),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2
    },
    label: createLabel(params.name ?? params.id ?? "Satellite"),
    path: {
      show: true,
      leadTime: 0,
      trailTime: 3600,
      width: 2,
      material: colorFromParam(params.color, Cesium.Color.CYAN).withAlpha(0.55)
    }
  });

  viewer.flyTo(entity);
}

function createGroundStation(params) {
  removeEntityIfExists(params.id);
  const position = positionFromParams(params, 0);
  const entity = viewer.entities.add({
    id: params.id,
    name: params.name ?? params.id ?? "Ground Station",
    position,
    billboard: {
      image: createStationIcon(params.color),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      scale: 0.8
    },
    label: createLabel(params.name ?? params.id ?? "Ground Station")
  });

  viewer.flyTo(entity);
}

function flyTo(params) {
  const destination = positionFromParams(params, params.altitude ?? 1200000);
  viewer.camera.flyTo({ destination });
}

function positionFromParams(params, defaultAltitude) {
  const longitude = Number(params.longitude ?? params.lon ?? 0);
  const latitude = Number(params.latitude ?? params.lat ?? 0);
  const altitude = Number(params.altitude ?? defaultAltitude);
  return Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude);
}

function removeEntityIfExists(id) {
  if (!id) {
    return;
  }

  const existingEntity = viewer.entities.getById(id);
  if (existingEntity) {
    viewer.entities.remove(existingEntity);
  }
}

function createLabel(text) {
  return {
    text,
    font: "14px sans-serif",
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    pixelOffset: new Cesium.Cartesian2(0, -28)
  };
}

function colorFromParam(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return Cesium.Color.fromCssColorString(value);
  } catch {
    return fallback;
  }
}

function createStationIcon(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext("2d");

  context.fillStyle = color ?? "#ffca3a";
  context.strokeStyle = "#ffffff";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(24, 4);
  context.lineTo(42, 40);
  context.lineTo(6, 40);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#101624";
  context.beginPath();
  context.arc(24, 25, 7, 0, Math.PI * 2);
  context.fill();

  return canvas.toDataURL("image/png");
}

function getSessionId() {
  return sessionInput.value.trim() || "demo";
}

function setConnectionState(text, level) {
  connectionStatus.textContent = text;
  connectionStatus.dataset.level = level;
}

function appendLog(title, payload) {
  const item = document.createElement("li");
  const time = new Date().toLocaleTimeString();
  item.innerHTML = `<strong>${time} ${title}</strong><pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
  logList.prepend(item);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.getElementById("sendBtn").onclick = async function () {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
        appendLog("请先连接 SignalR。");
        return;
    }
    const sessionId = document.getElementById("sessionId").value;
    const receiverSessionId = document.getElementById("receiverSessionId").value;
    let command;
    try {
        command = JSON.parse(document.getElementById("commandInput").value);
        command.sessionId = sessionId;
        command.SenderSessionId = sessionId;
        command.ReceiverSessionId = receiverSessionId;
    } catch (e) {
        appendLog("请输入有效的 JSON 指令！");
        return;
    }
    try {
        await connection.invoke("SendCommand", command);
        appendLog("已发送指令: " + JSON.stringify(command));
    } catch (err) {
        appendLog("发送指令失败: " + err.toString());
    }
};
