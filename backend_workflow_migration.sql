-- MyHanns Admin and Staff workflow schema (fresh MySQL 8 database)
CREATE DATABASE IF NOT EXISTS myhanns CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE myhanns;

CREATE TABLE users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  phone VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','staff','resident') NOT NULL,
  duty_status ENUM('on_duty','off_duty') NOT NULL DEFAULT 'on_duty',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE zones (id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, code VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(80) NOT NULL);
CREATE TABLE job_tags (id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, code VARCHAR(80) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL);
CREATE TABLE staff_zones (staff_id BIGINT UNSIGNED NOT NULL, zone_id TINYINT UNSIGNED NOT NULL, PRIMARY KEY(staff_id,zone_id), FOREIGN KEY(staff_id) REFERENCES users(id), FOREIGN KEY(zone_id) REFERENCES zones(id)) ENGINE=InnoDB;
CREATE TABLE staff_job_tags (staff_id BIGINT UNSIGNED NOT NULL, job_tag_id SMALLINT UNSIGNED NOT NULL, PRIMARY KEY(staff_id,job_tag_id), FOREIGN KEY(staff_id) REFERENCES users(id), FOREIGN KEY(job_tag_id) REFERENCES job_tags(id)) ENGINE=InnoDB;
CREATE TABLE categories (id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, code VARCHAR(80) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL, job_tag_id SMALLINT UNSIGNED NULL, sla_hours SMALLINT UNSIGNED NOT NULL DEFAULT 48, FOREIGN KEY(job_tag_id) REFERENCES job_tags(id)) ENGINE=InnoDB;
CREATE TABLE tickets (
 id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, ticket_no VARCHAR(40) NOT NULL UNIQUE,
 resident_id BIGINT UNSIGNED NULL, category_id SMALLINT UNSIGNED NOT NULL, zone_id TINYINT UNSIGNED NOT NULL,
 title VARCHAR(200) NOT NULL, description TEXT NULL, location_desc VARCHAR(255) NOT NULL,
 latitude DECIMAL(10,7) NULL, longitude DECIMAL(10,7) NULL, priority ENUM('Low','Normal','Urgent') NOT NULL DEFAULT 'Normal',
 status ENUM('pending','accepted','in_progress','completed','rejected','cancelled') NOT NULL DEFAULT 'pending',
 assignee_id BIGINT UNSIGNED NULL, due_at DATETIME NULL, is_public BOOLEAN NOT NULL DEFAULT FALSE,
 handoff_count SMALLINT UNSIGNED NOT NULL DEFAULT 0, admin_attention BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_ticket_status_due(status,due_at), INDEX idx_ticket_assignee(assignee_id,status),
 FOREIGN KEY(resident_id) REFERENCES users(id), FOREIGN KEY(category_id) REFERENCES categories(id), FOREIGN KEY(zone_id) REFERENCES zones(id), FOREIGN KEY(assignee_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE ticket_photos (id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, ticket_id BIGINT UNSIGNED NOT NULL, photo_kind ENUM('site','repair') NOT NULL, url VARCHAR(1024) NOT NULL, uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE ticket_offers (ticket_id BIGINT UNSIGNED NOT NULL, staff_id BIGINT UNSIGNED NOT NULL, offered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, accepted_at DATETIME NULL, PRIMARY KEY(ticket_id,staff_id), FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE, FOREIGN KEY(staff_id) REFERENCES users(id)) ENGINE=InnoDB;
CREATE TABLE work_tasks (id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, ticket_id BIGINT UNSIGNED NOT NULL, task_code VARCHAR(80) NOT NULL, label VARCHAR(160) NOT NULL, sequence_no SMALLINT UNSIGNED NOT NULL, status ENUM('queued','ready','in_progress','blocked','completed','cancelled') NOT NULL DEFAULT 'ready', assignee_id BIGINT UNSIGNED NULL, blocked_by_task_id BIGINT UNSIGNED NULL, completed_at DATETIME NULL, FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE, FOREIGN KEY(assignee_id) REFERENCES users(id), FOREIGN KEY(blocked_by_task_id) REFERENCES work_tasks(id), INDEX(ticket_id,sequence_no)) ENGINE=InnoDB;
CREATE TABLE ticket_events (id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, ticket_id BIGINT UNSIGNED NOT NULL, actor_id BIGINT UNSIGNED NULL, event_type VARCHAR(80) NOT NULL, details JSON NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE, FOREIGN KEY(actor_id) REFERENCES users(id)) ENGINE=InnoDB;
CREATE TABLE ratings (ticket_id BIGINT UNSIGNED PRIMARY KEY, stars TINYINT UNSIGNED NOT NULL CHECK(stars BETWEEN 1 AND 5), comment TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE) ENGINE=InnoDB;

-- Unassigned pool rule used by the Admin UI: ticket has no assignee OR no due date.
CREATE VIEW admin_unassigned_tickets AS SELECT t.* FROM tickets t WHERE t.assignee_id IS NULL OR t.due_at IS NULL;

INSERT INTO zones(code,name) VALUES ('A','Zone A'),('B','Zone B');
INSERT INTO job_tags(code,name) VALUES ('electrician','Electrician'),('sanitation','Sanitation'),('maintenance','Maintenance'),('noise_control','Noise Control'),('plumbing_electrical_repair','Plumbing / Electrical Repair'),('cleaner','Cleaning'),('masonry_odd_job','Masonry / Odd-job');
INSERT INTO categories(code,name,job_tag_id,sla_hours) SELECT 'lighting','Lighting',id,48 FROM job_tags WHERE code='electrician';
INSERT INTO categories(code,name,job_tag_id,sla_hours) SELECT 'garbage','Garbage Collection',id,24 FROM job_tags WHERE code='sanitation';
INSERT INTO categories(code,name,job_tag_id,sla_hours) SELECT 'facility','Public Facility',id,72 FROM job_tags WHERE code='maintenance';
INSERT INTO categories(code,name,job_tag_id,sla_hours) SELECT 'noise','Noise Disturbance',id,48 FROM job_tags WHERE code='noise_control';
INSERT INTO categories(code,name,job_tag_id,sla_hours) SELECT 'leak_plumbing_electrical','Leak / Plumbing & Electrical',id,48 FROM job_tags WHERE code='plumbing_electrical_repair';
INSERT INTO categories(code,name,job_tag_id,sla_hours) SELECT 'cleaning','Cleaning',id,24 FROM job_tags WHERE code='cleaner';
INSERT INTO categories(code,name,job_tag_id,sla_hours) SELECT 'masonry','Masonry / Odd-job',id,72 FROM job_tags WHERE code='masonry_odd_job';
INSERT INTO categories(code,name,job_tag_id,sla_hours) VALUES ('others','Others',NULL,48);
