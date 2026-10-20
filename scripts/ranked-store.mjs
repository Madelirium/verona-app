// One persistent SQLite file, owned by a single game server process.
export function eloChange(a,b,score) { return Math.round(32*(score-1/(1+10**((b-a)/400)))); }
export async function openRankedStore(path) {
  const {DatabaseSync}=await import('node:sqlite');
  const db=new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS ratings(game TEXT, user_id TEXT, name TEXT NOT NULL, elo INTEGER NOT NULL DEFAULT 1000, games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(game,user_id));
    CREATE TABLE IF NOT EXISTS results(match_id TEXT PRIMARY KEY, game TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, winner INTEGER, reason TEXT NOT NULL, created_at INTEGER NOT NULL, payload TEXT NOT NULL);`);
  const profile=(game,id)=>db.prepare('SELECT name,elo,games,wins FROM ratings WHERE game=? AND user_id=?').get(game,id)||{elo:1000,games:0,wins:0};
  return {
    profile,
    leaderboard(game){return db.prepare('SELECT name,elo,games,wins FROM ratings WHERE game=? AND games>0 ORDER BY elo DESC,games DESC,user_id LIMIT 50').all(game);},
    finish({matchId,game,players,winner,reason,now}){
      db.exec('BEGIN IMMEDIATE');
      try {
        const old=db.prepare('SELECT payload FROM results WHERE match_id=?').get(matchId);
        if(old){db.exec('COMMIT');return JSON.parse(old.payload);}
        const before=players.map(p=>profile(game,p.id));
        const delta=eloChange(before[0].elo,before[1].elo,winner===null?.5:winner===0?1:0);
        const changes=players.map((p,i)=>({before:before[i].elo,after:before[i].elo+(i===0?delta:-delta),delta:i===0?delta:-delta}));
        for(const [i,p] of players.entries())db.prepare(`INSERT INTO ratings(game,user_id,name,elo,games,wins) VALUES(?,?,?,?,?,?) ON CONFLICT(game,user_id) DO UPDATE SET name=excluded.name,elo=excluded.elo,games=excluded.games,wins=excluded.wins`).run(game,p.id,p.name,changes[i].after,before[i].games+1,before[i].wins+(winner===i?1:0));
        db.prepare('INSERT INTO results VALUES(?,?,?,?,?,?,?,?)').run(matchId,game,players[0].id,players[1].id,winner,reason,now,JSON.stringify(changes));
        db.exec('COMMIT');return changes;
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    close(){db.close();}
  };
}
