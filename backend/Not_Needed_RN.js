/**
 * Calculates the average stat against a specific opponent.
 * @param {string} opp - The opponent's NBA team abbreviation.
 * @param {Array<number>} statList - List of player stats.
 * @param {Array<string>} oppList - List of opponent teams played.
 * @returns {number} - Average stat against the specified opponent.

const getAvgStatAgainstOpp = async (opp, statList, oppList) => {
  let totalStat = 0;
  let count = 0;

  for (let i = 0; i < oppList.length; i++) {
    if (opp === oppList[i]) {
      totalStat += parseInt(statList[i], 10);
      count++;
    }
  }
  return count > 0 ? totalStat / count : 0;
};
*/