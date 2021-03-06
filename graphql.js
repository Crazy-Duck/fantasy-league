const graphql = require('graphql-request').request;
const fs = require('fs');

const league = process.argv[2] || 12004;
const maxTotal = Number(process.argv[3]) || 0;
const maxTake = 10;

function getQuery(skip, take) {
  return `{
    leagues(request: {leagueId: ${league}}) {
      matches(request: {skip: ${skip}, take: ${take}, isParsed: true}) {
        id
        players {
          steamAccountId
          numLastHits
          numDenies
          kills
          deaths
          assists
          goldPerMinute
          stats {
            campStack
            runes {
              rune
            }
            wards {
              type
            }
            heroDamageReport {
              dealtTotal {
                stunDuration
              }
            }
          }
          steamAccount {
            name
          }
          isRadiant
          playbackData {
            csEvents {
              npcId
            }
            killEvents {
              time
            }
          }
          hero {
            displayName
          }
        }
        stats {
          radiantKills
          direKills
        }
        firstBloodTime
      }
    }
  }`;
}

function calcTeamfightParticipation(player, radiantKills, direKills) {
  return (player.kills + player.assists) / (player.isRadiant ? radiantKills : direKills);
}

function calcTowerKills(csEvents) {
  return csEvents?.map(cs => cs.npcId).filter(cs => cs >= 16 && cs <= 35).length || 0;
}

function calcRoshKills(csEvents) {
  return csEvents?.map(cs => cs.npcId).filter(cs => cs == 133).length;
}

function calcFantasyPoints(stats) {

  return 0.3 * stats.kills
      + 3 - 0.3 * stats.deaths
      + 0.003 * stats.numLastHits
      + 0.003 * stats.numDenies
      + 0.002 * stats.goldPerMin
      + stats.roshKills
      + stats.towerKills
      + 0.5 * stats.wards
      + 0.5 * stats.stacks
      + 0.25 * stats.runes
      + 4 * (stats.firstBlood ? 1 : 0)
      + 0.00005 * stats.stunDuration
      + 3 * stats.teamFightParticipation;
}

function nextTake(f, m) {
  return m ? Math.min(maxTake, m - f) : maxTake;
}

(async () => {

  let skip = 0;
  let take = nextTake(0, maxTotal);
  let matches = [];
  let lastLength = 0;

  do {
    console.log(`Fetching batch of ${take} ...`);
    let next =  (await graphql(`https://api.stratz.com/graphql`, getQuery(skip, take))).leagues[0].matches;
    console.log('done.');
    lastLength = next.length;
    matches.push(...next);
    skip += take;
    take = nextTake(skip, maxTotal);
  } while (lastLength == maxTake && take > 0)

  // fs.writeFileSync('temp.json', JSON.stringify(matches));

  // let matches = JSON.parse(fs.readFileSync('temp.json'));

  let fantasy = matches.map(m => {
    let match = {};
    match.id = m.id;
    match.radiantKills = m.stats.radiantKills?.reduce((a, b) => a + b, 0);
    match.direKills = m.stats.direKills?.reduce((a, b) => a + b, 0);
    match.players = m.players.map(p => {
      let fantasyStats = {
        "isRadiant": p.isRadiant,
        "kills": p.kills,
        "deaths": p.deaths,
        "numLastHits": p.numLastHits,
        "numDenies": p.numDenies,
        "goldPerMin": p.goldPerMinute,
        "wards": p.stats.wards.filter(w => w.type == 0).length,
        "stacks": p.stats.campStack?.pop() || 0,
        "runes": p.stats.runes?.length || 0,
        "firstBlood": p.playbackData.killEvents[0]?.time == m.firstBloodTime,
        "teamFightParticipation": calcTeamfightParticipation(p, match.radiantKills, match.direKills),
        "stunDuration": p.stats.heroDamageReport.dealtTotal.stunDuration,
        "towerKills": calcTowerKills(p.playbackData?.csEvents),
        "roshKills": calcRoshKills(p.playbackData?.csEvents)
      };
      let player = {
        "steamAccountId": p.steamAccountId,
        "name": p.steamAccount.name
      };
      player.fantasyPoints = Math.round((calcFantasyPoints(fantasyStats) + Number.EPSILON) * 100) / 100;
      
      return player;
    });
    return match;
  })

  fs.writeFileSync('matches.json', JSON.stringify(fantasy, null, 2))
})();
