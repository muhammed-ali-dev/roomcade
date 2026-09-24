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

const wrapperUrl = 'http://127.0.0.1:8000/iframe-test-v2.html';
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

async function waitForUrl(frame, predicate, timeout = 180_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate(frame.url())) return frame.url();
    await pause(500);
  }
  throw new Error('Timed out waiting for the Codenames room URL.');
}

async function dismissGuide(scope) {
  const button = scope.locator('button:visible').filter({ hasText: /GOT IT/i }).first();
  if (await button.count()) await button.click({ force: true }).catch(() => {});
}

async function visibleControlSnapshot(scope) {
  return scope.locator('button:visible, input:visible').evaluateAll(elements => elements.map(element => ({
    tag: element.tagName,
    text: (element.innerText || '').trim().slice(0, 120),
    placeholder: element.getAttribute('placeholder'),
    ariaLabel: element.getAttribute('aria-label'),
    disabled: element.disabled,
  })).filter(item => item.text || item.placeholder || item.ariaLabel));
}

async function visibleButtonSnapshot(scope) {
  return scope.locator('button:visible').evaluateAll(elements => elements.map((element, index) => ({
    index,
    text: (element.innerText || '').trim().slice(0, 120),
    ariaLabel: element.getAttribute('aria-label'),
    title: element.getAttribute('title'),
    type: element.getAttribute('type'),
    classes: element.className,
    disabled: element.disabled,
  })));
}

async function ancestrySnapshot(locator) {
  return locator.evaluate(element => {
    const result = [];
    let current = element;
    for (let depth = 0; depth < 14 && current; depth += 1, current = current.parentElement) {
      result.push({
        tag: current.tagName,
        classes: typeof current.className === 'string' ? current.className : '',
        role: current.getAttribute('role'),
        text: (current.innerText || '').trim().slice(0, 80),
      });
    }
    return result;
  });
}

async function firstBoardWord(scope) {
  const lines = (await scope.locator('body').innerText()).split('\n').map(line => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (lines[index] === lines[index + 1] && /^[A-Z][A-Z -]{2,}$/.test(lines[index]) &&
        !['GAME LOG', 'SIDE A', 'SIDE B'].includes(lines[index])) return lines[index];
  }
  throw new Error('Could not identify a board word.');
}

async function cardColorMap(scope) {
  return scope.locator('article[style*="--CardColor"]').evaluateAll(cards => Object.fromEntries(cards.map(card => {
    const words = (card.innerText || '').split('\n').map(value => value.trim()).filter(Boolean);
    return [words.at(-1), card.style.getPropertyValue('--CardColor').trim()];
  }).filter(([word]) => word)));
}

