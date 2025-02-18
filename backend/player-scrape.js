import puppeteer from 'puppeteer';

let browser;

/**
 * Launches the Puppeteer browser (only one instance).
 * @returns {Promise<puppeteer.Browser>}
 */
const launchBrowser = async () => {
  if (!browser) {
    browser = await puppeteer.launch({ headless: true });
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
      return null; // Return null to prevent further errors
    }

    const page = await browser.newPage();
    await page.goto(playerURL, { waitUntil: 'domcontentloaded' });

    const statsToExtract = [
      "pts", "ast", "trb", "orb", "drb", "stl", "blk", "tov", "pf", "game_score",
      "fga", "fg3a", "fta", "fg_pct", "fg3_pct", "ft_pct",
      "opp_id", "mp", "game_season", "date_game", "game_location"
    ];

    // Attempt to extract all stats safely
    const extractedStats = await Promise.all(
      statsToExtract.map(async (stat) => {
        try {
          return await extractStatGenLog(page, stat) ?? null; // Avoid undefined values
        } catch (error) {
          console.error(`Error extracting ${stat} for ${player}:`, error);
          return null;
        }
      })
    );

    // Ensure extractedStats is properly populated
    if (extractedStats.includes(undefined)) {
      console.error(`Failed to extract stats for ${player}.`);
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
      console.error(`Invalid game numbers for ${player}`);
      await page.close();
      return null;
    }

    const validIndices = game_numbers.map((num, index) => num !== '' ? index : null).filter(i => i !== null);
    const cleanData = arr => validIndices.map(i => arr[i] ?? null);

    game_numbers = cleanData(game_numbers);
    opp_teams = cleanData(opp_teams);
    game_dates = cleanData(game_dates);
    game_locations = cleanData(game_locations).map(loc => (loc === '@' ? 'Away' : 'Home'));

    // Navigate to advanced stats page
    await page.goto(playerURL.replace("gamelog", "gamelog-advanced"), { waitUntil: 'domcontentloaded' });

    const [usg_pct, player_or] = await Promise.all([
      
      extractStatGenLog(page, "usg_pct").catch(() => null),
      extractStatGenLog(page, "off_rtg").catch(() => null)
    ]);

    await page.close();

    return {
      player,
      team,
      pts, ast, trb, orb, drb, stl, blk, tov, pf, game_score,
      fga, fg3a, fta, fgPct, fg3Pct, ftPct,
      opp_teams, minutes_played, game_numbers, game_dates, game_locations,
      usg_pct, player_or
    };

  } catch (error) {
    console.error(`Error processing player ${player}:`, error);
    return null;
  }
};

const run = async () => {
  const browser = await launchBrowser();

  try {
    const players = [
      { team: "LAL", name: "LeBron James" },
      { team: "LAL", name: "Dalton Knecht" }
    ];

    const playerStats = await Promise.all(
      players.map(({ team, name }) => processPlayer(browser, team, name))
    );

    playerStats.forEach(stats => {
      if (stats) {
        console.log(`${stats.usg_pct}`);
      } else {
        console.log(`Failed to retrieve stats for a player.`);
      }
    });

  } catch (error) {
    console.error("Error running script:", error);
  } finally {
    await browser.close();
  }
};

run();
