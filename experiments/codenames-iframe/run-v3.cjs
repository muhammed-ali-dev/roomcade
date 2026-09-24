const fs = require('node:fs');
const assert = require('node:assert/strict');

const playwrightCandidates = [
  process.env.PLAYWRIGHT_CORE_PATH,
  '/home/muhamuham/.nvm/versions/node/v22.21.0/lib/node_modules/openclaw/node_modules/playwright-core',
].filter(Boolean);
const chromiumCandidates = [
  process.env.CHROMIUM_PATH,
  '/home/muhamuham/.cache/ms-playwright/chromium-1234/chrome-linux/chrome',
].filter(Boolean);
const playwrightPath = playwrightCandidates.find(candidate => fs.existsSync(candidate));
const chromiumPath = chromiumCandidates.find(candidate => fs.existsSync(candidate));
if (!playwrightPath || !chromiumPath) {
  throw new Error('Set PLAYWRIGHT_CORE_PATH and CHROMIUM_PATH for this environment.');
}
const { chromium } = require(playwrightPath);

const wrapperUrl = process.env.WRAPPER_URL || 'http://127.0.0.1:8000/iframe-test-v2.html';
const names = ['RcadeA26', 'RcadeB26', 'RcadeC26', 'RcadeD26'];
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const emit = (milestone, details = {}) => console.log(JSON.stringify({ milestone, ...details }));

async function waitForGameFrame(page, predicate, timeout = 180_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const frame = page.frames().find(candidate => predicate(candidate.url()));
    if (frame) return frame;
    await pause(500);
  }
  throw new Error('Timed out waiting for the Codenames frame.');
}

async function waitForRoomUrl(frame, timeout = 180_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (/^https:\/\/codenames\.game\/r\//.test(frame.url())) return frame.url();
    await pause(500);
  }
  throw new Error('Timed out waiting for a private Codenames room URL.');
}

async function dismissGuide(scope) {
  const button = scope.locator('button:visible').filter({ hasText: /GOT IT/i }).first();
  if (await button.count()) await button.click({ force: true }).catch(() => {});
}

async function enterLobby(page, roomUrl, nickname) {
  await page.goto(wrapperUrl, { waitUntil: 'domcontentloaded' });
  if (roomUrl) await page.locator('#game-url').fill(roomUrl);
  await page.getByRole('button', { name: 'Mount game' }).click();
  const frame = await waitForGameFrame(page, url => roomUrl ? url === roomUrl : url.startsWith('https://codenames.game'));
  const nicknameInput = frame.locator('input[placeholder="Nickname"], input[placeholder*="nickname" i]').first();
  await nicknameInput.waitFor();
  await nicknameInput.fill(nickname);
  await nicknameInput.press('Tab');
  await frame.locator('button:visible').filter({ hasText: /ENTER GAME/i }).click();
  await nicknameInput.waitFor({ state: 'hidden' });
  return frame;
}

async function bodyText(frame) {
  return frame.locator('body').innerText();
}

async function controlTexts(frame) {
  return frame.locator('button:visible').evaluateAll(buttons => buttons.map(button => ({
    text: (button.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 100),
    disabled: button.disabled,
  })).filter(item => item.text));
}

async function providerRoles(frame) {
  const text = await bodyText(frame);
  const start = frame.locator('button:visible').filter({ hasText: /START GAME/i });
  const startCount = await start.count();
  return {
    admin: /\bAdmin\b/i.test(text),
    startVisible: startCount > 0,
    startEnabled: startCount > 0 ? await start.first().isEnabled() : false,
  };
}

async function waitForAllNames(frame, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const text = await bodyText(frame);
    if (names.every(name => text.includes(name))) return true;
    await pause(750);
  }
  return false;
}

async function lobbyIdentityLines(frame) {
  const lines = (await bodyText(frame)).split('\n').map(line => line.trim()).filter(Boolean);
  return [...new Set(lines.filter(line => /^(Rcade[A-D]26|Player\d+)$/i.test(line)))];
}

async function waitForFourIdentities(frame, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const identities = await lobbyIdentityLines(frame);
    if (identities.length >= 4) return identities;
    await pause(750);
  }
  return lobbyIdentityLines(frame);
}

