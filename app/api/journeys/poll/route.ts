import {pollJourney} from '../../../../lib/journey-recorder';
export const dynamic='force-dynamic';
export async function POST(){if(process.env.DASHBOARD_READ_PROXY)return new Response('The NAS owns journey collection.',{status:409});return Response.json(await pollJourney(),{headers:{'Cache-Control':'no-store'}})}
