-- Subscription-lifecycle functions, ported from qr-menu-dev's
-- activate_subscription / grant_trial_subscription / grant_active_subscription
-- (supabase/migrations/20260803000000, 20260902020000, 20260904000000).
--
-- Each dropped its internal `is_admin()` guard: that check existed only
-- because Supabase RLS/security-definer functions were the sole isolation
-- boundary. On this stack the admin check already happened in the calling
-- route/server action (requireAdmin(), §7.3) before any of these functions
-- is ever invoked — see specs/Hapag-SRS.md §12.11.

create function activate_subscription(
  p_subscription_id uuid,
  p_admin_id uuid,
  p_plan plan_type,
  p_starts_at timestamptz,
  p_expires_at timestamptz
)
returns subscriptions
language plpgsql
as $$
declare
  v_business_id uuid;
  v_subscription subscriptions;
begin
  update subscriptions
    set status = 'active',
        plan = p_plan,
        activated_by = p_admin_id,
        activated_at = now(),
        starts_at = p_starts_at,
        expires_at = p_expires_at
    where id = p_subscription_id
      and status = 'pending'
    returning business_id into v_business_id;

  if v_business_id is null then
    return null; -- already non-pending; caller renders the already-active state
  end if;

  update businesses set status = 'active' where id = v_business_id;

  select * into v_subscription from subscriptions where id = p_subscription_id;
  return v_subscription;
end;
$$;

-- Trial grants get their own function rather than overloading
-- activate_subscription(), which assumes an existing *pending* row created
-- by the owner's payment-proof submission (with an amount and proof URL).
-- A trial grant is admin-initiated from nothing, with no payment.
create function grant_trial_subscription(
  p_business_id uuid,
  p_admin_id uuid,
  p_expires_at timestamptz
)
returns subscriptions
language plpgsql
as $$
declare
  v_subscription subscriptions;
begin
  insert into subscriptions (
    business_id, plan, amount, status, activated_by, activated_at, starts_at, expires_at
  )
  values (
    p_business_id, 'trial', 0, 'active', p_admin_id, now(), now(), p_expires_at
  )
  returning * into v_subscription;

  update businesses set status = 'trial' where id = p_business_id;

  return v_subscription;
end;
$$;

-- Sibling to grant_trial_subscription(), same admin-override trust model
-- extended to paid plans: an admin-declared renewal with no payment proof,
-- amount, or method attached.
create function grant_active_subscription(
  p_business_id uuid,
  p_admin_id uuid,
  p_plan plan_type,
  p_expires_at timestamptz
)
returns subscriptions
language plpgsql
as $$
declare
  v_subscription subscriptions;
begin
  if p_plan = 'trial' then
    raise exception 'use grant_trial_subscription for trial grants';
  end if;

  insert into subscriptions (
    business_id, plan, amount, status, activated_by, activated_at, starts_at, expires_at
  )
  values (
    p_business_id, p_plan, 0, 'active', p_admin_id, now(), now(), p_expires_at
  )
  returning * into v_subscription;

  update businesses set status = 'active', plan = p_plan where id = p_business_id;

  return v_subscription;
end;
$$;
