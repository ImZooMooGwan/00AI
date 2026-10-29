from pathlib import Path
import sqlite3
schema=Path(__file__).resolve().parents[1]/'migrations/0001_init.sql'
db=sqlite3.connect(':memory:')
db.executescript(schema.read_text())
now='2026-10-29T10:00:00.000Z'
db.execute('INSERT INTO candidates(id,name,email,created_at,updated_at) VALUES(?,?,?,?,?)',('c1','테스트 지원자','test@example.invalid',now,now))
db.execute("INSERT INTO applications(id,candidate_id,role,stage,applied_at,version,updated_at) VALUES(?,?,?,?,?,?,?)",('a1','c1','Engineer','DOCUMENT',now,1,now))
def move(from_stage,to_stage,version,event_id,schedule_id=None):
    t=f'2026-10-29T10:{version:02d}:00.000Z'
    with db:
        db.execute('UPDATE applications SET stage=?,version=?,updated_at=? WHERE id=? AND version=?',(to_stage,version,t,'a1',version-1))
        db.execute('''INSERT INTO stage_events(id,application_id,from_stage,to_stage,actor,version,created_at)
          SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM applications WHERE id=? AND version=? AND stage=?)
          AND NOT EXISTS(SELECT 1 FROM stage_events WHERE application_id=? AND version=?)''',
          (event_id,'a1',from_stage,to_stage,'tester',version,t,'a1',version,to_stage,'a1',version))
        db.execute("UPDATE email_schedules SET status='CANCELLED',cancelled_at=?,updated_at=? WHERE application_id=? AND status='PENDING' AND EXISTS(SELECT 1 FROM stage_events WHERE id=? AND version=?)",(t,t,'a1',event_id,version))
        if to_stage=='REJECTED':
            db.execute("INSERT INTO email_schedules(id,application_id,event_id,version,template_version,recipient_email,scheduled_at,status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,'PENDING',?,? WHERE EXISTS(SELECT 1 FROM stage_events WHERE id=?)",(schedule_id,'a1',event_id,version,1,'test@example.invalid','2026-10-29T10:10:00.000Z',t,t,event_id))
    assert db.execute('SELECT stage,version FROM applications WHERE id=?',('a1',)).fetchone()==(to_stage,version)
    assert db.execute('SELECT count(*) FROM stage_events WHERE id=?',(event_id,)).fetchone()[0]==1
move('DOCUMENT','REJECTED',2,'e1','s1')
move('REJECTED','FIRST_INTERVIEW',3,'e2')
move('FIRST_INTERVIEW','REJECTED',4,'e3','s2')
assert db.execute('SELECT id,status FROM email_schedules ORDER BY id').fetchall()==[('s1','CANCELLED'),('s2','PENDING')]
# An outdated competing request cannot add a second event for the same version.
db.execute('''INSERT INTO stage_events(id,application_id,from_stage,to_stage,actor,version,created_at)
 SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM applications WHERE id=? AND version=? AND stage=?)
 AND NOT EXISTS(SELECT 1 FROM stage_events WHERE application_id=? AND version=?)''',('race','a1','FIRST_INTERVIEW','REJECTED','tester',4,now,'a1',4,'REJECTED','a1',4))
assert db.execute('SELECT count(*) FROM stage_events WHERE application_id=? AND version=4',('a1',)).fetchone()[0]==1
print('SQLite schema and transition/schedule scenarios passed')
