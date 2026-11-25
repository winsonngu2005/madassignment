-- MyHanns Admin/Staff workflow migration
-- Target: MySQL 8+ or MariaDB. Review against the P1 backend schema before applying.
-- Run once after taking a database backup. This extends existing users/categories/tickets;
-- it does not recreate the existing resident, ticket, rating, or status-log tables.
--
-- Existing API contract references: users, categories, tickets, ticket_status_logs.
-- Existing ID types and some column definitions are not present in this repository, so
-- these additions intentionally avoid foreign-key constraints. Add matching FKs after
-- checking the exact parent ID types in the deployed schema.

-- 1) Duty availability is stored on the existing user row for both staff and admin.
ALTER TABLE users
  ADD COLUMN duty_status ENUM('on_duty', 'off_duty') NOT NULL DEFAULT 'on_duty',
  ADD COLUMN duty_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Index helps find available staff without changing existing login or profile data.
CREATE INDEX idx_users_role_duty ON users (role, duty_status);

-- 2) Connect each service category to the matching staff job tag.
-- Null means the category is not eligible for automatic matching (for example Others).
ALTER TABLE categories
  ADD COLUMN job_tag_code VARCHAR(80) NULL;

-- Adjust these mappings to the job-tag codes used by the P1 staff records.
UPDATE categories SET job_tag_code = 'electrician' WHERE code = 'lighting';
UPDATE categories SET job_tag_code = 'sanitation' WHERE code = 'garbage';
UPDATE categories SET job_tag_code = 'maintenance' WHERE code = 'facility';
UPDATE categories SET job_tag_code = 'noise_control' WHERE code = 'noise';

-- Add the fallback category if it does not already exist. This assumes categories.code
-- and categories.name are the fields used by the existing API contract.
INSERT INTO categories (name, code, sla_hours, job_tag_code)
SELECT 'Others', 'others', 48, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'others');

CREATE INDEX idx_categories_job_tag ON categories (job_tag_code);

