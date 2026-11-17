import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("latitude"));
  const longitude = Number(request.nextUrl.searchParams.get("longitude"));
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json({ message: "Invalid location coordinates." }, { status: 400 });
  }

  const query = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "10",
    addressdetails: "1",
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`, {
      headers: {
        "User-Agent": "KaamGhar/1.0 (home services location lookup)",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json(
        { message: "Could not look up your city right now. You can select it manually." },
        { status: 502 },
      );
    }

    const result: { address?: Record<string, string> } = await response.json();
    const address = result.address;
    const city =
      address?.city ||
      address?.town ||
      address?.village ||
      address?.municipality ||
      address?.city_district ||
      address?.county;
    if (!city) {
      return NextResponse.json(
        { message: "Your city could not be identified. Please select it manually." },
        { status: 404 },
      );
    }
    return NextResponse.json({ city });
  } catch {
    return NextResponse.json(
      { message: "Location lookup is unavailable. Please select your city manually." },
      { status: 502 },
    );
  }
}
