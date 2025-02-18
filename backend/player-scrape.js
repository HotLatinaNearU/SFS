import puppeteer from 'puppeteer';

let browser;

/**
 * Launches the Puppeteer browser (only one instance).
 * @returns {Promise<puppeteer.Browser>}
 */
const launchBrowser = async () => {
  if (!browser) {
    browser = await puppeteer.launch({ headless: false });
  }
  return browser;
};

/**
 * Retrieves the game log page URL for a player from Basketball Reference.
 * @param {puppeteer.Browser} browser - Puppeteer browser instance.
 * @param {string} team - The NBA team's abbreviation (e.g., "LAL").
 * @param {string} player - The full name of the player (e.g., "LeBron James").
 * @returns {Promise<string|null>} - Returns the player's game log URL or null if not found.
 */
const getPlayerGameLogUrl = async (browser, team, player) => {
  try {
    const page = await browser.newPage();
    const teamURL = `https://www.basketball-reference.com/teams/${team.toUpperCase()}/2025.html`;

    await page.goto(teamURL, { waitUntil: 'domcontentloaded' });

    const playerURL = await page.evaluate((playerName) => {
      const players = [...document.querySelectorAll("#roster tbody tr td:nth-child(2) a")];
      const playerElement = players.find(el => el.textContent.trim() === playerName);
      return playerElement ? playerElement.href.replace(".html", "/gamelog/2025") : null;
    }, player);

    await page.close(); // Close the page after use
    return playerURL;

  } catch (error) {
    console.error("Error in getPlayerGameLogUrl:", error);
    return null;
  }
};

/**
 * Extracts specific stats from the player's game log page.
 * @param {puppeteer.Page} page - Puppeteer page instance.
 * @param {string} stat - The `data-stat` attribute to extract.
 * @returns {Promise<string[]>} - Extracted values as an array.
 */
const extractStatGenLog = async (page, stat) => {
  return page.evaluate((stat) => {
    return [...document.querySelectorAll(`td[data-stat="${stat}"]`)].map(el => el.textContent.trim());
  }, stat);
};

/**
 * Processes player statistics.
 * @param {puppeteer.Browser} browser - Puppeteer browser instance.
 * @param {string} Team - NBA team abbreviation.
 * @param {string} Player - Player's full name.
 */
const processPlayer = async (browser, team, player) => {
  try {
    const playerURL = await getPlayerGameLogUrl(browser, team, player);
    if (!playerURL) {
      console.error(`Player ${player} not found.`);
      return;
    }

    const page = await browser.newPage();
    await page.goto(playerURL, { waitUntil: 'domcontentloaded' });

    // Stats to extract from general game log
    const statsToExtract = [
      "pts", "fga", "fg3a", "fta", "fg_pct", "fg3_pct", "ft_pct",
      "opp_id", "mp", "game_season", "date_game", "game_location"
    ];

    const extractedStats = await Promise.all(statsToExtract.map(stat => extractStatGenLog(page, stat)));

    let [points, fga, fg3a, fta, fgPct, fg3Pct, ftPct, oppTeams, minutesPlayed, gameNumbers, gameDates, gameLocations] = extractedStats;

    // Clean data by filtering out invalid games
    const validIndices = gameNumbers.map((num, index) => num !== '' ? index : null).filter(i => i !== null);
    const cleanData = arr => validIndices.map(i => arr[i]);

    gameNumbers = cleanData(gameNumbers);
    oppTeams = cleanData(oppTeams);
    gameDates = cleanData(gameDates);
    gameLocations = cleanData(gameLocations).map(loc => (loc === '@' ? 'Away' : 'Home'));

    // Navigate to advanced stats page
    await page.goto(playerURL.replace("gamelog", "gamelog-advanced"), { waitUntil: 'domcontentloaded' });

    const [usgPct, PlayerOR] = await Promise.all([
      extractStatGenLog(page, "usg_pct"),
      extractStatGenLog(page, "off_rtg")
    ]);


    await page.close(); // Ensure the page is closed after processing

    return {
      player,
      team,
      points,
      fga,
      fg3a,
      fta,
      fgPct,
      fg3Pct,
      ftPct,
      oppTeams,
      minutesPlayed,
      gameNumbers,
      gameDates,
      gameLocations,
      usgPct,
      PlayerOR
    };


  } catch (error) {
    console.error(`Error processing player ${Player}:`, error);
  }
};


/**
 * Runs the scraping process.
 */
const run = async () => {
  const browser = await launchBrowser();

  
    //add promise

    const lebronStats = await processPlayer(browser, "LAL", "LeBron James");
    const knechtStats = await processPlayer(browser, "LAL", "Dalton Knecht");
  
    console.log(lebronStats.gameLocations);
    console.log(knechtStats.gameLocations);
  

  // Ensure all player processes are awaited
    //processPlayer(browser, "LAL", "LeBron James"),
    //processPlayer(browser, "LAL", "Dalton Knecht"),
    /*
    processPlayer(browser, "LAL", "Austin Reaves"),
    processPlayer(browser, "LAL", "Rui Hachimura"),
    processPlayer(browser, "LAL", "Gabe Vincent"),
    processPlayer(browser, "LAL", "Jaxson Hayes"),
    processPlayer(browser, "LAL", "Cam Reddish"),
    processPlayer(browser, "LAL", "Dorian Finney-Smith"),
    processPlayer(browser, "LAL", "Shake Milton"),
    processPlayer(browser, "LAL", "Jarred Vanderbilt"),
    processPlayer(browser, "LAL", "Markieff Morris"),
    processPlayer(browser, "LAL", "Luka Dončić"),
    processPlayer(browser, "LAL", "Alex Len"),
    */

    



  await browser.close(); // Close browser after all processes finish
};

run();

