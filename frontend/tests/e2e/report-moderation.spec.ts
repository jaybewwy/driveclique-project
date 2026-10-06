import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// UC-42 — report review queue. A club's leader and co-leaders review the
// reports on its drives and members in Club Settings → Reports, and they are
// the only people notified when one is filed. Nobody reviews, or hears about,
// a report made against themselves, and a report on the club itself is not
// sent to the club's own leaders.

const API = 'http://localhost:5000/api';
const DAY_MS = 24 * 60 * 60 * 1000;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

type User = { username: string; email: string; password: string };
type Account = User & { token: string; id: string };

let seq = 0;
const newUser = (prefix: string): User => {
  const id = `${Date.now()}${seq++}`;
  return { username: `${prefix}_${id}`, email: `${prefix}_${id}@mail.com`, password: 'ReportPass1!' };
};

async function register(request: APIRequestContext, prefix: string): Promise<Account> {
  const user = newUser(prefix);
  const res = await request.post(`${API}/auth/register`, { data: user });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { ...user, token: body.token, id: body.user._id };
}

// A public club led by a new account
async function createClub(request: APIRequestContext, prefix: string) {
  const leader = await register(request, `${prefix}lead`);
  const clubName = `Reports Club ${prefix} ${Date.now()}`;
  const res = await request.post(`${API}/clubs`, {
    headers: auth(leader.token),
    data: { name: clubName, description: 'Report review queue test club', isPrivate: false },
  });
  expect(res.status()).toBe(201);
  return { leader, clubName, clubId: (await res.json()).club._id as string };
}

async function joinClub(request: APIRequestContext, clubId: string, prefix: string) {
  const member = await register(request, prefix);
  const res = await request.post(`${API}/clubs/${clubId}/join`, { headers: auth(member.token) });
  expect(res.status()).toBe(200);
  return member;
}

async function joinAsCoLeader(request: APIRequestContext, clubId: string, leader: Account, prefix: string) {
  const coLeader = await joinClub(request, clubId, prefix);
  const res = await request.put(`${API}/clubs/${clubId}/promote`, {
    headers: auth(leader.token),
    data: { userId: coLeader.id },
  });
  expect(res.status()).toBe(200);
  return coLeader;
}

