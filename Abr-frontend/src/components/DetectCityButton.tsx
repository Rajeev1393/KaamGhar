"use client";

import { useTranslation } from "@/components/LanguageProvider";

import { LoaderCircle, MapPin, LocateFixed } from "lucide-react";
import { useState } from "react";

type Props = {
  onCity: (city: string) => void;
  compact?: boolean;
};

export default function DetectCityButton({ onCity, compact = false }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function detectCity() {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("Location is not supported by this browser. Select a city manually.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const query = new URLSearchParams({
            latitude: String(coords.latitude),
            longitude: String(coords.longitude),
          });
          const response = await fetch(`/api/location/reverse?${query}`, { cache: "no-store" });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "Could not find your city.");
          onCity(result.city);
          setMessage(`Location set to ${result.city}`);
        } catch (reason) {
          setMessage(reason instanceof Error ? reason.message : "Could not find your city.");
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Allow location access in your browser, or choose a city manually.",
          2: "Your location is unavailable. Please choose a city manually.",
          3: "Location lookup timed out. Please try again.",
        };
        setMessage(messages[error.code] || "Could not get your location.");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <span className={compact ? "location-control compact-location-control" : "location-control"}>
      <button
        className="location-button"
        type="button"
        onClick={detectCity}
        disabled={loading}
        aria-label={t("Detect my city using my device location")}
        title={t("Use device location to find your city")}
      >
        {loading ? <LoaderCircle className="spin-icon" size={15} /> : compact ? <LocateFixed size={15} /> : <MapPin size={15} />}
        <span>{loading ? t("Finding…") : compact ? t("Use my location") : t("Use current location")}</span>
      </button>
      {message && <span className="location-message" role="status">{message}</span>}
    </span>
  );
}