-- 3) Normalize staff tags and service zones for matching. Keep these as the single
-- source for routing; do not duplicate arrays in a second staff assignment table.
CREATE TABLE IF NOT EXISTS staff_job_tags (
  staff_id INT NOT NULL,
  job_tag_code VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id, job_tag_code),
  INDEX idx_staff_job_tags_code (job_tag_code, staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_service_zones (
  staff_id INT NOT NULL,
  zone_code VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id, zone_code),
  INDEX idx_staff_service_zones_zone (zone_code, staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) A row is created for each eligible staff member when a ticket is offered.
-- The ticket row remains the source of truth for the winner (assignee_id).
CREATE TABLE IF NOT EXISTS ticket_assignment_offers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  staff_id INT NOT NULL,
  offer_status ENUM('offered', 'accepted', 'not_selected', 'withdrawn') NOT NULL DEFAULT 'offered',
  offered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ticket_staff_offer (ticket_id, staff_id),
  INDEX idx_offers_staff_status (staff_id, offer_status, offered_at),
  INDEX idx_offers_ticket_status (ticket_id, offer_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) Ordered child work items implement relay, prerequisites, and blocked work.
-- Example: Plumbing completed -> Cleaning ready -> Masonry ready.
CREATE TABLE IF NOT EXISTS ticket_work_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  task_code VARCHAR(80) NOT NULL,
  task_label VARCHAR(160) NOT NULL,
  sequence_no INT NOT NULL DEFAULT 1,
  task_status ENUM('queued', 'ready', 'in_progress', 'blocked', 'completed', 'cancelled') NOT NULL DEFAULT 'ready',
  assignee_id INT NULL,
  blocked_by_task_id BIGINT UNSIGNED NULL,
  support_reason TEXT NULL,
  created_by_user_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_work_tasks_ticket_order (ticket_id, sequence_no, id),
  INDEX idx_work_tasks_assignee_status (assignee_id, task_status),
  INDEX idx_work_tasks_prerequisite (blocked_by_task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-task events preserve the work history without overloading the ticket-level
-- status log already used by the existing Admin and Resident APIs.
CREATE TABLE IF NOT EXISTS ticket_work_task_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_task_id BIGINT UNSIGNED NOT NULL,
  actor_user_id INT NULL,
  from_status VARCHAR(24) NULL,
  to_status VARCHAR(24) NOT NULL,
  note TEXT NULL,
  photo_url VARCHAR(1024) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_task_logs_task_time (work_task_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6) Keep the existing ticket status lifecycle; these fields record resident
-- acceptance/rework separately. The API can continue returning status='completed'
-- while acceptance_status='awaiting_acceptance'.
ALTER TABLE tickets
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN acceptance_status ENUM('not_ready', 'awaiting_acceptance', 'accepted', 'rework') NOT NULL DEFAULT 'not_ready',
  ADD COLUMN acceptance_due_at DATETIME NULL,
  ADD COLUMN rework_reason TEXT NULL,
  ADD COLUMN rework_count INT NOT NULL DEFAULT 0,
  ADD COLUMN handoff_count INT NOT NULL DEFAULT 0,
  ADD COLUMN admin_attention TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN admin_attention_reason VARCHAR(500) NULL,
  ADD COLUMN admin_attention_at DATETIME NULL;

CREATE INDEX idx_tickets_acceptance_due ON tickets (acceptance_status, acceptance_due_at);
CREATE INDEX idx_tickets_admin_attention ON tickets (admin_attention, status);
CREATE INDEX idx_tickets_public_pool ON tickets (is_public, status);

-- 7) Relay/support history. Every staff-to-staff support transfer increments
-- tickets.handoff_count in the same transaction. Escalate when count > 3.
CREATE TABLE IF NOT EXISTS ticket_handoffs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  from_task_id BIGINT UNSIGNED NULL,
  to_task_id BIGINT UNSIGNED NULL,
  from_staff_id INT NULL,
  to_staff_id INT NULL,
  handoff_type ENUM('relay', 'support', 'rework') NOT NULL,
  reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_handoffs_ticket_time (ticket_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Backend transaction patterns (implement in the PHP service; do not execute
-- the fragments below standalone):
--
-- A. Eligible automatic-routing candidates are staff with duty_status='on_duty',
--    a matching staff_job_tags.job_tag_code = categories.job_tag_code, and a
--    matching service zone. For category 'others', do not create offers.
--    If no candidates match, leave the ticket unassigned. For 'others' only,
--    if no admin is on duty, set tickets.is_public=1 so it appears in every pool.
--
-- B. Grab-order: offer the ticket to every eligible staff member. When a staff
--    member accepts, run one transaction and conditionally claim the ticket:
--      START TRANSACTION;
--      SELECT id, status, assignee_id FROM tickets WHERE id = ? FOR UPDATE;
--      -- Continue only when status='pending' AND (assignee_id IS NULL OR is_public=1).
--      UPDATE tickets SET assignee_id=?, is_public=0, status='accepted',
--        accepted_at=NOW(), updated_at=NOW()
--        WHERE id=? AND status='pending' AND assignee_id IS NULL;
--      -- Require ROW_COUNT()=1; otherwise return HTTP 409 (another staff won).
--      UPDATE ticket_assignment_offers SET offer_status='accepted', responded_at=NOW()
--        WHERE ticket_id=? AND staff_id=? AND offer_status='offered';
--      UPDATE ticket_assignment_offers SET offer_status='not_selected', responded_at=NOW()
--        WHERE ticket_id=? AND staff_id<>? AND offer_status='offered';
--      -- Insert the existing ticket_status_logs row in this same transaction.
--      COMMIT;
--
-- C. Completing a task activates the next queued task only after its prerequisite
--    is complete. If every non-cancelled task is completed, set the ticket's
--    existing status='completed', completed_at=NOW(), acceptance_status=
--    'awaiting_acceptance', acceptance_due_at=DATE_ADD(NOW(), INTERVAL 48 HOUR).
--
-- D. Support call: mark the caller's task 'blocked', create/activate a prerequisite
--    task for the selected job tag, link blocked_by_task_id, and insert ticket_handoffs.
--    When the prerequisite task completes, set the blocked task back to 'ready'.
--    Increment tickets.handoff_count; if it becomes > 3, set admin_attention=1 and
--    admin_attention_reason='More than three staff handoffs; admin coordination required'.
--
-- E. Resident confirmation sets acceptance_status='accepted'. Return-for-rework sets
--    acceptance_status='rework', stores rework_reason, increments rework_count,
--    sets admin_attention=1, and creates/activates an Admin-assigned rework task.
--    A scheduled backend job should close unconfirmed tickets after 48 hours:
--      UPDATE tickets SET acceptance_status='accepted'
--      WHERE acceptance_status='awaiting_acceptance'
--        AND acceptance_due_at <= NOW();
-- ---------------------------------------------------------------------------

-- Resident confirmation, automatic timeout acceptance, and rework decisions need
-- their own audit trail because the existing six-state ticket status enum is
-- intentionally left unchanged for compatibility with both current clients.
CREATE TABLE IF NOT EXISTS ticket_acceptance_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  event_type ENUM('awaiting_acceptance', 'accepted', 'auto_accepted', 'rework_requested') NOT NULL,
  actor_user_id INT NULL,
  reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_acceptance_events_ticket_time (ticket_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Additional one-to-one category/job-tag records for the relay workflow.
INSERT INTO categories (name, code, sla_hours, job_tag_code)
SELECT 'Leak / Plumbing & Electrical', 'leak_plumbing_electrical', 48, 'plumbing_electrical_repair'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'leak_plumbing_electrical');
INSERT INTO categories (name, code, sla_hours, job_tag_code)
SELECT 'Cleaning', 'cleaning', 24, 'cleaner'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'cleaning');
INSERT INTO categories (name, code, sla_hours, job_tag_code)
SELECT 'Masonry / Odd-job', 'masonry', 72, 'masonry_odd_job'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'masonry');
UPDATE categories SET job_tag_code = 'plumbing_electrical_repair' WHERE code = 'leak_plumbing_electrical';
UPDATE categories SET job_tag_code = 'cleaner' WHERE code = 'cleaning';
UPDATE categories SET job_tag_code = 'masonry_odd_job' WHERE code = 'masonry';
