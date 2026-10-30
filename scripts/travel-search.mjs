// Dependency-injected orchestration: no DOM, persistence or provider credentials.
// All limits are search budgets, never a claim that other direct trips do not exist.
export async function searchDirectTravel({index,manifest,start,end,day,time,departureAt,loadLine,loadWalk,directTrips,assess,rank,distance,signal,active=()=>true,onProgress=()=>{},now=()=>Date.now(),budget={}}){
  const limits={radii:[800,1300,2000],lines:40,pairs:24,legs:36,stagePairs:[6,8,10],milliseconds:60000,...budget};
  const began=now(),expired=()=>now()-began>=limits.milliseconds;
  const check=()=>{if(signal?.aborted||!active())throw Error('Calcolo annullato.');};
  check();
  if(!manifest.alightingAvailable||!index.days.includes(day))return {error:'Il giorno scelto non è coperto dagli orari ATV disponibili.',rows:[],incomplete:false};
  const dayIndex=index.days.indexOf(day),supported=new Set(manifest.lines.map(line=>line.number));
  const stops=index.stops.map(stop=>({...stop,distance:distance(start,stop),numbers:stop.services.filter(([n,bits])=>supported.has(n)&&[0,1,2].some(offset=>dayIndex>=offset&&bits[dayIndex-offset]==='1')).map(([n])=>n)}));
  const assets=new Map(),failed=new Set(),walks=new Map(),visited=new Set(),verified=[],omissions=new Set();
  let pairsChecked=0,legsChecked=0,searchRadius=0,unverifiedPairs=0;
  const walk=async(from,to,key)=>{
    if(walks.has(key))return walks.get(key);
    if(expired()){omissions.add('time-budget');return null;}
    if(legsChecked>=limits.legs){omissions.add('walking-budget');return null;}
    ++legsChecked;check();
    try{const result=await loadWalk(from,to,{signal});check();walks.set(key,result);return result;}
    catch(error){check();omissions.add('walking-error');walks.set(key,null);return null;}
  };
  const result=()=>{
    const rows=rank(verified,{day,departureAt,now:now(),assess});
    // Deduplicate only AFTER actual access/egress routes and times are known.
    const unique=new Map();for(const row of rows){const key=[row.number,row.row.trip,row.row.serviceDay].join('|');if(!unique.has(key))unique.set(key,row);}
    const alternatives=[...unique.values()],row=alternatives[0],incomplete=Boolean(failed.size||omissions.size||unverifiedPairs);
    const search={radius:searchRadius,linesLoaded:assets.size,failedLines:[...failed],pairsChecked,legsChecked,unverifiedPairs,reasons:[...omissions],limits};
    return row?{row,rows:alternatives,assets:[...assets.values()],duration:Math.ceil((row.assessment.venueAt-departureAt)/1000),incomplete,search}:{rows:[],assets:[...assets.values()],incomplete,search,error:incomplete?'Ricerca parziale: alcune corse o camminate non sono state verificate. Prova la ricerca estesa.':'Nessun diretto compatibile trovato entro '+searchRadius+' m. Prova altri orari o la ricerca estesa; possono esistere viaggi con cambi.'};
  };
  for(const [stage,radius]of limits.radii.entries()){
    check();if(expired()){omissions.add('time-budget');break;}searchRadius=radius;
    const origins=stops.filter(stop=>stop.distance<=radius&&stop.numbers.length).sort((a,b)=>a.distance-b.distance||a.code.localeCompare(b.code));
    // Destination proximity only orders loading; it never excludes alighting-only stops.
    const priorities=new Map();
    for(const origin of origins)for(const n of origin.numbers)if(!priorities.has(n))priorities.set(n,Infinity);
    for(const stop of index.stops){const metres=distance(stop,end);for(const [n]of stop.services)if(priorities.has(n))priorities.set(n,Math.min(priorities.get(n),metres));}
    const numbers=[...priorities.keys()].sort((a,b)=>priorities.get(a)-priorities.get(b)||a.localeCompare(b,'it',{numeric:true})).filter(n=>!assets.has(n)&&!failed.has(n));
    const available=Math.max(0,limits.lines-assets.size-failed.size),loading=numbers.slice(0,available);
    if(loading.length<numbers.length)omissions.add('line-budget');
    let next=0;
    await Promise.all(Array.from({length:Math.min(3,loading.length)},async()=>{while(next<loading.length){check();if(expired()){omissions.add('time-budget');break;}const n=loading[next++];try{const asset=await loadLine(n);check();assets.set(n,asset);}catch(error){check();failed.add(n);}}}));
    check();if(expired()){omissions.add('time-budget');break;}
    const candidates=[];
    for(const origin of origins)for(const n of origin.numbers){
      check();if(expired()){omissions.add('time-budget');break;}
      const asset=assets.get(n);if(!asset)continue;
      // Let input, cancel and screen-reader updates run between line scans.
      await new Promise(resolve=>setTimeout(resolve,0));check();
      const rows=directTrips([asset],{origin:origin.code,point:end,day,after:time,allowOvernight:true,allTargets:true,radius,limit:Infinity});
      for(const row of rows){
        const estimate=assess({day,departure:row.row.time,arrivalDay:row.arrivalDay||day,arrival:row.arrivalTime,startSeconds:origin.distance/2,endSeconds:distance(row.arrival,end)/2,now:Math.max(now(),departureAt),margin:0});
        if(estimate.state==='compatible')candidates.push({...row,estimate});
      }
    }
    const grouped=new Map();
    for(const row of candidates){const key=row.origin.code+'|'+row.arrival.code;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(row);}
    const pending=[...grouped].filter(([key])=>!visited.has(key)).map(([key,rows])=>({key,rows,best:Math.min(...rows.map(row=>row.estimate.venueAt))})).sort((a,b)=>a.best-b.best||a.key.localeCompare(b.key));
    // Round-robin actual line/destination combinations: many nearby paline of one
    // line cannot consume the walking budget before another direction is checked.
    const groups=new Map();
    for(const pair of pending){const best=pair.rows.reduce((a,b)=>a.estimate.venueAt<=b.estimate.venueAt?a:b),key=best.number+'|'+best.row.destination;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(pair);}
    const ordered=[];while([...groups.values()].some(rows=>rows.length)){for(const rows of groups.values())if(rows.length)ordered.push(rows.shift());}
    const stageLimit=Math.min(limits.stagePairs[stage]??limits.pairs,limits.pairs-pairsChecked);
    let count=0;
    for(const pair of ordered){
      check();if(expired()){omissions.add('time-budget');break;}if(count>=stageLimit||legsChecked>=limits.legs)break;
      ++count;++pairsChecked;visited.add(pair.key);
      const sample=pair.rows[0],startWalk=await walk(start,sample.origin,'start|'+sample.origin.code),endWalk=await walk(sample.arrival,end,'end|'+sample.arrival.code);
      check();if(startWalk&&endWalk)verified.push(...pair.rows.map(row=>({...row,startWalk,endWalk})));
      onProgress({...result(),pending:true});
    }
    unverifiedPairs=ordered.filter(pair=>!visited.has(pair.key)).length;
    onProgress({...result(),pending:stage<limits.radii.length-1});
  }
  check();return result();
}
