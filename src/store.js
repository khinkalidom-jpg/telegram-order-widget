import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseCart } from './cart.js';
export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=2000;
      CREATE TABLE IF NOT EXISTS catalogs(chat TEXT NOT NULL, message INTEGER NOT NULL, owner TEXT NOT NULL, PRIMARY KEY(chat,message));
      CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, chat TEXT NOT NULL, message INTEGER NOT NULL, owner TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(chat,message));
      CREATE TABLE IF NOT EXISTS jobs(order_id INTEGER NOT NULL, kind TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(order_id,kind));
      CREATE TABLE IF NOT EXISTS order_status(order_id INTEGER PRIMARY KEY,status TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    if(!this.db.prepare('PRAGMA table_info(jobs)').all().some(c=>c.name==='last_error'))this.db.exec("ALTER TABLE jobs ADD COLUMN last_error TEXT NOT NULL DEFAULT ''");
  }
  register(chat, message, owner) { this.db.prepare('INSERT INTO catalogs VALUES(?,?,?)').run(String(chat), message, String(owner)); }
  place(chat, message, owner, payload) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const catalog = this.db.prepare('SELECT * FROM catalogs WHERE chat=? AND message=?').get(String(chat), message);
      if (!catalog || catalog.owner !== String(owner)) throw new Error('This catalog belongs to another customer.');
      let order = this.db.prepare('SELECT * FROM orders WHERE chat=? AND message=?').get(String(chat), message);
      if (!order) {
        const body = JSON.stringify(parseCart(payload, this.db.prepare("SELECT name FROM sqlite_master WHERE name='products'").get() ? this.db.prepare('SELECT * FROM products').all() : undefined));
        const { lastInsertRowid } = this.db.prepare('INSERT INTO orders(chat,message,owner,body) VALUES(?,?,?,?)').run(String(chat), message, String(owner), body);
        for (const kind of ['widget', 'admin']) this.db.prepare('INSERT INTO jobs(order_id,kind) VALUES(?,?)').run(lastInsertRowid, kind);
        order = this.db.prepare('SELECT * FROM orders WHERE id=?').get(lastInsertRowid);
      }
      this.db.exec('COMMIT');
      return { ...order, ...JSON.parse(order.body) };
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  due() { return this.db.prepare('SELECT j.*,o.chat,o.message,o.owner,o.body FROM jobs j JOIN orders o ON o.id=j.order_id WHERE done=0 AND next_at<=? ORDER BY next_at LIMIT 10').all(Date.now()); }
  done(job) { this.db.prepare('UPDATE jobs SET done=1 WHERE order_id=? AND kind=?').run(job.order_id, job.kind); }
  retry(job, delay, reason='') { this.db.prepare('UPDATE jobs SET attempts=attempts+1,next_at=?,last_error=? WHERE order_id=? AND kind=?').run(Date.now() + delay, reason, job.order_id, job.kind); }
  offset(value) {
    if (value !== undefined) this.db.prepare("INSERT INTO metadata VALUES('offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(value));
    return Number(this.db.prepare("SELECT value FROM metadata WHERE key='offset'").get()?.value || 0);
  }
  close() { this.db.close(); }
}
