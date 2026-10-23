import {compareStopDays} from './bus-stop-extraction.mjs';

const logicalIssue=issue=>issue==='Nessun passaggio: assenza di servizio da verificare'||issue==='Campione del portale non riprodotto';
export async function collectLineStopDay({line,scan,verify}){
  const history=[];
  for(const [phase,hours]of [['baseline',8],['verification',4],['confirmation',2]]){
    const result=await scan(phase,hours);history.push(result);
    if(result.coverageIssues.some(issue=>!logicalIssue(issue)))return {status:'interrupted',halt:true,complete:false,history};
    if(history.length<2)continue;
    const comparison=compareStopDays(history.at(-2),result);
    if(!comparison.consistent)continue;
    const departures=result.departures.filter(d=>d.line===line);
    if(!departures.length)return {status:'no-line-observed',halt:false,complete:false,comparison,history,departures:[],checks:[]};
    const checks=[];
    for(const expected of departures){
      if(!/^\d+$/.test(String(expected.terminalCode??''))){checks.push({tripId:expected.tripId,status:'missing-terminal'});continue;}
      let check;try{check=await verify(expected);}catch(error){check={status:'request-error',message:error.message};}
      checks.push({tripId:expected.tripId,...check});
      if(check.httpStatus!==200)return {status:'interrupted',halt:true,complete:false,comparison,history,departures,checks};
    }
    return {status:checks.every(c=>c.status==='matched')?'observed-and-checked':'detail-mismatch',halt:false,complete:false,comparison,history,departures,checks};
  }
  return {status:'inconsistent-or-empty',halt:false,complete:false,history,departures:[],checks:[]};
}
