type AttemptRow = {
  id: string;
  accuracy: number | string;
  weak_skills: string[] | null;
};

export function buildStudentAnalytics(attempts: AttemptRow[]) {
  const totalAttempts = attempts.length;

  const averageAccuracy =
    totalAttempts > 0
      ? attempts.reduce((sum, attempt) => sum + Number(attempt.accuracy), 0) /
        totalAttempts
      : 0;

  const weakSkillMap = new Map<
    string,
    {
      wrongCount: number;
      attemptsAffected: number;
    }
  >();

  for (const attempt of attempts) {
    const weakSkills = Array.isArray(attempt.weak_skills)
      ? attempt.weak_skills
      : [];

    for (const skill of weakSkills) {
      const current = weakSkillMap.get(skill) ?? {
        wrongCount: 0,
        attemptsAffected: 0,
      };

      current.wrongCount += 1;
      current.attemptsAffected += 1;

      weakSkillMap.set(skill, current);
    }
  }

  const weakSkills = Array.from(weakSkillMap.entries())
    .map(([skill, stats]) => ({
      skill,
      wrongCount: stats.wrongCount,
      attemptsAffected: stats.attemptsAffected,
      frequency:
        totalAttempts > 0 ? stats.attemptsAffected / totalAttempts : 0,
    }))
    .sort((a, b) => {
      if (b.wrongCount !== a.wrongCount) {
        return b.wrongCount - a.wrongCount;
      }

      return b.frequency - a.frequency;
    });

  const focusAreas = weakSkills
    .filter((item) => item.frequency >= 0.3 || item.wrongCount >= 2)
    .slice(0, 3)
    .map((item) => item.skill);

  return {
    totalAttempts,
    averageAccuracy,
    weakSkills,
    focusAreas,
  };
}
