# TODO - Automated 20-test browser suite

## Step 1: Setup automation tooling
- [ ] Add Playwright config + test files under `frontend/tests/e2e`
- [ ] Add `playwright` and `@playwright/test` to `frontend/package.json`
- [ ] Add npm script(s) like `test:e2e`

## Step 2: Create 20 test scenarios
- [ ] Implement test flow: Register/Login for User A and User B
- [ ] Create club as User A
- [ ] Copy invite code from UI
- [ ] Join club as User B via invite code
- [ ] Edit profiles for both users: Display Name toggle + random car info + Save Changes
- [ ] Verify persistence after navigation/refresh
- [ ] Include negative tests: duplicate join + invalid invite code

## Step 3: Run and debug
- [ ] Start backend + frontend locally (as needed)
- [ ] Run `npm run test:e2e`
- [ ] Fix selectors or flakiness until all tests pass

