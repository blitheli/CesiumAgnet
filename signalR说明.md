# SignalR 使用说明

本文说明本项目中 **服务器 Hub 的地址**、**浏览器端如何连接与调用**、**Python 等后端如何连接 Hub 并发送指令**，以及 `**CesiumCommand` 载荷结构**与 **创建地面站** 的 JSON 示例。

**本文档中涉及服务的地址统一为：`http://www.astrox.cn:8787`**（Hub 路径仍为 `/hubs/commands`）。

---

## 1. 服务器 Hub 连接地址

在 `Program.cs` 中，Hub 映射为：

- **路径**：`/hubs/commands`
- **类名**：`SatelliteCommandBus.Hubs.CommandHub`

### 1.1 同源（与网页同一站点）

若 ASP.NET 应用与网页同源，Hub 的完整地址为：

```text
http://www.astrox.cn:8787/hubs/commands
```

（若你本地或其它环境调试，将主机与端口替换为实际值即可；文档示例以 `www.astrox.cn:8787` 为准。）

### 1.2 跨域（前端与 Hub 不同源）

前端需使用 **绝对 URL** 指向 Hub：

```text
http://www.astrox.cn:8787/hubs/commands
```

**注意**：跨域时后端必须在 CORS 中允许前端页面的来源；若配置了 `appsettings.json` 中的 `Cors:AllowedOrigins`，需包含前端页面的来源（例如 `http://www.astrox.cn:8787` 或其它实际前端域名）。

---

## 2. 前端：引入 SignalR 客户端库

本仓库 `wwwroot/index.html` 使用 CDN 脚本（版本以页面为准）：

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.7/signalr.min.js"></script>
```

在业务脚本（如 `app.js`）之前加载，以便使用全局对象 `**signalR**`。

---

## 3. 前端：Hub 地址如何决定

`wwwroot/app.js` 中 Hub 地址按以下优先级解析（后者为默认值）：

1. `window.CESIUM_COMMAND_HUB_URL`（可在 `app.js` 之前内联脚本设置）
2. 查询参数 `?hubUrl=...`
3. 地址栏哈希中的参数，例如：
  `#hubUrl=https%3A%2F%2Fwww.astrox.cn%3A8787%2Fhubs%2Fcommands`  
   （值为 URL 编码后的 Hub 地址）
4. 默认：`/hubs/commands`（与当前页面同源）；若页面不在该主机上，建议显式设为：

```text
http://www.astrox.cn:8787/hubs/commands
```

示例：通过查询参数指定 Hub：

```text
http://www.astrox.cn:8787/?hubUrl=https%3A%2F%2Fwww.astrox.cn%3A8787%2Fhubs%2Fcommands
```

---

## 4. 前端：建立连接

与 `wwwroot/app.js` 一致，典型写法如下（默认直连文档约定主机上的 Hub）。

### 4.1 创建连接

```javascript
const hubUrl =
  window.CESIUM_COMMAND_HUB_URL ||
  new URLSearchParams(window.location.search).get("hubUrl") ||
  "http://www.astrox.cn:8787/hubs/commands";

const connection = new signalR.HubConnectionBuilder()
  .withUrl(hubUrl)
  .withAutomaticReconnect()
  .build();
```

### 4.2 启动连接

```javascript
await connection.start();
```

### 4.3 订阅服务端推送

Hub 会向组内客户端推送 `**ReceiveCommand**`，载荷为 `CesiumCommand` 对应的 JSON 对象（属性名一般为 camelCase，如 `action`、`params`、`target`、`sessionId`）。

```javascript

// 首先要加入会话，这样可通过sessionId区分不同客户端
connection.on("SessionJoined", (sessionId) => {
  console.log("已加入会话", sessionId);
});

// 订阅服务端广播的指令，参数为完整的 CesiumCommand 对象（JSON）
// 根据指令参数更新 Cesium 场景，例如创建实体、飞行到某位置、清空场景等
connection.on("ReceiveCommand", (command) => {
  // 根据 command.action / command.params 等更新 Cesium
});


```

### 4.4 调用 Hub 方法（客户端 → 服务器）


| 方法名           | 作用                                                  | 调用示例                                                 |
| ------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `JoinSession` | 将当前连接加入名为 `sessionId` 的组，之后才能收到该组的 `ReceiveCommand`/`ReceiveResponse` | `await connection.invoke("JoinSession", sessionId);` |
| `SendCommand` | 向指定 `sessionId` 组广播一条指令（对象形状见下文 `CesiumCommand`）    | `await connection.invoke("SendCommand", command);`   |
| `SendResponse` | 向指定 `sessionId` 组广播一条回传消息（对象形状见下文 `ResponseMessage`） | `await connection.invoke("SendResponse", response);`   |


**推荐顺序**：先 `start()`，再 `JoinSession(sessionId)`，再按需 `SendCommand(...)` / `SendResponse(...)`。

```javascript
const sessionId = "demo";

await connection.start();
await connection.invoke("JoinSession", sessionId);

await connection.invoke("SendCommand", {
  target: "entity",
  action: "createGroundStation",
  sessionId: sessionId,
  params: {
    id: "GS-01",
    name: "Beijing Station",
    longitude: 116.391,
    latitude: 39.907,
    altitude: 0,
    color: "#ffca3a"
  }
});

await connection.invoke("SendResponse", {
  sessionId: "sender-session",
  status: "指令 createGroundStation 已执行",
  params: {}
});
```

---

## 5. `CesiumCommand` 结构（与 JSON 字段对应）

C# 定义见 `Models/CesiumCommand.cs`，通过 SignalR 传递时使用 **JSON 对象**。常用属性名如下（与 ASP.NET Core 默认 JSON 的 camelCase 一致）。


