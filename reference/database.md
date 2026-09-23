## Table `admin_users`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `email` | `text` |  Unique |
| `created_at` | `timestamptz` |  |

## Table `businesses`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `slug` | `text` |  Unique |
| `logo_url` | `text` |  Nullable |
| `contact_phone` | `text` |  Nullable |
| `contact_email` | `text` |  Nullable |
| `address` | `text` |  Nullable |
| `owner_id` | `uuid` |  |
| `plan` | `plan_type` |  |
| `status` | `business_status` |  |
| `created_at` | `timestamptz` |  |
| `source_language` | `source_language` |  |
| `trial_ends_at` | `timestamptz` |  Nullable |

## Table `categories`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `name` | `text` |  |
| `sort_order` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `category_id` | `uuid` |  |
| `business_id` | `uuid` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `price` | `numeric` |  |
| `photo_url` | `text` |  Nullable |
| `is_displayed` | `bool` |  |
| `is_sold_out` | `bool` |  |
| `is_best_seller` | `bool` |  |
| `sort_order` | `int4` |  |
| `created_at` | `timestamptz` |  |
| `description_source` | `description_source` |  Nullable |
| `ai_keywords` | `_text` |  Nullable |
| `ai_generated_at` | `timestamptz` |  Nullable |

## Table `subscriptions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `plan` | `plan_type` |  |
| `amount` | `numeric` |  |
| `status` | `subscription_status` |  |
| `payment_method` | `text` |  Nullable |
| `payment_proof_url` | `text` |  Nullable |
| `activated_by` | `uuid` |  Nullable |
| `activated_at` | `timestamptz` |  Nullable |
| `starts_at` | `timestamptz` |  Nullable |
| `expires_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `reminder_sent_at` | `timestamptz` |  Nullable |
| `expiry_reminder_sent_at` | `timestamptz` |  Nullable |

## Table `support_tickets`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `subject` | `text` |  |
| `message` | `text` |  |
| `status` | `ticket_status` |  |
| `created_at` | `timestamptz` |  |
| `admin_reply` | `text` |  Nullable |
| `replied_at` | `timestamptz` |  Nullable |

## Table `item_translations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `item_id` | `uuid` |  |
| `business_id` | `uuid` |  |
| `language_code` | `display_language` |  |
| `translated_description` | `text` |  Nullable |
| `source_hash` | `text` |  |
| `translated_at` | `timestamptz` |  |

## Table `category_translations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `category_id` | `uuid` |  |
| `business_id` | `uuid` |  |
| `language_code` | `display_language` |  |
| `translated_name` | `text` |  Nullable |
| `source_hash` | `text` |  |
| `translated_at` | `timestamptz` |  |

## Table `ingredients`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `name` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `item_ingredients`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `item_id` | `uuid` | Primary |
| `ingredient_id` | `uuid` | Primary |
| `business_id` | `uuid` |  |
| `created_at` | `timestamptz` |  |

## Table `ingredient_translations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `ingredient_id` | `uuid` |  |
| `business_id` | `uuid` |  |
| `language_code` | `display_language` |  |
| `translated_name` | `text` |  Nullable |
| `source_hash` | `text` |  |
| `translated_at` | `timestamptz` |  |

## Custom Types / Enums

### `plan_type`

`standard` | `pro` | `trial`

### `business_status`

`active` | `suspended` | `trial` | `pending`

### `subscription_status`

`pending` | `active` | `expired` | `cancelled`

### `ticket_status`

`open` | `in_progress` | `resolved`

### `description_source`

`ai_generated` | `manual`

### `source_language`

`en` | `fil`

### `display_language`

`en` | `ko` | `ja` | `zh`

## RLS Policies

