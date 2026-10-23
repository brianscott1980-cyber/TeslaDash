import type {Trip} from './data';
import type {DriveSample} from './journey-recorder-model';
export type LiveJourney={trip:Trip;sample:DriveSample;driving:boolean;paused:boolean};
export type JourneyFeed={trips:Trip[];live?:LiveJourney;tracking:{status:string;message:string;updated?:string;lastSample?:string}};
export function drivingJourneyKey(feed:JourneyFeed|null,now=Date.now()){
 const live=feed?.live;if(!live?.driving)return null;const age=now-Date.parse(live.sample.time);
 if(!Number.isFinite(age)||age< -30000||age>150000)return null;
 return live.trip.id??live.trip.start??'current-drive';
}
