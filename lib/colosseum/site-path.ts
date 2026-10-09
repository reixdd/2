/** Root hosting by default; a build-time prefix supports GitHub project Pages. */
export const SITE_BASE_PATH=process.env.NEXT_PUBLIC_COLOSSEUM_BASE_PATH||''
export function sitePath(value:string){return value.startsWith('/')&&!value.startsWith('//')?`${SITE_BASE_PATH}${value}`:value}
