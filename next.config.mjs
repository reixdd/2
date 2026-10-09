/** @type {import('next').NextConfig} */
const isStatic=process.env.COLOSSEUM_STATIC_EXPORT==="1"
const nextConfig={
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