| JSON 属性     | 类型     | 必填     | 说明                                                                 |
| ----------- | ------ | ------ | ------------------------------------------------------------------ |
| `action`    | string | 是      | 动作名，如 `createGroundStation`、`createSatellite`、`flyTo`、`clearScene` |
| `params`    | object | 建议始终提供 | 该动作的业务参数；空对象可写 `{}`                                                |
| `target`    | string | 否      | 作用目标，**省略时服务端默认为 `entity`**（Cesium 实体层）。勿传空字符串；其它取值需前后端约定          |
| `sessionId` | string | 由调用方保证 | 目标会话组 ID；网页端发送前通常会与当前输入框中的会话 ID 合并                                 |


服务端 `SendCommand` 会校验：`sessionId`、`action` 非空；`target` 不能为空字符串（省略则使用默认 `entity`）。

### 5.1 `ResponseMessage` 结构（回传消息）

C# 定义见 `Models/ResponseMessage.cs`，通过 SignalR 传递时使用 **JSON 对象**。

| JSON 属性         | 类型     | 必填 | 说明 |
| --------------- | ------ | ---- | ---- |
| `sessionId`     | string | 是   | 目标会话组 ID，发送到该组的客户端会收到 `ReceiveResponse` |
| `status`        | string | 是   | 回传状态文本，如“指令已执行” |
| `params`        | object | 否   | 附加回传参数，未提供时可省略 |
| `senderSessionId` | string | 否   | 可选的发送端会话 ID，用于标记回传来源 |

服务端 `SendResponse` 会校验：`sessionId` 非空。
}
```

说明：

- `longitude` / `latitude` / `altitude`：地面站位置；前端也可用 `lon` / `lat` 别名（见 `app.js` 中 `positionFromParams`）。
- `color`：可选，CSS 颜色字符串。
- `target` 可省略，省略时与 `"entity"` 等价。

---

## 7. 服务端行为摘要（便于联调）


| 方向        | 名称                       | 说明                                                         |
| --------- | ------------------------ | ---------------------------------------------------------- |
| 客户端 → 服务器 | `JoinSession(sessionId)` | 加入组 `sessionId`；向调用者发送 `SessionJoined`                     |
| 客户端 → 服务器 | `SendCommand(command)`   | 向组 `command.sessionId` 广播 `ReceiveCommand`，参数为完整 `command` |
| 服务器 → 客户端 | `SessionJoined`          | 仅调用 `JoinSession` 的连接收到                                    |
| 服务器 → 客户端 | `ReceiveCommand`         | 组内所有已 `JoinSession` 到该 `sessionId` 的连接收到                   |


---

## 8. 后端示例：Python 连接 Hub 并发送指令

浏览器与 Python **都是 SignalR 客户端**，连到同一个 Hub URL，并使用 **相同的 `sessionId` 加入组**后，由任一方调用 `SendCommand`，组内所有客户端（含网页）都会收到 `ReceiveCommand`。

推荐使用 PyPI 上的 `**signalrcore`**（与 ASP.NET Core SignalR 协议兼容）：

```bash
pip install signalrcore
```

下面示例与本文档约定地址一致：Hub 为 `http://www.astrox.cn:8787/hubs/commands`。流程为：**建立连接 → `JoinSession` → `SendCommand`**；`send` 的第二个参数为 **参数列表**（与 Hub 方法形参一一对应）。

```python
# send_hub_command.py — 连接 Hub 并发送一条创建地面站指令
import time

from signalrcore.hub_connection_builder import HubConnectionBuilder

HUB_URL = "http://www.astrox.cn:8787/hubs/commands"
SESSION_ID = "demo"  # 须与浏览器里填写的「会话 ID」一致


def on_receive_command(data):
    """同一 session 组内广播时，本脚本若已 JoinSession，也会收到。"""
    print("ReceiveCommand:", data)


def on_session_joined(data):
    print("SessionJoined:", data)


connection = HubConnectionBuilder().with_url(HUB_URL).build()
connection.on("ReceiveCommand", on_receive_command)
connection.on("SessionJoined", on_session_joined)

connection.start()
time.sleep(1)  # 等待协商与连接就绪（可按网络情况增减）

# Hub 方法 JoinSession(string sessionId) → 参数列表为 [sessionId]
connection.send("JoinSession", [SESSION_ID])
time.sleep(0.3)

# Hub 方法 SendCommand(CesiumCommand command) → 传一个 JSON 可序列化的 dict
command = {
    "target": "entity",
    "action": "createGroundStation",
    "sessionId": SESSION_ID,
    "params": {
        "id": "GS-01",
        "name": "Beijing Station",
        "longitude": 116.391,
        "latitude": 39.907,
        "altitude": 0,
        "color": "#ffca3a",
    },
}
connection.send("SendCommand", [command])
time.sleep(0.5)

connection.stop()
```

**联调注意**：

1. 网页端需先点击连接 SignalR，并处于与 `SESSION_ID` 相同的会话（即已对该 `sessionId` 调用 `JoinSession`），否则组内无人，浏览器收不到广播。
2. `SendCommand` 要求载荷里 `**sessionId`、`action` 非空**；`target` 可省略（默认 `entity`），不要传空字符串。
3. 若使用自签名 HTTPS，可能需在 `with_url` 中配置跳过证书校验等选项（以 `signalrcore` 文档为准）。
4. 仅负责「发指令」、不需要监听回包时，可省略 `on_receive_command`，但仍建议调用 `JoinSession`，便于与服务端组语义一致。

---

## 9. 健康检查（可选）

同一应用还提供 HTTP 接口（非 SignalR）：

```text
http://www.astrox.cn:8787/api/health
```

可用于确认 Web 进程已启动；SignalR 是否正常仍需通过浏览器或脚本连接 Hub 验证。