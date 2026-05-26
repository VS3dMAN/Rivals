import { schema, type Db } from '../../db/client';

const LAUNCH_BADGES = [
  { code: 'first_proof', title: 'First Proof', description: 'Submit your first proof photo' },
  { code: 'streak_7', title: 'Week Warrior', description: 'Maintain a 7-day streak' },
  { code: 'streak_14', title: 'Two Week Titan', description: 'Maintain a 14-day streak' },
  { code: 'streak_30', title: 'Monthly Master', description: 'Maintain a 30-day streak' },
  { code: 'streak_90', title: 'Quarter Champion', description: 'Maintain a 90-day streak' },
  { code: 'total_100', title: 'Century Club', description: 'Complete 100 total logs' },
  { code: 'total_500', title: 'High Five Hundred', description: 'Complete 500 total logs' },
  { code: 'window_winner', title: 'Challenge Champion', description: 'Win a challenge window' },
  { code: 'early_bird', title: 'Early Bird', description: 'Complete a habit before 7am' },
  { code: 'group_founder', title: 'Group Founder', description: 'Create your first group' },
];

export async function seedBadges(db: Db): Promise<void> {
  for (const badge of LAUNCH_BADGES) {
    await db
      .insert(schema.badges)
      .values(badge)
      .onConflictDoNothing();
  }
  console.log(`[seed] Seeded ${LAUNCH_BADGES.length} badges`);
}

export { LAUNCH_BADGES };