async function boardWords(frame) {
  const cards = frame.locator('article[style*="--CardColor"]');
  if (await cards.count() === 25) {
    return cards.evaluateAll(elements => elements.map(card => {
      const values = (card.innerText || '').split('\n').map(value => value.trim()).filter(Boolean);
      return values.at(-1);
    }).filter(Boolean).sort());
  }
  const lines = (await bodyText(frame)).split('\n').map(line => line.trim()).filter(Boolean);
  const repeated = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (lines[index] === lines[index + 1] && /^[A-Z][A-Z -]{2,}$/.test(lines[index])) repeated.push(lines[index]);
  }
  return [...new Set(repeated)].sort();
}

async function waitForBoard(frame, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const words = await boardWords(frame);
    if (words.length === 25) return words;
    await pause(750);
  }
  throw new Error('Timed out waiting for a 25-word Classic board.');
}

async function joinClassicRoles(frames) {
  // Classic exposes four JOIN TEAM controls: red spymaster/operative, then blue
  // spymaster/operative. Assign one isolated player to each control.
  for (let index = 0; index < frames.length; index += 1) {
    const joins = frames[index].locator('button:visible').filter({ hasText: /JOIN TEAM/i });
    const count = await joins.count();
    emit('classic-role-controls', { player: names[index], count });
    assert.ok(count >= 4, `Expected four Classic role controls for ${names[index]}; saw ${count}.`);
    await joins.nth(index).click();
    await pause(1_000);
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: chromiumPath, headless: true });
  const contexts = [];
  const errors = Object.fromEntries(names.map(name => [name, []]));
  try {
    for (let index = 0; index < names.length; index += 1) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      contexts.push(context);
    }
    let pages = await Promise.all(contexts.map(context => context.newPage()));
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      page.setDefaultTimeout(180_000);
      page.on('console', message => {
        if (message.type() === 'error' && !message.text().includes('favicon.ico')) errors[names[index]].push(message.text());
      });
      page.on('pageerror', error => errors[names[index]].push(error.message));
    }

    const frameA = await enterLobby(pages[0], null, names[0]);
    const roomUrl = await waitForRoomUrl(frameA);
    assert.equal(pages[0].url(), wrapperUrl);
    emit('private-room-created', { route: '/r/[redacted]', wrapperStayedPut: true });

    const otherFrames = [];
    for (let index = 1; index < pages.length; index += 1) {
      otherFrames.push(await enterLobby(pages[index], roomUrl, names[index]));
    }
    let frames = [frameA, ...otherFrames];
    const visibleIdentities = await Promise.all(frames.map(frame => waitForFourIdentities(frame)));
    emit('lobby-identities', { visibleIdentities });
    assert.ok(visibleIdentities.every(identities => identities.length >= 4),
      'Every embedded player should see four distinct provider identities.');
    emit('four-embedded-players-share-lobby', {
      playerCount: 4,
      allClientsSeeFourPlayers: true,
      providerPreservedRequestedNames: visibleIdentities.every(identities => names.every(name => identities.includes(name))),
    });
    const providerNames = visibleIdentities[0].slice(0, 4);

    await Promise.all(frames.map(dismissGuide));
    const classicButton = frames[0].locator('button:visible').filter({ hasText: /^CLASSIC\s*4\+/i });
    if (await classicButton.count()) await classicButton.click();
    await pause(2_000);
    await joinClassicRoles(frames);
    await pause(3_000);

    const rolesBeforeDeparture = await Promise.all(frames.map(providerRoles));
    emit('roles-before-admin-departure', { roles: Object.fromEntries(names.map((name, index) => [name, rolesBeforeDeparture[index]])) });
    assert.ok(rolesBeforeDeparture[0].admin, 'Room creator should initially display provider Admin state.');

    await pages[0].close();
    await pause(8_000);
    const remainingBeforeStart = await Promise.all(frames.slice(1).map(providerRoles));
    const remainingSeeCreator = await Promise.all(frames.slice(1).map(async frame => (await bodyText(frame)).includes(names[0])));
    emit('admin-page-closed-before-start', {
      waitMs: 8000,
      remainingClients: 3,
      adminTransferredTo: names.slice(1).filter((name, index) => remainingBeforeStart[index].admin),
      startControlAt: names.slice(1).filter((name, index) => remainingBeforeStart[index].startVisible),
      creatorStillListed: remainingSeeCreator,
    });

    pages[0] = await contexts[0].newPage();
    pages[0].setDefaultTimeout(180_000);
    pages[0].on('console', message => {
      if (message.type() === 'error' && !message.text().includes('favicon.ico')) errors[names[0]].push(message.text());
    });
    pages[0].on('pageerror', error => errors[names[0]].push(error.message));
    await pages[0].goto(wrapperUrl, { waitUntil: 'domcontentloaded' });
    await pages[0].locator('#game-url').fill(roomUrl);
    await pages[0].getByRole('button', { name: 'Mount game' }).click();
    frames[0] = await waitForGameFrame(pages[0], url => url === roomUrl);
    await frames[0].locator('body').waitFor();
    await pause(5_000);
    const rejoinBeforeStart = {
      nicknamePrompt: await frames[0].locator('input[placeholder*="nickname" i]:visible').count() > 0,
      identityVisible: (await bodyText(frames[0])).includes(providerNames[0]),
      roles: await providerRoles(frames[0]),
    };
    emit('admin-rejoined-before-start', rejoinBeforeStart);
    assert.ok(!rejoinBeforeStart.nicknamePrompt && rejoinBeforeStart.identityVisible, 'Creator identity should recover in the same browser context.');

    const roleState = await Promise.all(frames.map(providerRoles));
    const starterIndex = roleState.findIndex(state => state.startEnabled);
    emit('start-ready', { starter: starterIndex >= 0 ? names[starterIndex] : null, roleState });
    assert.ok(starterIndex >= 0, 'One client should have an enabled Start control after creator rejoin.');
    await frames[starterIndex].locator('button:visible').filter({ hasText: /START GAME/i }).click();
    await pause(5_000);
    emit('post-start-state', {
      clients: await Promise.all(frames.map(async (frame, index) => ({
        player: names[index],
        detectedBoardWords: (await boardWords(frame)).length,
        bodyTail: (await bodyText(frame)).slice(-900),
        controls: await controlTexts(frame),
      }))),
    });
    const boards = [];
    for (let index = 0; index < frames.length; index += 1) {
      const words = await waitForBoard(frames[index]);
      emit('client-board-ready', { player: names[index], wordCount: words.length });
      boards.push(words);
    }
    assert.ok(boards.every(words => JSON.stringify(words) === JSON.stringify(boards[0])), 'All four clients should see the same 25-word board.');
    emit('four-player-classic-started', { clients: 4, cardsPerClient: boards.map(words => words.length), sameBoard: true });

    const adminIndex = (await Promise.all(frames.map(providerRoles))).findIndex(state => state.admin);
    const departingIndex = adminIndex >= 0 ? adminIndex : starterIndex;
    await pages[departingIndex].close();
    await pause(8_000);
    const survivorIndexes = [0, 1, 2, 3].filter(index => index !== departingIndex);
    const survivorBoards = await Promise.all(survivorIndexes.map(index => waitForBoard(frames[index], 30_000)));
    assert.ok(survivorBoards.every(words => JSON.stringify(words) === JSON.stringify(boards[0])), 'Admin departure must not destroy or replace the survivors\' active board.');
    const survivorRoles = await Promise.all(survivorIndexes.map(index => providerRoles(frames[index])));
    emit('provider-admin-left-during-match', {
      departed: names[departingIndex],
      survivorsRetainedSameBoard: true,
      adminTransferredTo: survivorIndexes.filter((_, index) => survivorRoles[index].admin).map(index => names[index]),
    });

    pages[departingIndex] = await contexts[departingIndex].newPage();
    pages[departingIndex].setDefaultTimeout(180_000);
    await pages[departingIndex].goto(wrapperUrl, { waitUntil: 'domcontentloaded' });
    await pages[departingIndex].locator('#game-url').fill(roomUrl);
    await pages[departingIndex].getByRole('button', { name: 'Mount game' }).click();
    frames[departingIndex] = await waitForGameFrame(pages[departingIndex], url => url === roomUrl);
    const returnedBoard = await waitForBoard(frames[departingIndex]);
    const returnedText = await bodyText(frames[departingIndex]);
    const returnResult = {
      nicknamePrompt: await frames[departingIndex].locator('input[placeholder*="nickname" i]:visible').count() > 0,
      identityVisible: returnedText.includes(providerNames[departingIndex]),
      sameBoard: JSON.stringify(returnedBoard) === JSON.stringify(boards[0]),
      roles: await providerRoles(frames[departingIndex]),
    };
    emit('provider-admin-rejoined-match', returnResult);
    assert.ok(!returnResult.nicknamePrompt && returnResult.identityVisible && returnResult.sameBoard,
      'Departing provider Admin should recover identity and the same active match in the same context.');

    emit('console-errors', Object.fromEntries(names.map(name => [name, [...new Set(errors[name])]])));
    emit('overall', { status: 'pass', experiment: 'four-player-classic-admin-lifecycle' });
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
