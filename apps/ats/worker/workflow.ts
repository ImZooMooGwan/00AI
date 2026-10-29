export const REJECTION_DELAY_MS=10*60*1000;
export function scheduleRejection(at:string|number|Date){const t=typeof at==='object'?at.getTime():typeof at==='number'?at:Date.parse(at);return new Date(t+REJECTION_DELAY_MS).toISOString()}
export function isEmailDue(scheduledAt:string,now:string|number|Date){const t=typeof now==='object'?now.getTime():typeof now==='number'?now:Date.parse(now);return Date.parse(scheduledAt)<=t}
export function canCancelEmail(status:string){return status==='PENDING'}
