import { WebSocket } from 'ws';

const token = process.argv[2];
const ws = new WebSocket(`ws://localhost:4000/v1/realtime?token=${token}`);

ws.on('open', () => console.log('listening…'));
ws.on('message', (m) => console.log(m.toString()));
