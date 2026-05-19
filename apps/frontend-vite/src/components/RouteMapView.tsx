import { useTheme } from "@/contexts/theme/useTheme";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface RouteMapViewProps {
  locationPoints: Array<{ latitude: number; longitude: number }>;
  className?: string;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

export function RouteMapView({ locationPoints, className }: RouteMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { effectiveThemeMode } = useTheme();

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN || locationPoints.length < 2)
      return;

    const coords = locationPoints.map(
      (p) => [p.longitude, p.latitude] as [number, number]
    );

    const bounds = coords.reduce(
      (b, coord) => b.extend(coord),
      new mapboxgl.LngLatBounds(coords[0], coords[0])
    );

    const style =
      effectiveThemeMode === "dark"
        ? "mapbox://styles/mapbox/dark-v11"
        : "mapbox://styles/mapbox/light-v11";

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style,
      bounds,
      fitBoundsOptions: { padding: 40 },
      interactive: false,
      accessToken: MAPBOX_TOKEN,
    });

    map.current.on("load", () => {
      if (!map.current) return;

      map.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
        },
      });

      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#3b82f6",
          "line-width": 4,
        },
      });

      // Start marker
      new mapboxgl.Marker({ color: "#22c55e" })
        .setLngLat(coords[0])
        .addTo(map.current!);

      // End marker
      new mapboxgl.Marker({ color: "#ef4444" })
        .setLngLat(coords[coords.length - 1])
        .addTo(map.current!);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [locationPoints, effectiveThemeMode]);

  if (!MAPBOX_TOKEN || locationPoints.length < 2) return null;

  return (
    <div
      ref={mapContainer}
      className={className ?? "w-full h-48 rounded-lg overflow-hidden"}
    />
  );
}
