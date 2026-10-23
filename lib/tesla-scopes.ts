// Access-token claims are permission hints, not proof of identity. Tesla must
// validate the token on the vehicle endpoint before any credentials are saved.
export function teslaTokenScopes(token:string):string[]{
 try{
  const parts=token.split('.');if(parts.length!==3)return [];
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  const value=claims.scp??claims.scope;
  const scopes=typeof value==='string'?value.split(/\s+/):Array.isArray(value)?value:[];
  return [...new Set(scopes.filter((scope:unknown):scope is string=>typeof scope==='string'&&/^[a-z_]+$/.test(scope)))];
 }catch{return [];}
}

// A stale TESLA_SCOPES setting must not silently omit GPS on reconnection.
export const journeyScopes='openid offline_access vehicle_device_data vehicle_location';
