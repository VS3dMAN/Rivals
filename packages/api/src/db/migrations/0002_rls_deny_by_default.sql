-- Enable RLS on every table with a deny-by-default policy.
-- Later migrations will add permissive policies gated on membership / admin role.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "habits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "habit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "streaks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "challenge_windows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leaderboard_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feed_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feed_reactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "badges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_badges" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all" ON "users" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "groups" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "group_memberships" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "habits" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "habit_logs" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "streaks" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "challenge_windows" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "leaderboard_scores" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "feed_events" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "feed_reactions" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "notifications" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "push_tokens" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "badges" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON "user_badges" AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);

-- Note: the API uses the Supabase service_role key which bypasses RLS.
-- Direct Supabase client access from phones/browsers must go through the API;
-- any future client-direct reads will need permissive policies added here.
