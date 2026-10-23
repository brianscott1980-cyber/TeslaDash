import type {Trip} from './data';
import type {DriveSample} from './journey-recorder-model';
export type LiveJourney={trip:Trip;sample:DriveSample;driving:boolean;paused:boolean};
export type JourneyFeed={trips:Trip[];live?:LiveJourney;tracking:{status:string;message:string;updated?:string;lastSample?:string}};
