import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('Rooms & Access Control', () => {
  async function createAuthUser(displayName: string, email: string) {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ displayName, email, password: 'Password123!' })
      .expect(201);
    return {
      user: res.body.user,
      cookie: res.headers['set-cookie'],
    };
  }

  it('User A creates public room; User B discovers and joins it', async () => {
    const userA = await createAuthUser('Alice', 'alice_rooms@example.com');
    const userB = await createAuthUser('Bob', 'bob_rooms@example.com');

    // Alice creates public room
    const roomRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', userA.cookie)
      .send({
        name: 'Chill Vibes Lounge',
        description: 'Electronic beats',
        visibility: 'public',
        capacity: 10,
      })
      .expect(201);

    const roomId = roomRes.body.room.id;
    expect(roomId).toBeDefined();

    // Bob discovers public rooms
    const listRes = await request(app).get('/api/v1/rooms').expect(200);
    const found = listRes.body.rooms.find((r: any) => r.id === roomId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Chill Vibes Lounge');

    // Bob joins the room
    const joinRes = await request(app)
      .post(`/api/v1/rooms/${roomId}/join`)
      .set('Cookie', userB.cookie)
      .send({})
      .expect(200);

    expect(joinRes.body.ok).toBe(true);

    // Bob can view room detail
    const detailRes = await request(app)
      .get(`/api/v1/rooms/${roomId}`)
      .set('Cookie', userB.cookie)
      .expect(200);

    expect(detailRes.body.room.id).toBe(roomId);
    expect(detailRes.body.isMember).toBe(true);
    expect(detailRes.body.isHost).toBe(false);
  });

  it('User A creates private room; unauthorized User B cannot access it without invite/code', async () => {
    const userA = await createAuthUser('Alice Priv', 'alice_priv@example.com');
    const userB = await createAuthUser('Bob Priv', 'bob_priv@example.com');

    // Alice creates private room
    const roomRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', userA.cookie)
      .send({
        name: 'Secret Society',
        visibility: 'private',
      })
      .expect(201);

    const roomId = roomRes.body.room.id;
    const inviteCode = roomRes.body.room.inviteCode;

    // Verify private room is excluded from public listings
    const listRes = await request(app).get('/api/v1/rooms').expect(200);
    const inPublic = listRes.body.rooms.some((r: any) => r.id === roomId);
    expect(inPublic).toBe(false);

    // Bob tries to access private room without membership -> Forbidden (403)
    await request(app)
      .get(`/api/v1/rooms/${roomId}`)
      .set('Cookie', userB.cookie)
      .expect(403);

    // Bob attempts to join without code -> 403
    await request(app)
      .post(`/api/v1/rooms/${roomId}/join`)
      .set('Cookie', userB.cookie)
      .send({})
      .expect(403);

    // Bob joins with valid invite code -> 200 Success!
    await request(app)
      .post(`/api/v1/rooms/${roomId}/join`)
      .set('Cookie', userB.cookie)
      .send({ inviteCode })
      .expect(200);

    // Bob can now access private room
    const detail = await request(app)
      .get(`/api/v1/rooms/${roomId}`)
      .set('Cookie', userB.cookie)
      .expect(200);

    expect(detail.body.isMember).toBe(true);
  });

  it('Friend invitation flow grants access to private room', async () => {
    const userA = await createAuthUser('Alice Host', 'alice_host@example.com');
    const userB = await createAuthUser('Bob Friend', 'bob_friend@example.com');

    // 1. Establish friendship
    const reqRes = await request(app)
      .post('/api/v1/friends/requests')
      .set('Cookie', userA.cookie)
      .send({ recipientId: userB.user.id })
      .expect(201);

    const requestId = reqRes.body.request.id;

    // Bob accepts friend request
    await request(app)
      .post(`/api/v1/friends/requests/${requestId}/respond`)
      .set('Cookie', userB.cookie)
      .send({ action: 'accept' })
      .expect(200);

    // 2. Alice creates private room
    const roomRes = await request(app)
      .post('/api/v1/rooms')
      .set('Cookie', userA.cookie)
      .send({ name: 'Friends Only Room', visibility: 'private' })
      .expect(201);

    const roomId = roomRes.body.room.id;

    // 3. Alice invites Bob to the private room
    const inviteRes = await request(app)
      .post(`/api/v1/rooms/${roomId}/invite`)
      .set('Cookie', userA.cookie)
      .send({ friendUserId: userB.user.id })
      .expect(201);

    const invitationId = inviteRes.body.invitation.id;

    // 4. Bob accepts room invitation
    await request(app)
      .post(`/api/v1/rooms/invitations/${invitationId}/respond`)
      .set('Cookie', userB.cookie)
      .send({ action: 'accept' })
      .expect(200);

    // 5. Bob now has authorized access to the private room
    const detail = await request(app)
      .get(`/api/v1/rooms/${roomId}`)
      .set('Cookie', userB.cookie)
      .expect(200);

    expect(detail.body.isMember).toBe(true);
  });
});