### `categories`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read all categories` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `owners can manage own categories` | ALL | public | PERMISSIVE | `is_business_owner(business_id)` | `is_business_owner(business_id)` |
| `public can read categories of active businesses` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM businesses   WHERE ((businesses.id = categories.business_id) AND (businesses.status = ANY (ARRAY['active'::business_status, 'trial'::business_status])))))` | — |

### `businesses`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read all businesses` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `admins can update all businesses` | UPDATE | public | PERMISSIVE | `is_admin()` | `is_admin()` |
| `owners can insert own business` | INSERT | public | PERMISSIVE | — | `(owner_id = auth.uid())` |
| `owners can read own business` | SELECT | public | PERMISSIVE | `(owner_id = auth.uid())` | — |
| `owners can update own business` | UPDATE | public | PERMISSIVE | `(owner_id = auth.uid())` | `(owner_id = auth.uid())` |
| `public can read active businesses` | SELECT | public | PERMISSIVE | `(status = ANY (ARRAY['active'::business_status, 'trial'::business_status]))` | — |

### `admin_users`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read admin_users` | SELECT | public | PERMISSIVE | `is_admin()` | — |

### `items`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read all items` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `owners can manage own items` | ALL | public | PERMISSIVE | `is_business_owner(business_id)` | `is_business_owner(business_id)` |
| `public can read displayed items of active businesses` | SELECT | public | PERMISSIVE | `(is_displayed AND (EXISTS ( SELECT 1    FROM businesses   WHERE ((businesses.id = items.business_id) AND (businesses.status = ANY (ARRAY['active'::business_status, 'trial'::business_status]))))))` | — |

### `support_tickets`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read all support tickets` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `admins can update all support tickets` | UPDATE | public | PERMISSIVE | `is_admin()` | `is_admin()` |
| `owners can manage own support tickets` | ALL | public | PERMISSIVE | `is_business_owner(business_id)` | `is_business_owner(business_id)` |

### `subscriptions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read all subscriptions` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `admins can update all subscriptions` | UPDATE | public | PERMISSIVE | `is_admin()` | `is_admin()` |
| `owners can insert own subscriptions` | INSERT | public | PERMISSIVE | — | `is_business_owner(business_id)` |
| `owners can read own subscriptions` | SELECT | public | PERMISSIVE | `is_business_owner(business_id)` | — |

### `item_translations`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read all item translations` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `owners can manage own item translations` | ALL | public | PERMISSIVE | `is_business_owner(business_id)` | `is_business_owner(business_id)` |
| `public can read item translations of active businesses` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM businesses   WHERE ((businesses.id = item_translations.business_id) AND (businesses.status = ANY (ARRAY['active'::business_status, 'trial'::business_status])))))` | — |

### `category_translations`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read all category translations` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `owners can manage own category translations` | ALL | public | PERMISSIVE | `is_business_owner(business_id)` | `is_business_owner(business_id)` |
| `public can read category translations of active businesses` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM businesses   WHERE ((businesses.id = category_translations.business_id) AND (businesses.status = ANY (ARRAY['active'::business_status, 'trial'::business_status])))))` | — |

### `ingredient_translations`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read all ingredient translations` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `owners can manage own ingredient translations` | ALL | public | PERMISSIVE | `is_business_owner(business_id)` | `is_business_owner(business_id)` |
| `public can read ingredient translations of active businesses` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM businesses   WHERE ((businesses.id = ingredient_translations.business_id) AND (businesses.status = ANY (ARRAY['active'::business_status, 'trial'::business_status])))))` | — |

### `ingredients`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read all ingredients` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `owners can manage own ingredients` | ALL | public | PERMISSIVE | `is_business_owner(business_id)` | `is_business_owner(business_id)` |
| `public can read ingredients of active businesses` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM businesses   WHERE ((businesses.id = ingredients.business_id) AND (businesses.status = ANY (ARRAY['active'::business_status, 'trial'::business_status])))))` | — |

### `item_ingredients`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `admins can read all item ingredients` | SELECT | public | PERMISSIVE | `is_admin()` | — |
| `owners can manage own item ingredients` | ALL | public | PERMISSIVE | `is_business_owner(business_id)` | `is_business_owner(business_id)` |
| `public can read item ingredients of displayed items of active b` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM (items      JOIN businesses ON ((businesses.id = items.business_id)))   WHERE ((items.id = item_ingredients.item_id) AND items.is_displayed AND (businesses.status = ANY (ARRAY['active'::business_status, 'trial'::business_status])))))` | — |