(async () => {
  const browser = await chromium.launch({ executablePath: chromiumPath, headless: true });
  try {
    const contexts = await Promise.all([0, 1].map(() => browser.newContext({
      viewport: { width: 1440, height: 1000 },
    })));
    const [contextA, contextB] = contexts;
    const [pageA, pageB] = await Promise.all([contextA.newPage(), contextB.newPage()]);
    pageA.setDefaultTimeout(180_000);
    pageB.setDefaultTimeout(180_000);
    const errors = { a: [], b: [] };
    for (const [page, key] of [[pageA, 'a'], [pageB, 'b']]) {
      page.on('console', message => {
        if (message.type() === 'error' && !message.text().includes('favicon.ico')) errors[key].push(message.text());
      });
      page.on('pageerror', error => errors[key].push(error.message));
    }

    await pageA.goto(wrapperUrl, { waitUntil: 'domcontentloaded' });
    await pageA.getByRole('button', { name: 'Mount game' }).click();
    const frameA = await waitForGameFrame(pageA, url => url.startsWith('https://codenames.game'));
    const nicknameA = frameA.locator('input[placeholder="Nickname"], input[placeholder*="nickname" i]').first();
    await nicknameA.waitFor();
    await nicknameA.fill('RcadeA26');
    await nicknameA.press('Tab');
    await frameA.locator('button:visible').filter({ hasText: /ENTER GAME/i }).click();
    const roomUrl = await waitForUrl(frameA, url => /^https:\/\/codenames\.game\/r\//.test(url));
    emit('embedded-room-created', { wrapperStayedPut: pageA.url() === wrapperUrl });

    await pageB.goto(wrapperUrl, { waitUntil: 'domcontentloaded' });
    await pageB.locator('#game-url').fill(roomUrl);
    await pageB.getByRole('button', { name: 'Mount game' }).click();
    const frameB = await waitForGameFrame(pageB, url => url === roomUrl);
    const nicknameB = frameB.locator('input[placeholder="Nickname"], input[placeholder*="nickname" i]').first();
    await nicknameB.waitFor();
    await nicknameB.fill('RcadeB26');
    await nicknameB.press('Tab');
    await frameB.locator('button:visible').filter({ hasText: /ENTER GAME/i }).click();
    await nicknameB.waitFor({ state: 'hidden' });
    await frameA.getByText(/RcadeB26|Player1/, { exact: true }).last().waitFor();
    await frameB.getByText(/RcadeA26|Player1/, { exact: true }).first().waitFor();
    emit('two-embedded-players-share-lobby', {
      aSeesB: true,
      bSeesA: true,
      providerUsedFallbackName: !(await frameA.getByText('RcadeB26', { exact: true }).count()),
    });

    await Promise.all([dismissGuide(frameA), dismissGuide(frameB)]);
    await frameA.locator('button:visible').filter({ hasText: /^DUET\s*2\+/i }).click();
    await pause(2_000);
    const joinA = frameA.locator('button:visible').filter({ hasText: /JOIN TEAM/i });
    const joinB = frameB.locator('button:visible').filter({ hasText: /JOIN TEAM/i });
    await joinA.first().click();
    await pause(1_000);
    await joinB.last().click();
    await pause(2_000);
    emit('duet-roles-selected', { aJoinControls: await joinA.count(), bJoinControls: await joinB.count() });

    const start = frameA.locator('button:visible').filter({ hasText: /START GAME/i });
    emit('start-ready', { enabled: await start.isEnabled() });
    await start.click();
    await frameA.locator('body').getByText(/Give a clue|Tap on cards|guessing now/i).first().waitFor();
    await pause(3_000);
    emit('match-started', {
      aStayedEmbedded: pageA.url() === wrapperUrl,
      bStayedEmbedded: pageB.url() === wrapperUrl,
      aHasGameLog: (await frameA.locator('body').innerText()).includes('GAME LOG'),
      bHasGameLog: (await frameB.locator('body').innerText()).includes('GAME LOG'),
      errorCounts: { a: errors.a.length, b: errors.b.length },
    });

    const sampleWord = await firstBoardWord(frameA);
    const colorsA = await cardColorMap(frameA);
    const colorsB = await cardColorMap(frameB);
    const comparableWords = Object.keys(colorsA).filter(word => word in colorsB);
    const differentPrivateColors = comparableWords.filter(word => colorsA[word] !== colorsB[word]);
    emit('private-key-views', {
      comparableCards: comparableWords.length,
      cardsWithDifferentPrivateColor: differentPrivateColors.length,
      viewsDiffer: differentPrivateColors.length > 0,
    });
    assert.equal(comparableWords.length, 25, 'Both embedded players should have the same 25-word board.');
    assert.ok(differentPrivateColors.length > 0, 'Duet players should retain different private key views.');
    const wordA = frameA.getByText(sampleWord, { exact: true }).filter({ visible: true }).last();
    const wordB = frameB.getByText(sampleWord, { exact: true }).filter({ visible: true }).last();
    emit('private-view-dom-sample', { sampleWord, aCardFound: await wordA.count() > 0, bCardFound: await wordB.count() > 0 });

    const aCanClue = await frameA.locator('input[placeholder="Your clue"]:visible').count() > 0;
    const clueScope = aCanClue ? frameA : frameB;
    const otherScope = aCanClue ? frameB : frameA;
    const guessWord = otherScope.getByText(sampleWord, { exact: true }).filter({ visible: true }).last();
    await clueScope.locator('input[placeholder="Your clue"]:visible').fill('ORBIT');
    await clueScope.locator('button:visible').filter({ hasText: /^-$/ }).click();
    await pause(1_500);
    emit('clue-number-picker-opened', { cluegiver: aCanClue ? 'A' : 'B', optionOneVisible: await clueScope.locator('button:visible').filter({ hasText: /^1$/ }).count() > 0 });
    const one = clueScope.locator('button:visible').filter({ hasText: /^1$/ }).last();
    if (await one.count()) await one.click();
    await pause(500);
    const giveClue = clueScope.locator('button:visible').filter({ hasText: /GIVE CLUE/i }).last();
    const clueInput = clueScope.locator('input[placeholder="Your clue"]:visible');
    const cluePanel = clueInput.locator('xpath=ancestor::main[1]');
    const arrowSubmit = cluePanel.locator('button').last();
    emit('clue-ready', {
      giveClueCount: await giveClue.count(),
      arrowSubmitVisible: await arrowSubmit.isVisible(),
    });
    if (await giveClue.count()) await giveClue.click();
    else {
      await clueInput.press('Escape');
      await arrowSubmit.click();
    }
    await pause(3_000);
    const cluePropagated = (await otherScope.locator('body').innerText()).includes('ORBIT');
    emit('clue-submit-result', {
      cluePropagated,
      cluegiverControls: await visibleControlSnapshot(clueScope),
      otherControls: await visibleControlSnapshot(otherScope),
    });
    assert.ok(cluePropagated, 'The clue should propagate to the other embedded player.');
    if (cluePropagated) {
      emit('clue-propagated', {
        otherTextTail: (await otherScope.locator('body').innerText()).slice(-1_200),
        otherControls: await visibleControlSnapshot(otherScope),
      });
      await dismissGuide(otherScope);
      await guessWord.click();
      await pause(750);
      emit('guess-selection', {
        guesserSelectedWord: sampleWord,
        guesserConfirmVisible: await otherScope.locator('button:visible.green-gradient-light').count() > 0,
      });
      const cluegiverCard = clueScope.getByText(sampleWord, { exact: true }).filter({ visible: true }).last()
        .locator('xpath=ancestor::article[contains(@style,"--CardColor")][1]');
      const cluegiverSawGuesserSuggestion = await cluegiverCard.count() > 0 &&
        /RcadeB26|Player1/.test(await cluegiverCard.innerText());
      emit('guesser-selection-synchronized', { cluegiverSawGuesserSuggestion });
      assert.ok(cluegiverSawGuesserSuggestion, 'The cluegiver should receive the guesser suggestion.');
      const confirmGuess = otherScope.locator('button:visible.green-gradient-light').last();
      emit('guess-confirm-ready', { confirmControlCount: await confirmGuess.count() });
      assert.equal(await confirmGuess.count(), 1, 'The guesser should receive one confirmation control.');
      if (await confirmGuess.count()) {
        await confirmGuess.click();
        await pause(3_000);
        const cluegiverBody = await clueScope.locator('body').innerText();
        const guesserBody = await otherScope.locator('body').innerText();
        emit('guess-confirmed-and-synchronized', {
          confirmControlRemaining: await otherScope.locator('button:visible.green-gradient-light').count(),
          cluegiverInstruction: cluegiverBody.split('\n').find(line => /guess|clue|win|lose/i.test(line)) || null,
          guesserInstruction: guesserBody.split('\n').find(line => /guess|clue|win|lose/i.test(line)) || null,
          cluegiverCardCount: Object.keys(await cardColorMap(clueScope)).length,
          guesserCardCount: Object.keys(await cardColorMap(otherScope)).length,
        });
        const gameLogTrigger = clueScope.getByText('GAME LOG', { exact: true }).filter({ visible: true }).last();
        if (await gameLogTrigger.count()) await gameLogTrigger.click();
        await pause(1_000);
        const cluegiverAfterGuess = await clueScope.locator('body').innerText();
        emit('guesser-action-visible-to-cluegiver', {
          gameLogMentionsTap: /tap/i.test(cluegiverAfterGuess),
          gameLogMentionsSelectedWord: cluegiverAfterGuess.includes(sampleWord),
          selectedWord: sampleWord,
        });
      }
    }

    await pageB.getByRole('button', { name: 'Unmount iframe' }).click();
    await pause(500);
    emit('iframe-unmounted', { remoteFrameCount: pageB.frames().filter(frame => frame.url().startsWith('https://codenames.game')).length });
    await pageB.getByRole('button', { name: 'Mount game' }).click();
    const remountedB = await waitForGameFrame(pageB, url => url === roomUrl);
    await remountedB.locator('body').waitFor();
    await pause(8_000);
    const remountedText = await remountedB.locator('body').innerText();
    const remountResult = {
      nicknamePrompt: await remountedB.locator('input[placeholder="Nickname"]:visible').count() > 0,
      participantVisible: remountedText.includes('RcadeB26') || remountedText.includes('Player1'),
      activeMatchVisible: remountedText.includes('GAME LOG'),
    };
    emit('iframe-remounted', remountResult);
    assert.ok(!remountResult.nicknamePrompt && remountResult.participantVisible && remountResult.activeMatchVisible,
      'Remount should restore identity and the active match.');
    await pageB.reload({ waitUntil: 'domcontentloaded' });
    const refreshedB = await waitForGameFrame(pageB, url => url === roomUrl);
    await refreshedB.locator('body').waitFor();
    await pause(8_000);
    const refreshedText = await refreshedB.locator('body').innerText();
    const refreshResult = {
      autoMountedFromSessionStorage: true,
      nicknamePrompt: await refreshedB.locator('input[placeholder="Nickname"]:visible').count() > 0,
      participantVisible: refreshedText.includes('RcadeB26') || refreshedText.includes('Player1'),
      activeMatchVisible: refreshedText.includes('GAME LOG'),
    };
    emit('outer-page-refreshed', refreshResult);
    assert.ok(!refreshResult.nicknamePrompt && refreshResult.participantVisible && refreshResult.activeMatchVisible,
      'Outer-page refresh should restore identity and the active match.');
    emit('console-errors', {
      a: [...new Set(errors.a)],
      b: [...new Set(errors.b)],
    });
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
