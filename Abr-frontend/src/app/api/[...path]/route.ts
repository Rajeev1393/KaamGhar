import { NextRequest, NextResponse } from "next/server";

const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";

async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/^\/api\/?/, "");
  const destination = `${backendUrl.replace(/\/$/, "")}/api/${path}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");

  if (contentType) headers.set("content-type", contentType);
  if (cookie) headers.set("cookie", cookie);

  try {
    const upstream = await fetch(destination, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) responseHeaders.set("content-type", upstreamContentType);
    if (path === "auth/password-reset" || path === "auth/password-reset.js") {
      for (const name of ["cache-control", "content-security-policy", "referrer-policy", "x-content-type-options"]) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
    }
    if (/^admin\/professionals\/[^/]+\/documents\/[^/]+\/file$/.test(path)) {
      for (const name of ["cache-control", "content-disposition", "x-content-type-options"]) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
    }
    for (const value of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", value);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { message: "Backend API is unavailable. Start the Node.js backend and try again." },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
