import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { io as Client, Socket } from 'socket.io-client';
import { Server as SocketIOServer } from 'socket.io';
import request from 'supertest';
import { createApp } from '../src/app';
import { setupSocketIO } from '../src/socket';
import { signToken } from '../src/utils/jwt';
import { User } from '../src/models/User';
import { hashPassword } from '../src/utils/password';

describe('Real-Time Collaboration & Synchronization (Critical Acceptance Test)', () => {
  let server: http.Server;
  let ioServer: SocketIOServer;
  let port: number;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        const app = createApp();
        server = http.createServer(app);
        ioServer = new SocketIOServer(server, {
          cors: { origin: '*' },
        });
        setupSocketIO(ioServer as any);

        server.listen(0, () => {
          port = (server.address() as AddressInfo).port;
          resolve();
        });
      })
  );

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        ioServer.close();
        server.close(() => resolve());
      })
  );

  async function createTestUser(displayName: string, email: string) {
    const passwordHash = await hashPassword('Password123!');
    const user = await User.create({ displayName, email, passwordHash });
    const token = signToken({ userId: user._id.toString() });
    return { user, token };
  }

  it('Critical Acceptance Test: Two distinct clients collaborate in real-time', async () => {
    // 1. Create User A and User B
    const userA = await createTestUser('Alice Host', 'alice_rt@example.com');
    const userB = await createTestUser('Bob Listener', 'bob_rt@example.com');

    // 2. Connect Client A via Socket.IO
    const clientA: Socket = Client(`http://localhost:${port}`, {
      auth: { token: userA.token },
      transports: ['websocket'],
    });

    // 3. Connect Client B via Socket.IO
    const clientB: Socket = Client(`http://localhost:${port}`, {
      auth: { token: userB.token },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((resolve) => clientA.on('connect', resolve)),
      new Promise((resolve) => clientB.on('connect', resolve)),
    ]);

    expect(clientA.connected).toBe(true);
    expect(clientB.connected).toBe(true);

    // 4. User A creates a public room via REST
    const app = createApp();
    const createRoomRes = await request(app)
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        name: 'Realtime Jam Lounge',
        visibility: 'public',
      })
      .expect(201);

    const roomId = createRoomRes.body.room.id;
    expect(roomId).toBeDefined();

    // 5. User A joins room channel
    await new Promise<void>((resolve) => {
      clientA.emit('room:join', { roomId }, () => resolve());
    });

    // 6. User B discovers and joins room channel
    const clientBJoined = new Promise<void>((resolve) => {
      clientB.emit('room:join', { roomId }, () => resolve());
    });
    await clientBJoined;

    // 7. User B adds a song to the queue
    const queuePromiseA = new Promise<any>((resolve) => {
      clientA.once('queue:updated', (data) => resolve(data));
    });

    const sampleUrl = 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
    await new Promise<void>((resolve) => {
      clientB.emit('queue:add', { roomId, url: sampleUrl }, () => resolve());
    });

    const queueData = await queuePromiseA;
    expect(queueData.roomId).toBe(roomId);
    expect(queueData.queue.length).toBe(1);
    expect(queueData.queue[0].title).toBeDefined();
    expect(queueData.queue[0].provider).toBe('youtube');
    expect(queueData.currentTrack).toBeDefined();

    // 8. User A (Host) plays and pauses playback
    const playPromiseB = new Promise<any>((resolve) => {
      clientB.on('playback:updated', (data) => {
        if (data.state.isPlaying) {
          resolve(data);
        }
      });
    });

    clientA.emit('playback:play', { roomId, position: 10 });
    const playState = await playPromiseB;
    expect(playState.state.isPlaying).toBe(true);
    expect(playState.state.positionSeconds).toBeCloseTo(10, 0);

    const pausePromiseB = new Promise<any>((resolve) => {
      clientB.on('playback:updated', (data) => {
        if (!data.state.isPlaying) {
          resolve(data);
        }
      });
    });

    clientA.emit('playback:pause', { roomId, position: 15 });
    const pauseState = await pausePromiseB;
    expect(pauseState.state.isPlaying).toBe(false);
    expect(pauseState.state.positionSeconds).toBeCloseTo(15, 0);

    // 9. Unauthorized non-host playback action: User B tries to play
    const errorPromiseB = new Promise<any>((resolve) => {
      clientB.once('error', (err) => resolve(err));
    });
    clientB.emit('playback:play', { roomId });
    const err = await errorPromiseB;
    expect(err.code).toBe('PLAYBACK_ERROR');
    expect(err.message).toContain('host');

    // 10. Bidirectional Chat: Client B sends chat message to Client A
    const chatPromiseA = new Promise<any>((resolve) => {
      clientA.once('chat:message', (msg) => resolve(msg));
    });

    clientB.emit('chat:send', { roomId, content: 'Hey Alice, love this track!' });
    const msgToA = await chatPromiseA;
    expect(msgToA.content).toBe('Hey Alice, love this track!');
    expect(msgToA.sender.id).toBe(userB.user._id.toString());

    // Client A replies to Client B
    const chatPromiseB = new Promise<any>((resolve) => {
      clientB.on('chat:message', (msg) => {
        if (msg.sender.id === userA.user._id.toString()) {
          resolve(msg);
        }
      });
    });

    clientA.emit('chat:send', { roomId, content: 'Glad you like it Bob!' });
    const msgToB = await chatPromiseB;
    expect(msgToB.content).toBe('Glad you like it Bob!');
    expect(msgToB.sender.id).toBe(userA.user._id.toString());

    // Cleanup sockets
    clientA.disconnect();
    clientB.disconnect();
  });
});