async function createDrive(request: APIRequestContext, leader: Account, clubId: string, name: string) {
  const date = new Date(Date.now() + 7 * DAY_MS).toISOString().slice(0, 10);
  const res = await request.post(`${API}/drives`, {
    headers: auth(leader.token),
    data: { clubId, name, date, time: '10:00 AM', timeZone: 'UTC', location: 'Report Test Lot' },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).drive._id as string;
}

const fileReport = (request: APIRequestContext, reporter: Account, data: Record<string, string>) =>
  request.post(`${API}/reports`, { headers: auth(reporter.token), data: { reason: 'spam', ...data } });

const getQueue = (request: APIRequestContext, viewer: Account, clubId: string, status = 'open') =>
  request.get(`${API}/reports/club/${clubId}`, { headers: auth(viewer.token), params: { status } });

async function queueOf(request: APIRequestContext, viewer: Account, clubId: string, status = 'open') {
  const res = await getQueue(request, viewer, clubId, status);
  expect(res.status()).toBe(200);
  return res.json();
}

const review = (request: APIRequestContext, viewer: Account, reportId: string, status: string) =>
  request.put(`${API}/reports/${reportId}`, { headers: auth(viewer.token), data: { status } });

async function reportNotifications(request: APIRequestContext, user: Account) {
  const res = await request.get(`${API}/notifications`, { headers: auth(user.token) });
  expect(res.status()).toBe(200);
  const { notifications } = (await res.json()).data;
  return notifications.filter((n: { type: string }) => n.type === 'NEW_REPORT');
}

// Notifications are written after the report request has been answered
const expectReportNotifications = (request: APIRequestContext, user: Account, count: number) =>
  expect.poll(async () => (await reportNotifications(request, user)).length, {
    message: `expected ${count} NEW_REPORT notification(s) for ${user.username}`,
  }).toBe(count);

// For "was NOT notified": only meaningful once the people who are notified
// have theirs, plus a moment for any stray write to land
async function expectNoReportNotifications(request: APIRequestContext, ...users: Account[]) {
  await new Promise((resolve) => setTimeout(resolve, 750));
  for (const user of users) {
    expect(await reportNotifications(request, user), `${user.username} must not be notified`).toEqual([]);
  }
}

async function login(page: Page, user: User) {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(user.username);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expect(page.getByPlaceholder(/What's the plan\?/i)).toBeVisible({ timeout: 15_000 });
}

const settingsNav = (page: Page) => page.getByRole('navigation', { name: 'Club settings' });
const reportsHeading = (page: Page) => page.getByRole('heading', { level: 2, name: 'Reports' });
const reportStatus = (page: Page) => page.locator('#main-content').getByRole('status');
const reportCard = (page: Page, text: string) => page.locator('#main-content').getByRole('listitem').filter({ hasText: text });

// Same bar as accessibility.spec.ts: critical and serious violations fail
async function expectNoSeriousA11yViolations(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).include('#main-content').analyze();
  const blocking = violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
  expect(blocking, `accessibility violations on ${where}`).toEqual([]);
}

test.describe('Report review queue (UC-42): who is told, and who can see it', () => {
  test('a drive report reaches the leader and co-leaders, and nobody else', async ({ request }) => {
    const { leader, clubName, clubId } = await createClub(request, 'rqdrive');
    const coLeader = await joinAsCoLeader(request, clubId, leader, 'rqdriveco');
    const member = await joinClub(request, clubId, 'rqdrivemem');
    const reporter = await joinClub(request, clubId, 'rqdriverep');
    const outsider = await register(request, 'rqdriveout');
    const driveId = await createDrive(request, leader, clubId, 'Reported Canyon Run');

    const filed = await fileReport(request, reporter, {
      targetType: 'drive', targetId: driveId, reason: 'dangerous', details: 'Route goes through a closed road',
    });
    expect(filed.status()).toBe(201);

    await expectReportNotifications(request, leader, 1);
    await expectReportNotifications(request, coLeader, 1);
    await expectNoReportNotifications(request, member, reporter, outsider);

    const [notification] = await reportNotifications(request, leader);
    expect(notification.message).toBe(
      `New report in ${clubName}: drive "Reported Canyon Run" (Dangerous or illegal activity)`);
    expect(notification.data.clubId).toBe(clubId);
    expect(notification.read).toBe(false);

    for (const reviewer of [leader, coLeader]) {
      const queue = await queueOf(request, reviewer, clubId);
      expect(queue.openCount).toBe(1);
      expect(queue.reports).toHaveLength(1);
      const [report] = queue.reports;
      expect(report).toMatchObject({
        targetType: 'drive',
        targetId: driveId,
        targetLabel: 'Reported Canyon Run',
        reason: 'dangerous',
        details: 'Route goes through a closed road',
        status: 'open',
        reviewedBy: null,
      });
      expect(report.reporter.username).toBe(reporter.username);
      expect(report.target).toMatchObject({ name: 'Reported Canyon Run', isCancelled: false });
      expect(report._id).toBe(notification.data.reportId);
      // The queue names people; it never carries their email addresses
      expect(JSON.stringify(queue)).not.toContain('@mail.com');
    }

    const reportId = notification.data.reportId as string;
    for (const other of [member, reporter, outsider]) {
      expect((await getQueue(request, other, clubId)).status(), `${other.username} reading the queue`).toBe(403);
      expect((await review(request, other, reportId, 'dismissed')).status(), `${other.username} closing a report`).toBe(403);
    }
    expect((await queueOf(request, leader, clubId)).openCount).toBe(1);
  });

  test('a reviewer who files a report sees it in the queue but is not notified of it', async ({ request }) => {
    const { leader, clubId } = await createClub(request, 'rqself');
    const coLeader = await joinAsCoLeader(request, clubId, leader, 'rqselfco');
    const driveId = await createDrive(request, leader, clubId, 'Reported By A Co-Leader');

    expect((await fileReport(request, coLeader, { targetType: 'drive', targetId: driveId })).status()).toBe(201);

    await expectReportNotifications(request, leader, 1);
    await expectNoReportNotifications(request, coLeader);
    expect((await queueOf(request, coLeader, clubId)).reports).toHaveLength(1);
  });

  test('a member report goes to the club it was filed in, and never to the person reported', async ({ request }) => {
    const { leader, clubName, clubId } = await createClub(request, 'rqmem');
    const coLeader = await joinAsCoLeader(request, clubId, leader, 'rqmemco');
    const reported = await joinAsCoLeader(request, clubId, leader, 'rqmemtarget');
    const reporter = await joinClub(request, clubId, 'rqmemrep');

    const filed = await fileReport(request, reporter, {
      targetType: 'user', targetId: reported.id, clubId, reason: 'harassment', details: 'Insulting messages',
    });
    expect(filed.status()).toBe(201);

    await expectReportNotifications(request, leader, 1);
    await expectReportNotifications(request, coLeader, 1);
    // The reported co-leader is a reviewer of this club, but not of this report
    await expectNoReportNotifications(request, reported, reporter);

    const [notification] = await reportNotifications(request, leader);
    expect(notification.message).toBe(
      `New report in ${clubName}: member @${reported.username} (Harassment or hate speech)`);

    const leaderQueue = await queueOf(request, leader, clubId);
    expect(leaderQueue.reports).toHaveLength(1);
    expect(leaderQueue.reports[0]).toMatchObject({
      targetType: 'user',
      targetId: reported.id,
      targetLabel: `@${reported.username}`,
      target: { username: reported.username, isMember: true },
    });
    expect((await queueOf(request, coLeader, clubId)).reports).toHaveLength(1);

    const reportedQueue = await queueOf(request, reported, clubId);
    expect(reportedQueue.reports).toEqual([]);
    expect(reportedQueue.openCount).toBe(0);
    const reportId = leaderQueue.reports[0]._id as string;
    expect((await review(request, reported, reportId, 'dismissed')).status()).toBe(404);
    expect((await queueOf(request, leader, clubId)).openCount).toBe(1);

    // Removed from the club afterwards: the report stays, and says so
    const removed = await request.delete(`${API}/clubs/${clubId}/members/${reported.id}`, { headers: auth(leader.token) });
    expect(removed.status()).toBe(200);
    expect((await queueOf(request, leader, clubId)).reports[0].target).toMatchObject({ isMember: false });
  });

  test('a member can only be reported to a club that both people belong to', async ({ request }) => {
    const { leader, clubId } = await createClub(request, 'rqscope');
    const member = await joinClub(request, clubId, 'rqscopemem');
    const outsider = await register(request, 'rqscopeout');
    const stranger = await register(request, 'rqscopestr');

    const fromOutside = await fileReport(request, outsider, { targetType: 'user', targetId: member.id, clubId });
    expect(fromOutside.status()).toBe(403);
    const aboutOutsider = await fileReport(request, member, { targetType: 'user', targetId: outsider.id, clubId });
    expect(aboutOutsider.status()).toBe(400);
    expect((await aboutOutsider.json()).message).toBe('That person is not a member of this club.');
    const badClubId = await fileReport(request, member, { targetType: 'user', targetId: leader.id, clubId: 'not-a-club-id' });
    expect(badClubId.status()).toBe(400);

    // Without a club the report is still accepted, as before, but no club reviews it
    const noClub = await fileReport(request, stranger, { targetType: 'user', targetId: member.id });
    expect(noClub.status()).toBe(201);

    expect((await queueOf(request, leader, clubId)).reports).toEqual([]);
    await expectNoReportNotifications(request, leader);
  });

  test("a report on the club itself is not sent to the club's own leaders", async ({ request }) => {
    const { leader, clubId } = await createClub(request, 'rqclub');
    const coLeader = await joinAsCoLeader(request, clubId, leader, 'rqclubco');
    const reporter = await register(request, 'rqclubrep');

    const filed = await fileReport(request, reporter, { targetType: 'club', targetId: clubId, details: 'Fake club' });
    expect(filed.status()).toBe(201);

    await expectNoReportNotifications(request, leader, coLeader);
    for (const status of ['open', 'closed']) {
      expect((await queueOf(request, leader, clubId, status)).reports).toEqual([]);
    }
  });

  test('a reviewer who has turned the notification off is not sent one', async ({ request }) => {
    const { leader, clubId } = await createClub(request, 'rqmute');
    const coLeader = await joinAsCoLeader(request, clubId, leader, 'rqmuteco');
    const reporter = await joinClub(request, clubId, 'rqmuterep');
    const driveId = await createDrive(request, leader, clubId, 'Muted Report Drive');

    const muted = await request.put(`${API}/notifications/preferences`, {
      headers: auth(leader.token),
      data: { NEW_REPORT: false },
    });
    expect(muted.status()).toBe(200);

    expect((await fileReport(request, reporter, { targetType: 'drive', targetId: driveId })).status()).toBe(201);

    await expectReportNotifications(request, coLeader, 1);
    await expectNoReportNotifications(request, leader);
    // Muting the notification doesn't hide the report
    expect((await queueOf(request, leader, clubId)).reports).toHaveLength(1);
  });
});

test.describe('Report review queue (UC-42): closing and reopening', () => {
  test('resolve, dismiss and reopen move a report between the open and closed lists', async ({ request }) => {
    const { leader, clubId } = await createClub(request, 'rqflow');
    const coLeader = await joinAsCoLeader(request, clubId, leader, 'rqflowco');
    const reporter = await joinClub(request, clubId, 'rqflowrep');
    const driveId = await createDrive(request, leader, clubId, 'Lifecycle Drive');
    expect((await fileReport(request, reporter, { targetType: 'drive', targetId: driveId })).status()).toBe(201);
    const reportId = (await queueOf(request, leader, clubId)).reports[0]._id as string;

    const invalid = await review(request, leader, reportId, 'deleted');
    expect(invalid.status()).toBe(400);

    const resolved = await review(request, leader, reportId, 'resolved');
    expect(resolved.status()).toBe(200);
    expect((await resolved.json()).report.status).toBe('resolved');

    let open = await queueOf(request, coLeader, clubId);
    expect(open.reports).toEqual([]);
    expect(open.openCount).toBe(0);
    let closed = await queueOf(request, coLeader, clubId, 'closed');
    expect(closed.reports).toHaveLength(1);
    expect(closed.reports[0].status).toBe('resolved');
    expect(closed.reports[0].reviewedBy.username).toBe(leader.username);
    expect(closed.reports[0].reviewedAt).toBeTruthy();
    // The closed list still reports how many are open
    expect(closed.openCount).toBe(0);

    expect((await review(request, coLeader, reportId, 'open')).status()).toBe(200);
    open = await queueOf(request, leader, clubId);
    expect(open.reports).toHaveLength(1);
    expect(open.reports[0]).toMatchObject({ status: 'open', reviewedBy: null, reviewedAt: null });

    expect((await review(request, coLeader, reportId, 'dismissed')).status()).toBe(200);
    closed = await queueOf(request, leader, clubId, 'closed');
    expect(closed.reports[0].status).toBe('dismissed');
    expect(closed.reports[0].reviewedBy.username).toBe(coLeader.username);

    expect((await review(request, leader, '000000000000000000000000', 'resolved')).status()).toBe(404);
  });

  test('the same thing can be reported again once its report is closed, but not while it is open', async ({ request }) => {
    const { leader, clubId } = await createClub(request, 'rqagain');
    const reporter = await joinClub(request, clubId, 'rqagainrep');
    const driveId = await createDrive(request, leader, clubId, 'Reported Twice Drive');

    const first = await fileReport(request, reporter, { targetType: 'drive', targetId: driveId, reason: 'spam', details: 'First time' });
    expect(first.status()).toBe(201);
    await expectReportNotifications(request, leader, 1);

    const whileOpen = await fileReport(request, reporter, { targetType: 'drive', targetId: driveId, reason: 'other' });
    expect(whileOpen.status()).toBe(400);
    expect((await whileOpen.json()).message).toBe('You have already reported this content.');

    const reportId = (await queueOf(request, leader, clubId)).reports[0]._id as string;
    expect((await review(request, leader, reportId, 'dismissed')).status()).toBe(200);

    const again = await fileReport(request, reporter, { targetType: 'drive', targetId: driveId, reason: 'dangerous', details: 'It happened again' });
    expect(again.status()).toBe(201);

    // The same report, open again with what was said this time; reviewers are told again
    const open = await queueOf(request, leader, clubId);
    expect(open.reports).toHaveLength(1);
    expect(open.reports[0]).toMatchObject({
      _id: reportId, status: 'open', reason: 'dangerous', details: 'It happened again', reviewedBy: null,
    });
    expect((await queueOf(request, leader, clubId, 'closed')).reports).toEqual([]);
    await expectReportNotifications(request, leader, 2);
  });

  test('a report shows a cancelled drive, outlives a deleted one, and is deleted with its club', async ({ request }) => {
    const { leader, clubId } = await createClub(request, 'rqgone');
    const reporter = await joinClub(request, clubId, 'rqgonerep');
    const reported = await joinClub(request, clubId, 'rqgonetarget');
    const driveId = await createDrive(request, leader, clubId, 'Soon Deleted Drive');
    expect((await fileReport(request, reporter, { targetType: 'drive', targetId: driveId })).status()).toBe(201);
    expect((await fileReport(request, reporter, { targetType: 'user', targetId: reported.id, clubId })).status()).toBe(201);

    const driveReport = async () => {
      const queue = await queueOf(request, leader, clubId);
      expect(queue.reports).toHaveLength(2);
      return queue.reports.find((r: { targetType: string }) => r.targetType === 'drive');
    };

    // What a reviewer does about a report shows up on it
    const cancelled = await request.post(`${API}/drives/${driveId}/cancel`, {
      headers: auth(leader.token),
      data: { cancellationReason: 'Cancelled after a report' },
    });
    expect(cancelled.status()).toBe(200);
    expect((await driveReport()).target).toMatchObject({ name: 'Soon Deleted Drive', isCancelled: true });

    const deletedDrive = await request.delete(`${API}/drives/${driveId}`, { headers: auth(leader.token) });
    expect(deletedDrive.status()).toBe(200);
    expect(await driveReport()).toMatchObject({ targetLabel: 'Soon Deleted Drive', target: null });

    const deletedClub = await request.delete(`${API}/clubs/${clubId}`, {
      headers: auth(leader.token),
      data: { leaderEmail: leader.email },
    });
    expect(deletedClub.status()).toBe(200);

    // Had the member's report survived its club it would still be open, and
    // filing it again would be refused as a duplicate
    const afterwards = await fileReport(request, reporter, { targetType: 'user', targetId: reported.id });
    expect(afterwards.status()).toBe(201);
  });
});

test.describe('Club Settings → Reports (UC-42)', () => {
  test('the leader reviews a report: resolve it, find it under Closed, reopen it', async ({ page, request }) => {
    const { leader, clubName, clubId } = await createClub(request, 'rqui');
    const reporter = await joinClub(request, clubId, 'rquirep');
    const driveId = await createDrive(request, leader, clubId, 'Loud Exhaust Meet');
    const filed = await fileReport(request, reporter, {
      targetType: 'drive', targetId: driveId, reason: 'dangerous', details: 'Street racing is being encouraged',
    });
    expect(filed.status()).toBe(201);

    await login(page, leader);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await page.getByRole('button', { name: 'Manage Club' }).click();
    await settingsNav(page).getByRole('link', { name: 'Reports' }).click();

    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/reports$`));
    await expect(reportsHeading(page)).toBeVisible();
    const openTab = page.getByRole('button', { name: /^Open/ });
    const closedTab = page.getByRole('button', { name: 'Closed' });
    await expect(openTab).toHaveText('Open (1)');
    await expect(openTab).toHaveAttribute('aria-pressed', 'true');

    const card = reportCard(page, 'Loud Exhaust Meet');
    await expect(card).toContainText('Drive: Loud Exhaust Meet');
    await expect(card).toContainText('Dangerous or illegal activity');
    await expect(card).toContainText('Street racing is being encouraged');
    await expect(card).toContainText(`Reported by @${reporter.username}`);
    await expectNoSeriousA11yViolations(page, 'Reports (open)');

    await card.getByRole('button', { name: 'Resolve' }).click();
    await expect(reportStatus(page)).toHaveText('Report resolved.');
    await expect(page.getByText('No open reports.')).toBeVisible();
    await expect(openTab).toHaveText('Open');

    await closedTab.click();
    await expect(card).toContainText('Resolved by you');
    await expect(card.getByRole('button', { name: 'Resolve' })).toHaveCount(0);
    await expectNoSeriousA11yViolations(page, 'Reports (closed)');

    await card.getByRole('button', { name: 'Reopen' }).click();
    await expect(reportStatus(page)).toHaveText('Report reopened.');
    await expect(page.getByText('No closed reports yet.')).toBeVisible();
    await openTab.click();
    await expect(card.getByRole('button', { name: 'Dismiss' })).toBeVisible();
    await expect(openTab).toHaveText('Open (1)');

    // Still open after a reload: the state is the server's, not the page's
    await page.reload();
    await expect(card.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  });

  test('a co-leader gets the Reports section and no other; a member gets none', async ({ page, request }) => {
    const { leader, clubName, clubId } = await createClub(request, 'rqco');
    const coLeader = await joinAsCoLeader(request, clubId, leader, 'rqcoco');
    const reporter = await joinClub(request, clubId, 'rqcorep');
    const driveId = await createDrive(request, leader, clubId, 'Co-Leader Reviewed Drive');
    expect((await fileReport(request, reporter, { targetType: 'drive', targetId: driveId })).status()).toBe(201);

    await login(page, coLeader);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage Club' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Review Reports' }).click();

    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/reports$`));
    await expect(reportsHeading(page)).toBeVisible();
    await expect(settingsNav(page).getByRole('link')).toHaveText(['Reports']);

    // The leader's sections send a co-leader back to the one they can open
    for (const section of ['general', 'danger-zone', '']) {
      await page.goto(`/club/${clubId}/settings/${section}`);
      await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/reports$`));
      await expect(reportsHeading(page)).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Delete Club' })).toHaveCount(0);

    const card = reportCard(page, 'Co-Leader Reviewed Drive');
    await card.getByRole('button', { name: 'Dismiss' }).click();
    await expect(reportStatus(page)).toHaveText('Report dismissed.');
    const closed = await queueOf(request, leader, clubId, 'closed');
    expect(closed.reports[0]).toMatchObject({ status: 'dismissed' });
    expect(closed.reports[0].reviewedBy.username).toBe(coLeader.username);

    // A regular member has no settings at all, and no way in from the club page
    await page.getByRole('button', { name: 'Back to club' }).click();
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    const demoted = await request.put(`${API}/clubs/${clubId}/demote`, {
      headers: auth(leader.token),
      data: { userId: coLeader.id },
    });
    expect(demoted.status()).toBe(200);
    await page.goto(`/club/${clubId}/settings/reports`);
    await expect(page).toHaveURL(new RegExp(`/club/${clubId}$`));
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review Reports' })).toHaveCount(0);
  });

  test("reporting a member from the club's member list puts it in that club's queue", async ({ page, request }) => {
    const { leader, clubName, clubId } = await createClub(request, 'rqlist');
    const reported = await joinClub(request, clubId, 'rqlisttarget');
    const reporter = await joinClub(request, clubId, 'rqlistrep');

    await login(page, reporter);
    await page.goto(`/club/${clubId}`);
    await expect(page.getByRole('heading', { level: 1, name: clubName })).toBeVisible();
    await page.getByRole('button', { name: 'View All', exact: true }).click();

    const members = page.getByRole('dialog', { name: /All Members/ });
    const row = members.locator('div.bg-black').filter({ hasText: `@${reported.username}` });
    await row.getByRole('button', { name: 'Report member' }).click();

    const dialog = page.getByRole('dialog', { name: 'Report Content' });
    await dialog.getByText('Harassment or hate speech').click();
    await dialog.getByRole('button', { name: 'Submit Report' }).click();
    await expect(dialog.getByText('Report submitted')).toBeVisible();

    const queue = await queueOf(request, leader, clubId);
    expect(queue.reports).toHaveLength(1);
    expect(queue.reports[0]).toMatchObject({
      targetType: 'user', targetId: reported.id, reason: 'harassment',
    });
    expect(queue.reports[0].reporter.username).toBe(reporter.username);
  });

  test('the notification in the bell opens the review queue, and can be switched off in Settings', async ({ page, request }) => {
    const { leader, clubName, clubId } = await createClub(request, 'rqbell');
    const reporter = await joinClub(request, clubId, 'rqbellrep');
    const driveId = await createDrive(request, leader, clubId, 'Bell Notification Drive');
    expect((await fileReport(request, reporter, { targetType: 'drive', targetId: driveId })).status()).toBe(201);
    await expectReportNotifications(request, leader, 1);

    await login(page, leader);
    await page.getByRole('button', { name: 'Notifications' }).click();
    await page.getByRole('button', { name: new RegExp(`New report in ${clubName}: drive "Bell Notification Drive"`) }).click();

    await expect(page).toHaveURL(new RegExp(`/club/${clubId}/settings/reports$`));
    await expect(reportsHeading(page)).toBeVisible();
    await expect(reportCard(page, 'Bell Notification Drive')).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('navigation', { name: 'Settings navigation' }).getByRole('button', { name: 'Profile' }).click();
    const toggle = page.getByRole('switch', { name: 'A drive or member is reported in a club you lead or co-lead' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect.poll(async () => {
      const res = await request.get(`${API}/notifications/preferences`, { headers: auth(leader.token) });
      return (await res.json()).data.notificationPreferences.NEW_REPORT;
    }).toBe(false);
  });
});
