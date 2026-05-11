using System.Text.Json;

namespace SatelliteCommandBus.Models;

/// <summary>
/// 回传消息模型，表示客户端对指令的响应。
/// </summary>
public sealed record ResponseMessage(
    // 接受端Id
    string SessionId,
    // 状态码，如 "success"、"error" 等
    string Status,
    // 可选的消息参数
    JsonElement Params = default,
    //  可选的发送端Id
    string? SenderSessionId = null
);
