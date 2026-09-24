import { useCallback, useEffect, useRef, useState } from "react";
import type { Coordinates } from "./location";

// C-005: browser geolocation, requested only when the user presses the button (never on page load).
// Coordinates stay in memory; they are never logged, put in the URL or written to storage.

export type GeolocationState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "success"; coords: Coordinates }
  | { status: "denied" | "timeout" | "unavailable" | "unsupported"; message: string };

const TIMEOUT_MS = 15_000;

const failureMessages = {
  denied: "您未允許瀏覽器提供位置。可以改選縣市與行政區，或選擇不提供位置，仍可完成評估。",
  timeout: "取得位置逾時。可以再試一次，或改選縣市與行政區、不提供位置，仍可完成評估。",
  unavailable: "目前無法取得位置。可以改選縣市與行政區，或選擇不提供位置，仍可完成評估。",
  unsupported: "這個瀏覽器或連線方式不支援定位。請改選縣市與行政區，或選擇不提供位置。",
} as const;

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: "idle" });
  const requestId = useRef(0);

  useEffect(() => () => {
    // Ignore a position that arrives after the page is gone.
    requestId.current += 1;
  }, []);

  const request = useCallback(() => {
    const geolocation = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geolocation || !globalThis.isSecureContext) {
      setState({ status: "unsupported", message: failureMessages.unsupported });
      return;
    }
    const id = ++requestId.current;
    setState({ status: "requesting" });
    geolocation.getCurrentPosition(
      (position) => {
        if (id !== requestId.current) return;
        setState({ status: "success", coords: { lat: position.coords.latitude, lng: position.coords.longitude } });
      },
      (error) => {
        if (id !== requestId.current) return;
        const status = error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.TIMEOUT ? "timeout" : "unavailable";
        setState({ status, message: failureMessages[status] });
      },
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 0 },
    );
  }, []);

  const clear = useCallback(() => {
    requestId.current += 1;
    setState({ status: "idle" });
  }, []);

  return { state, request, clear };
}
