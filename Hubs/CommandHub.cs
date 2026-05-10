using Microsoft.AspNetCore.SignalR;
using SatelliteCommandBus.Models;

namespace SatelliteCommandBus.Hubs;

public sealed class CommandHub : Hub
{
    //  让当前 SignalR 连接加入一个“会话组”，并回执客户端“加入成功”。
    //  客户段通过 connection.invoke("JoinSession", sessionId)方式
    /*
        这是 SignalR 中常见的“按房间/会话广播”模式：
        •	不同会话互相隔离
        •	只给指定会话的客户端发消息
        •	避免把指令广播给所有连接
     */
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
    //  发送端通过 connection.invoke("SendCommand", command)方式发送指令
    //  接受端通过 connection.on("ReceiveCommand", command => { ... })方式订阅指令事件
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

    // 把一条客户端回传的消息广播到指定会话组。
    // 发送端通过 connection.invoke("SendResponse", response)方式发送消息
    // 接受端通过 connection.on("ReceiveResponse", response => { ... })方式订阅消息事件
    public async Task SendResponse(ResponseMessage response)
    {
        // 这里做一些基本的参数校验，确保 response 包含必要的信息
        if (string.IsNullOrWhiteSpace(response.SessionId))
        {
            throw new HubException("response.sessionId is required.");
        }

        // 这里可以处理客户端回传的消息
        // 比如广播给组内其他成员
        await Clients.Group(response.SessionId).SendAsync("ReceiveResponse", response);
    }
}
