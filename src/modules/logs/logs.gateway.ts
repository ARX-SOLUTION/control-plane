import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { LogsService } from './logs.service';

@WebSocketGateway({ path: '/api/logs/stream' })
export class LogsGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private intervals = new Map<WebSocket, NodeJS.Timeout>();

  constructor(private readonly logsService: LogsService) {}

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { query: string; start?: string },
    @ConnectedSocket() client: WebSocket,
  ) {
    let start = data.start ?? new Date(Date.now() - 60_000).toISOString();

    const interval = setInterval(async () => {
      const end = new Date().toISOString();
      const results = await this.logsService.query({ query: data.query, start, end, limit: 100 });
      if (results.length > 0) {
        client.send(JSON.stringify({ type: 'logs', data: results }));
        start = end;
      }
    }, 2000);

    this.intervals.set(client, interval);
  }

  handleDisconnect(client: WebSocket) {
    const interval = this.intervals.get(client);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(client);
    }
  }
}
