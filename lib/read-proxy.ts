import 'server-only';
export function readProxyHeaders():Record<string,string>{return process.env.DASHBOARD_READ_PROXY_TOKEN?{Authorization:'Bearer '+process.env.DASHBOARD_READ_PROXY_TOKEN}:{}}
