using Microsoft.AspNetCore.SignalR;
using SatelliteCommandBus.Models;

namespace SatelliteCommandBus.Hubs;

public sealed class CommandHub : Hub
{
    //  让当前 SignalR 连接加入一个“会话组”，并回执客户端“加入成功”。
    public async Task JoinSession(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            throw new HubException("sessionId is required.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
        await Clients.Caller.SendAsync("SessionJoined", sessionId);
    }

    //  把一条 Cesium 指令广播到指定会话组。
    public async Task SendCommand(CesiumCommand command)
    {
        if (string.IsNullOrWhiteSpace(command.SessionId))
        {
            throw new HubException("command.sessionId is required.");
        }

        if (string.IsNullOrWhiteSpace(command.Action))
        {
            throw new HubException("command.action is required.");
        }

        if (string.IsNullOrWhiteSpace(command.Target))
        {
            throw new HubException(
                "command.target cannot be empty; omit the field to use the default \"entity\".");
        }

        //向 command.SessionId 这个组里的所有连接推送 ReceiveCommand 事件。
        //前端只要订阅了 ReceiveCommand，就会执行对应逻辑（如创建卫星、飞行到指定位置等）。
        await Clients.Group(command.SessionId).SendAsync("ReceiveCommand", command);
    }
}
