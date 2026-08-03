import assert from "node:assert/strict";

import { PlayerRole, SlotType, ScorePlayerFinalType } from "@prisma/client";

import { calculateFantavote } from "../lib/scoring/calculate-fantavote.ts";
import { calculateTeamScore } from "../lib/scoring/calculate-team-score.ts";
import { convertScoreToGoals } from "../lib/scoring/convert-score-to-goals.ts";

function player(playerId, role, slotType, positionOrder, vote) {
  return {
    lineupPlayerId: `${playerId}-lineup`,
    playerId,
    playerName: playerId,
    positionOrder,
    role,
    slotType,
    vote
  };
}

function validVote(baseVote, overrides = {}) {
  return {
    assists: 0,
    baseVote,
    cleanSheet: 0,
    goals: 0,
    goalsConceded: 0,
    isSv: false,
    ownGoals: 0,
    penaltiesMissed: 0,
    penaltiesSaved: 0,
    redCards: 0,
    yellowCards: 0,
    ...overrides
  };
}

function svVote() {
  return {
    baseVote: null,
    isSv: true
  };
}

function runChecks() {
  assert.equal(convertScoreToGoals(25), 0, "25 -> 0 goals");
  assert.equal(convertScoreToGoals(26.9), 0, "26.9 -> 0 goals");
  assert.equal(convertScoreToGoals(27), 1, "27 -> 1 goal");
  assert.equal(convertScoreToGoals(28.9), 1, "28.9 -> 1 goal");
  assert.equal(convertScoreToGoals(29), 2, "29 -> 2 goals");
  assert.equal(convertScoreToGoals(31), 3, "31 -> 3 goals");

  const fantavote = calculateFantavote(
    validVote(6, {
      assists: 1,
      cleanSheet: 1,
      goals: 1,
      goalsConceded: 1,
      penaltiesMissed: 1,
      yellowCards: 1
    })
  );
  // 6 +3(gf) +1(ass) +1(cs) -0.5(amm) -3(rf) -1(gs) = 6.5
  assert.equal(fantavote.finalFantavote, 6.5, "Fantavote with bonus and malus");

  const allStartersValid = calculateTeamScore({
    lineupPlayers: [
      player("s1", PlayerRole.GOALKEEPER, SlotType.STARTER, 1, validVote(6)),
      player("s2", PlayerRole.DEFENDER, SlotType.STARTER, 2, validVote(6.5)),
      player("s3", PlayerRole.MIDFIELDER, SlotType.STARTER, 3, validVote(7)),
      player("s4", PlayerRole.ATTACKER, SlotType.STARTER, 4, validVote(5.5)),
      player("s5", PlayerRole.MIDFIELDER, SlotType.STARTER, 5, validVote(6)),
      player("b1", PlayerRole.GOALKEEPER, SlotType.BENCH, 1, validVote(7.5)),
      player("b2", PlayerRole.DEFENDER, SlotType.BENCH, 2, validVote(6)),
      player("b3", PlayerRole.MIDFIELDER, SlotType.BENCH, 3, validVote(5)),
      player("b4", PlayerRole.ATTACKER, SlotType.BENCH, 4, validVote(6))
    ]
  });
  assert.equal(allStartersValid.totalScore, 31);
  assert.equal(allStartersValid.substitutionsCount, 0);

  const sameRoleSub = calculateTeamScore({
    lineupPlayers: [
      player("s1", PlayerRole.GOALKEEPER, SlotType.STARTER, 1, validVote(6)),
      player("s2", PlayerRole.DEFENDER, SlotType.STARTER, 2, svVote()),
      player("s3", PlayerRole.MIDFIELDER, SlotType.STARTER, 3, validVote(7)),
      player("s4", PlayerRole.ATTACKER, SlotType.STARTER, 4, validVote(5.5)),
      player("s5", PlayerRole.MIDFIELDER, SlotType.STARTER, 5, validVote(6)),
      player("b1", PlayerRole.GOALKEEPER, SlotType.BENCH, 1, validVote(7.5)),
      player("b2", PlayerRole.DEFENDER, SlotType.BENCH, 2, validVote(6.5)),
      player("b3", PlayerRole.MIDFIELDER, SlotType.BENCH, 3, validVote(5)),
      player("b4", PlayerRole.ATTACKER, SlotType.BENCH, 4, validVote(6))
    ]
  });
  assert.equal(sameRoleSub.totalScore, 31);
  assert.equal(sameRoleSub.substitutionsCount, 1);
  assert.equal(
    sameRoleSub.detailLines.some(
      (line) => line.finalType === ScorePlayerFinalType.AUTO_SUB_IN
    ),
    true
  );

  const wrongRoleBenchSkipped = calculateTeamScore({
    lineupPlayers: [
      player("s1", PlayerRole.GOALKEEPER, SlotType.STARTER, 1, svVote()),
      player("s2", PlayerRole.DEFENDER, SlotType.STARTER, 2, validVote(6)),
      player("s3", PlayerRole.MIDFIELDER, SlotType.STARTER, 3, validVote(6)),
      player("s4", PlayerRole.ATTACKER, SlotType.STARTER, 4, validVote(6)),
      player("s5", PlayerRole.MIDFIELDER, SlotType.STARTER, 5, validVote(6)),
      player("b1", PlayerRole.DEFENDER, SlotType.BENCH, 1, validVote(7)),
      player("b2", PlayerRole.MIDFIELDER, SlotType.BENCH, 2, validVote(7)),
      player("b3", PlayerRole.ATTACKER, SlotType.BENCH, 3, validVote(7)),
      player("b4", PlayerRole.MIDFIELDER, SlotType.BENCH, 4, validVote(7))
    ]
  });
  assert.equal(wrongRoleBenchSkipped.totalScore, 24);
  assert.equal(wrongRoleBenchSkipped.substitutionsCount, 0);

  // 2 SV of the same role → only 1 sub (one bench slot per role).
  const twoSameRoleSvOnlyOneSub = calculateTeamScore({
    lineupPlayers: [
      player("s1", PlayerRole.GOALKEEPER, SlotType.STARTER, 1, validVote(6)),
      player("s2", PlayerRole.DEFENDER, SlotType.STARTER, 2, validVote(6)),
      player("s3", PlayerRole.MIDFIELDER, SlotType.STARTER, 3, svVote()),
      player("s4", PlayerRole.ATTACKER, SlotType.STARTER, 4, validVote(6)),
      player("s5", PlayerRole.MIDFIELDER, SlotType.STARTER, 5, svVote()),
      player("b1", PlayerRole.GOALKEEPER, SlotType.BENCH, 1, validVote(7)),
      player("b2", PlayerRole.DEFENDER, SlotType.BENCH, 2, validVote(6.5)),
      player("b3", PlayerRole.MIDFIELDER, SlotType.BENCH, 3, validVote(5.5)),
      player("b4", PlayerRole.ATTACKER, SlotType.BENCH, 4, validVote(6))
    ]
  });
  assert.equal(twoSameRoleSvOnlyOneSub.substitutionsCount, 1);
  assert.equal(twoSameRoleSvOnlyOneSub.totalScore, 23.5);
  assert.equal(
    twoSameRoleSvOnlyOneSub.detailLines.filter(
      (line) => line.finalType === ScorePlayerFinalType.SV_NOT_REPLACED
    ).length,
    1
  );
  assert.equal(
    twoSameRoleSvOnlyOneSub.detailLines.some(
      (line) =>
        line.playerId === "s5" &&
        line.finalType === ScorePlayerFinalType.SV_NOT_REPLACED &&
        line.scoreUsed === 0
    ),
    true
  );

  // 2 SV of different roles → 2 independent subs.
  const twoDifferentRoleSvTwoSubs = calculateTeamScore({
    lineupPlayers: [
      player("s1", PlayerRole.GOALKEEPER, SlotType.STARTER, 1, svVote()),
      player("s2", PlayerRole.DEFENDER, SlotType.STARTER, 2, svVote()),
      player("s3", PlayerRole.MIDFIELDER, SlotType.STARTER, 3, validVote(6)),
      player("s4", PlayerRole.ATTACKER, SlotType.STARTER, 4, validVote(6)),
      player("s5", PlayerRole.MIDFIELDER, SlotType.STARTER, 5, validVote(6)),
      player("b1", PlayerRole.GOALKEEPER, SlotType.BENCH, 1, validVote(7)),
      player("b2", PlayerRole.DEFENDER, SlotType.BENCH, 2, validVote(6.5)),
      player("b3", PlayerRole.MIDFIELDER, SlotType.BENCH, 3, validVote(6)),
      player("b4", PlayerRole.ATTACKER, SlotType.BENCH, 4, validVote(6))
    ]
  });
  assert.equal(twoDifferentRoleSvTwoSubs.substitutionsCount, 2);
  assert.equal(twoDifferentRoleSvTwoSubs.totalScore, 31.5);
  assert.equal(
    twoDifferentRoleSvTwoSubs.detailLines.filter(
      (line) => line.finalType === ScorePlayerFinalType.AUTO_SUB_IN
    ).length,
    2
  );
  assert.equal(
    twoDifferentRoleSvTwoSubs.detailLines.filter(
      (line) => line.finalType === ScorePlayerFinalType.SV_NOT_REPLACED
    ).length,
    0
  );

  // Scrambled bench positionOrder must not change same-role substitution.
  const orderIndependentSub = calculateTeamScore({
    lineupPlayers: [
      player("s1", PlayerRole.GOALKEEPER, SlotType.STARTER, 1, validVote(6)),
      player("s2", PlayerRole.DEFENDER, SlotType.STARTER, 2, svVote()),
      player("s3", PlayerRole.MIDFIELDER, SlotType.STARTER, 3, validVote(7)),
      player("s4", PlayerRole.ATTACKER, SlotType.STARTER, 4, validVote(5.5)),
      player("s5", PlayerRole.MIDFIELDER, SlotType.STARTER, 5, validVote(6)),
      player("b1", PlayerRole.ATTACKER, SlotType.BENCH, 1, validVote(6)),
      player("b2", PlayerRole.MIDFIELDER, SlotType.BENCH, 2, validVote(5)),
      player("b3", PlayerRole.GOALKEEPER, SlotType.BENCH, 3, validVote(7.5)),
      player("b4", PlayerRole.DEFENDER, SlotType.BENCH, 4, validVote(6.5))
    ]
  });
  assert.equal(orderIndependentSub.substitutionsCount, 1);
  assert.equal(orderIndependentSub.totalScore, 31);
  assert.equal(
    orderIndependentSub.detailLines.some(
      (line) =>
        line.finalType === ScorePlayerFinalType.AUTO_SUB_IN &&
        line.playerId === "b4"
    ),
    true
  );

  // Same-role bench present but also SV → starter stays with score 0.
  const sameRoleBenchAlsoSv = calculateTeamScore({
    lineupPlayers: [
      player("s1", PlayerRole.GOALKEEPER, SlotType.STARTER, 1, validVote(6)),
      player("s2", PlayerRole.DEFENDER, SlotType.STARTER, 2, svVote()),
      player("s3", PlayerRole.MIDFIELDER, SlotType.STARTER, 3, validVote(6)),
      player("s4", PlayerRole.ATTACKER, SlotType.STARTER, 4, validVote(6)),
      player("s5", PlayerRole.MIDFIELDER, SlotType.STARTER, 5, validVote(6)),
      player("b1", PlayerRole.GOALKEEPER, SlotType.BENCH, 1, validVote(7)),
      player("b2", PlayerRole.DEFENDER, SlotType.BENCH, 2, svVote()),
      player("b3", PlayerRole.MIDFIELDER, SlotType.BENCH, 3, validVote(6)),
      player("b4", PlayerRole.ATTACKER, SlotType.BENCH, 4, validVote(6))
    ]
  });
  assert.equal(sameRoleBenchAlsoSv.substitutionsCount, 0);
  assert.equal(sameRoleBenchAlsoSv.totalScore, 24);
  assert.equal(
    sameRoleBenchAlsoSv.detailLines.some(
      (line) =>
        line.playerId === "s2" &&
        line.finalType === ScorePlayerFinalType.SV_NOT_REPLACED &&
        line.scoreUsed === 0
    ),
    true
  );

  console.log("Manual scoring checks passed.");
}

runChecks();
