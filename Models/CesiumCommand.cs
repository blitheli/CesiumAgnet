using System.Text.Json;

namespace SatelliteCommandBus.Models;

/// <summary>
/// 跨 Agent / Python / 网页 的标准指令载荷。
/// JSON 中可省略 <c>target</c>，反序列化后默认为 <c>entity</c>（作用于 Cesium Entity 等）。
/// </summary>
public sealed record CesiumCommand(
    // 接受端Id
    string SessionId,
    string Action,
    JsonElement Params,
    string Target = "entity",
    //  可选的发送端Id，便于接受端区分指令来源（如哪个 Agent 或哪个网页）。不需要时可省略或设为 null。
    //  这样可以后续让发送端回传指令执行结果时，接受端知道回传给哪个发送端。
    string? SenderSessionId = null

);
