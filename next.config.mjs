/** @type {import('next').NextConfig} */
const isStatic=process.env.COLOSSEUM_STATIC_EXPORT==="1"
const nextConfig={
 basePath:process.env.NEXT_PUBLIC_COLOSSEUM_BASE_PATH||'',
 allowedDevOrigins:['127.0.0.1'],
 agentRules:false,
 ...(process.env.COLOSSEUM_DEV_DIR?{distDir:process.env.COLOSSEUM_DEV_DIR}:{}),
 ...(isStatic?{output:"export",trailingSlash:true}:{}),
 turbopack:{root:process.cwd()},
 images:{unoptimized:true},
 ...(!isStatic?{async headers(){return [{source:"/:path*",headers:[
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
  {key:"Strict-Transport-Security",value:"max-age=63072000"},
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
 ]}]}}:{}),
}
export default nextConfig
