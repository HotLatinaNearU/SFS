


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
const getPlayerGameLogUrl = async (browser, team) => {
  try {
    const page = await browser.newPage();
    const teamURL = `https://www.basketball-reference.com/teams/${team.toUpperCase()}/2025.html`;

    await page.goto(teamURL, { waitUntil: 'domcontentloaded' });

    // Extract all player names and URLs from the roster table
    const players = await page.evaluate(() => {
      const playerElements = [...document.querySelectorAll("#roster tbody tr td:nth-child(2) a")];
      return playerElements.map(player => {
        const fullName = player.textContent.trim().replace(/\s+/g, '-');
        return {
          [fullName]: player.href.replace(".html", "/gamelog/2025")
        };
      });
    });

    await page.close(); // Close the page after use
    return players;

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
const processPlayer = async (browser, team, playerN) => {
  try {

    const playerList = await getPlayerGameLogUrl(browser, team);

    console.log(playerList)


    //change to for each going through everyone one on the roaster 
    // Find the object that contains the playerN key dynamically
    const playerData = playerList.find(player => player[playerN]);
    
    let playerURL = playerData[playerN]; // Use bracket notation to access dynamic key


    console.log(playerURL)

    if (!playerURL) {
      console.error(`Player ${playerN} not found.`);
      return null; // Return null to prevent further errors
    }

    const page = await browser.newPage();
    await page.goto(playerURL, { waitUntil: 'domcontentloaded' });

    const statsToExtract = [
      "pts", "ast", "trb", "orb", "drb", "stl", "blk", "tov", "pf", "game_score",
      "fga", "fg3a", "fta", "fg_pct", "fg3_pct", "ft_pct",
      "opp_id", "mp", "game_season", "date_game", "game_location"
    ];

    const advStatsToExtract = [
      "ts_pct", "efg_pct", "orb_pct", "drb_pct", "trb_pct", "ast_pct", 
      "stl_pct", "blk_pct", "tov_pct", "usg_pct", "off_rtg", "def_rtg", 
      "gmsc", "bpm"
    ];

    // Attempt to extract all stats safely
    const extractedStats = await Promise.all(
      statsToExtract.map(async (stat) => {
        try {
          return await extractStatGenLog(page, stat) ?? null; // Avoid undefined values
        } catch (error) {
          console.error(`Error extracting ${stat} for ${playerN}:`, error);
          return null;
        }
      })
    );

    // Ensure extractedStats is properly populated
    if (extractedStats.includes(undefined)) {
      console.error(`Failed to extract stats for ${playerN}.`);
      await page.close();
      return null;
    }

    let [
      pts, ast, trb, orb, drb, stl, blk, tov, pf, game_score,
      fga, fg3a, fta, fgPct, fg3Pct, ftPct,
      opp_teams, minutes_played, game_numbers, game_dates, game_locations
    ] = extractedStats;

    // Clean data by filtering out invalid games
    if (!game_numbers || !Array.isArray(game_numbers)) {
      console.error(`Invalid game numbers for ${playerN}`);
      await page.close();
      return null;
    }

    const validIndices = game_numbers.map((num, index) => num !== '' ? index : null).filter(i => i !== null);
    const cleanData = arr => validIndices.map(i => arr[i] ?? null);

    game_numbers = cleanData(game_numbers);
    opp_teams = cleanData(opp_teams);
    game_dates = cleanData(game_dates);
    game_locations = cleanData(game_locations).map(loc => (loc === '@' ? 'Away' : 'Home'));

    await page.goto(playerURL.replace("gamelog", "gamelog-advanced"), { waitUntil: 'domcontentloaded' });

    // Extract advanced stats separately
    const extractedAdvStats = await Promise.all(
      advStatsToExtract.map(async (stat) => {
        try {
          return await extractStatGenLog(page, stat) ?? null;
        } catch (error) {
          console.error(`Error extracting ${stat} for ${playerN}:`, error);
          return null;
        }
      })
    );
    
    let [
      ts_pct, efg_pct, orb_pct, drb_pct, trb_pct, ast_pct, 
      stl_pct, blk_pct, tov_pct, usg_pct, off_rtg, def_rtg, 
      gmsc, bpm
    ] = extractedAdvStats;

    await page.close();

    return {
      playerN,
      team,
      pts, ast, trb, orb, drb, stl, blk, tov, pf, game_score,
      fga, fg3a, fta, fgPct, fg3Pct, ftPct,
      opp_teams, minutes_played, game_numbers, game_dates, game_locations,
      usg_pct, off_rtg, ts_pct, efg_pct, orb_pct, drb_pct, trb_pct, ast_pct, 
      stl_pct, blk_pct, tov_pct, def_rtg, gmsc, bpm
    };

  } catch (error) {
    console.error(`Error processing player:`, error);
    return null;
  }
};

const run = async () => {
  const browser = await launchBrowser();

  try {

  let a = await processPlayer(browser, "LAL", "LeBron-James")
  
  console.log(a.ast)

  
  } catch (error) {
    console.error("Error running script:", error);
  } finally {
    await browser.close();
  }

};

run();



//get team def rating
//add get roaster > do in get game function import both teams, then add injury variable which will remove a player and it will process both teams 