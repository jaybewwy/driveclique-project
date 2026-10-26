import { test, expect, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:5000/api';

// ─── A full drive never takes more than its places (UC-03) ──────────────────
// Taking a place used to be "count the going RSVPs, then save one", with
// nothing atomic between the two, so members answering at the same moment
// could all see a free place and all get it. A place is now claimed first and
// checked after: whoever became "going" beyond the cap moves to the waitlist.

const suffix = Date.now();
const PASSWORD = 'CapacityPass1!';
const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

type Person = { username: string; token: string };
const people: Person[] = [];
const auth = (person: Person) => ({ Authorization: `Bearer ${person.token}` });
let clubId = '';

async function createDrive(request: APIRequestContext, name: string, maxAttendees: number) {
  const res = await request.post(`${API}/drives`, {
    headers: auth(people[0]),
    data: { clubId, name: `${name} ${suffix}`, date: inDays(6), time: '10:00 AM', location: 'Test Lot', maxAttendees },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).drive._id as string;
}

const rsvp = (request: APIRequestContext, person: Person, driveId: string, status: string) =>
  request.post(`${API}/drives/${driveId}/rsvp`, { headers: auth(person), data: { status } });

async function countsOf(request: APIRequestContext, driveId: string) {
  const res = await request.get(`${API}/drives/${driveId}/rsvp-status`, { headers: auth(people[0]) });
  expect(res.status()).toBe(200);
  return (await res.json()).counts as { going: number; waitlisted: number };
}

test.describe('Drive capacity under concurrent RSVPs (UC-03)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    for (let i = 0; i < 10; i++) {
      const username = `cap${i}_${suffix}`;
      const res = await request.post(`${API}/auth/register`, {
        data: { username, email: `${username}@mail.com`, password: PASSWORD },
      });
      expect(res.status()).toBe(201);
      people.push({ username, token: (await res.json()).token });
    }
    const club = await request.post(`${API}/clubs`, {
      headers: auth(people[0]),
      data: { name: `Capacity Club ${suffix}`, description: 'Concurrent RSVPs', isPrivate: false },
    });
    expect(club.status()).toBe(201);
    clubId = (await club.json()).club._id;
    for (const person of people.slice(1)) {
      expect((await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(person) })).status()).toBe(200);
    }
  });

  test('members answering "going" at once get no more places than the drive has', async ({ request }) => {
    const members = people.slice(1, 9);
    for (let round = 0; round < 3; round++) {
      const driveId = await createDrive(request, `Two Places ${round}`, 2);
      const answers = await Promise.all(members.map((m) => rsvp(request, m, driveId, 'going')));
      for (const answer of answers) expect(answer.status()).toBe(200);

      const bodies = await Promise.all(answers.map((a) => a.json()));
      expect(bodies.filter((b) => b.waitlisted)).toHaveLength(members.length - 2);
      expect(await countsOf(request, driveId)).toMatchObject({ going: 2, waitlisted: members.length - 2 });
    }
  });

  test('a place freed while someone else answers still goes to only one person', async ({ request }) => {
    for (let round = 0; round < 5; round++) {
      const [, holder, waiting, newcomer] = people;
      const driveId = await createDrive(request, `One Place ${round}`, 1);
      expect((await (await rsvp(request, holder, driveId, 'going')).json()).waitlisted).toBeFalsy();
      expect((await (await rsvp(request, waiting, driveId, 'going')).json()).waitlisted).toBe(true);

      // The holder gives up the place (promoting the waitlist) as a newcomer asks for it
      const [left, asked] = await Promise.all([
        rsvp(request, holder, driveId, 'not-going'),
        rsvp(request, newcomer, driveId, 'going'),
      ]);
      expect(left.status()).toBe(200);
      expect(asked.status()).toBe(200);

      const counts = await countsOf(request, driveId);
      expect(counts.going).toBe(1);
      expect(counts.waitlisted).toBe(1);
    }
  });
});
