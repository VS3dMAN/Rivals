-- Replace deny-all policies from 0002 with real policies for Phase 2 entities.
-- Reads/writes are scoped to group membership; admin writes are gated on
-- `groups.admin_user_id = auth.uid()`.
--
-- Note: the API still uses the Supabase service_role key, which bypasses RLS.
-- These policies become the primary guard once direct-client reads are enabled
-- (and act as belt-and-suspenders for any service-role code path that still
-- forgets its group_id predicate).

-- ---------- users ----------
DROP POLICY IF EXISTS "deny_all" ON "users";

CREATE POLICY "users_select_self" ON "users"
  FOR SELECT
  USING (id = auth.uid());

-- ---------- groups ----------
DROP POLICY IF EXISTS "deny_all" ON "groups";

CREATE POLICY "groups_select_member" ON "groups"
  FOR SELECT
  USING (
    id IN (
      SELECT gm.group_id FROM "group_memberships" gm
      WHERE gm.user_id = auth.uid() AND gm.left_at IS NULL
    )
  );

CREATE POLICY "groups_insert_self_admin" ON "groups"
  FOR INSERT
  WITH CHECK (admin_user_id = auth.uid());

CREATE POLICY "groups_update_admin" ON "groups"
  FOR UPDATE
  USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());

CREATE POLICY "groups_delete_admin" ON "groups"
  FOR DELETE
  USING (admin_user_id = auth.uid());

-- ---------- group_memberships ----------
DROP POLICY IF EXISTS "deny_all" ON "group_memberships";

CREATE POLICY "memberships_select_member" ON "group_memberships"
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR group_id IN (
      SELECT gm.group_id FROM "group_memberships" gm
      WHERE gm.user_id = auth.uid() AND gm.left_at IS NULL
    )
  );

CREATE POLICY "memberships_insert_admin" ON "group_memberships"
  FOR INSERT
  WITH CHECK (
    (SELECT g.admin_user_id FROM "groups" g WHERE g.id = group_id) = auth.uid()
  );

CREATE POLICY "memberships_update_admin" ON "group_memberships"
  FOR UPDATE
  USING (
    (SELECT g.admin_user_id FROM "groups" g WHERE g.id = group_id) = auth.uid()
  );

CREATE POLICY "memberships_delete_admin" ON "group_memberships"
  FOR DELETE
  USING (
    (SELECT g.admin_user_id FROM "groups" g WHERE g.id = group_id) = auth.uid()
  );

-- ---------- habits ----------
DROP POLICY IF EXISTS "deny_all" ON "habits";

CREATE POLICY "habits_select_member" ON "habits"
  FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM "group_memberships" gm
      WHERE gm.user_id = auth.uid() AND gm.left_at IS NULL
    )
  );

CREATE POLICY "habits_insert_admin" ON "habits"
  FOR INSERT
  WITH CHECK (
    (SELECT g.admin_user_id FROM "groups" g WHERE g.id = group_id) = auth.uid()
  );

CREATE POLICY "habits_update_admin" ON "habits"
  FOR UPDATE
  USING (
    (SELECT g.admin_user_id FROM "groups" g WHERE g.id = group_id) = auth.uid()
  )
  WITH CHECK (
    (SELECT g.admin_user_id FROM "groups" g WHERE g.id = group_id) = auth.uid()
  );

CREATE POLICY "habits_delete_admin" ON "habits"
  FOR DELETE
  USING (
    (SELECT g.admin_user_id FROM "groups" g WHERE g.id = group_id) = auth.uid()
  );
