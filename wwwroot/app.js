const sessionInput = document.getElementById("sessionId");
const connectButton = document.getElementById("connectButton");
const commandInput = document.getElementById("commandInput");
const sendButton = document.getElementById("sendButton");
const sampleSatelliteButton = document.getElementById("sampleSatelliteButton");
const sampleStationButton = document.getElementById("sampleStationButton");
const connectionStatus = document.getElementById("connectionStatus");
const logList = document.getElementById("logList");

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

const hubUrl =
  window.CESIUM_COMMAND_HUB_URL ||
  new URLSearchParams(window.location.search).get("hubUrl") ||
  "/hubs/commands";

const connection = new signalR.HubConnectionBuilder()
  .withUrl(hubUrl)
  .withAutomaticReconnect()
  .build();

connection.on("ReceiveCommand", (command) => {
  appendLog("收到指令", command);
  executeCesiumCommand(command);
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
    appendLog("连接失败", { hubUrl, error: error.message });
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
    return command;
  } catch (error) {
    appendLog("指令格式错误", { error: error.message });
    return null;
  }
}

function executeCesiumCommand(command) {
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
