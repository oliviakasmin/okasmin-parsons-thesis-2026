import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import mapboxgl from "mapbox-gl";
import {
  formatCountryDisplayLabel,
  normalizeCountryCandidate,
  type ObjectGeo
} from "../../hooks/useObjectGeo";
import "mapbox-gl/dist/mapbox-gl.css";

type ProjectedPoint = {
  x: number;
  y: number;
  visible: boolean;
  scale?: number;
};

type MapCountryResolvedPayload = {
  displayLabel: string;
  normalizedCountry: string;
};

type MapProps = {
  objectIds: string[];
  geoByObjectId: Map<string, ObjectGeo>;
  countryNames: string[];
  onProjectionChange: (projectionByObjectId: Map<string, ProjectedPoint>) => void;
  onCountryResolved: (payload: MapCountryResolvedPayload | null) => void;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const DEFAULT_MAP_ZOOM = 1.25;
const DEFAULT_MAP_CENTER: [number, number] = [0, 18];
const MAX_MAP_ZOOM = DEFAULT_MAP_ZOOM + 4;
const MAP_IMAGE_ZOOM_SCALE_STEP = 0.45;
const DUPLICATE_COORDINATE_JITTER_DEGREES = 0.75;

function imageScaleForZoom(zoom: number) {
  return 1 + Math.max(0, zoom - DEFAULT_MAP_ZOOM) * MAP_IMAGE_ZOOM_SCALE_STEP;
}

function noiseFromString(value: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function coordinateKey(geo: ObjectGeo) {
  return `${geo.lon},${geo.lat}`;
}

function jitterGeoForDuplicateCoordinate(objectId: string, geo: ObjectGeo, duplicateCount: number) {
  if (duplicateCount <= 1) return geo;
  const angle = noiseFromString(objectId, 23) * Math.PI * 2;
  const radius = Math.sqrt(noiseFromString(objectId, 71)) * DUPLICATE_COORDINATE_JITTER_DEGREES;
  return {
    lon: geo.lon + Math.cos(angle) * radius,
    lat: geo.lat + Math.abs(Math.sin(angle)) * radius
  };
}

async function reverseGeocodeCountryName(
  lng: number,
  lat: number,
  accessToken: string,
  signal: AbortSignal
): Promise<{ displayLabel: string } | null> {
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`);
  url.searchParams.set("types", "country");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { features?: { text?: string }[] };
  const feature = data.features?.[0];
  const text = String(feature?.text ?? "").trim();
  if (!text) return null;
  return { displayLabel: text };
}

function Map({
  objectIds,
  geoByObjectId,
  countryNames,
  onProjectionChange,
  onCountryResolved
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onCountryResolvedRef = useRef(onCountryResolved);
  onCountryResolvedRef.current = onCountryResolved;
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_MAP_ZOOM);
  const [isAtDefaultView, setIsAtDefaultView] = useState(true);

  const isTokenMissing = !MAPBOX_TOKEN?.trim();

  const stableObjectIds = useMemo(() => [...objectIds], [objectIds]);
  const stableCountryNames = useMemo(() => [...countryNames], [countryNames]);
  const duplicateCoordinateCountByKey = useMemo(() => {
    const counts = new globalThis.Map<string, number>();
    for (const objectId of stableObjectIds) {
      const geo = geoByObjectId.get(objectId);
      if (!geo) continue;
      const key = coordinateKey(geo);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [geoByObjectId, stableObjectIds]);

  useEffect(() => {
    if (isTokenMissing || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        sources: {
          continents: {
            type: "geojson",
            data: "/data/ne_110m_land.geojson"
          },
          mapboxStreets: {
            type: "vector",
            url: "mapbox://mapbox.mapbox-streets-v8"
          }
        },
        layers: [
          {
            id: "background-black",
            type: "background",
            paint: {
              "background-color": "#000000"
            }
          },
          {
            id: "continent-outlines",
            type: "line",
            source: "continents",
            paint: {
              "line-color": "#949494",
              "line-width": 1.05,
              "line-opacity": 0.84
            }
          },
          {
            id: "country-name-labels",
            type: "symbol",
            source: "mapboxStreets",
            "source-layer": "place_label",
            filter: [
              "all",
              ["==", ["get", "class"], "country"],
              [
                "in",
                ["downcase", ["coalesce", ["get", "name_en"], ["get", "name"]]],
                ["literal", stableCountryNames]
              ]
            ],
            layout: {
              "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]],
              "text-size": 13,
              "text-font": ["DIN Offc Pro Regular", "Arial Unicode MS Regular"],
              "text-allow-overlap": true,
              "text-ignore-placement": true
            },
            paint: {
              "text-color": "#b5b5b5",
              "text-halo-color": "#000000",
              "text-halo-width": 0.6
            }
          }
        ]
      },
      attributionControl: false,
      projection: "mercator",
      zoom: DEFAULT_MAP_ZOOM,
      minZoom: DEFAULT_MAP_ZOOM,
      maxZoom: MAX_MAP_ZOOM,
      center: DEFAULT_MAP_CENTER
    });
    mapRef.current = map;

    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    const projectAll = () => {
      const nextProjectionByObjectId = new globalThis.Map<string, ProjectedPoint>();
      const imageScale = imageScaleForZoom(map.getZoom());
      for (const objectId of stableObjectIds) {
        const geo = geoByObjectId.get(objectId);
        if (!geo) {
          nextProjectionByObjectId.set(objectId, { x: 0, y: 0, visible: false, scale: imageScale });
          continue;
        }
        const jitteredGeo = jitterGeoForDuplicateCoordinate(
          objectId,
          geo,
          duplicateCoordinateCountByKey.get(coordinateKey(geo)) ?? 1
        );
        const projected = map.project([jitteredGeo.lon, jitteredGeo.lat]);
        const visible =
          Number.isFinite(projected.x) &&
          Number.isFinite(projected.y) &&
          projected.x >= -64 &&
          projected.y >= -64 &&
          projected.x <= map.getContainer().clientWidth + 64 &&
          projected.y <= map.getContainer().clientHeight + 64;
        nextProjectionByObjectId.set(objectId, {
          x: projected.x,
          y: projected.y,
          visible,
          scale: imageScale
        });
      }
      onProjectionChange(nextProjectionByObjectId);
    };
    const setGrabCursor = () => {
      map.getCanvas().style.cursor = "grab";
    };
    const setGrabbingCursor = () => {
      map.getCanvas().style.cursor = "grabbing";
    };
    const syncControlState = () => {
      const currentZoom = map.getZoom();
      const currentCenter = map.getCenter();
      setZoomLevel(currentZoom);
      const isAtDefaultZoom = Math.abs(currentZoom - DEFAULT_MAP_ZOOM) < 0.0001;
      const isAtDefaultCenter =
        Math.abs(currentCenter.lng - DEFAULT_MAP_CENTER[0]) < 0.0001 &&
        Math.abs(currentCenter.lat - DEFAULT_MAP_CENTER[1]) < 0.0001;
      setIsAtDefaultView(isAtDefaultZoom && isAtDefaultCenter);
    };

    map.on("load", () => {
      map.setFog(undefined);
      map.dragPan.enable();
      setGrabCursor();
      syncControlState();
      projectAll();
    });

    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      const token = MAPBOX_TOKEN?.trim();
      if (!token) return;
      geocodeAbortRef.current?.abort();
      const controller = new AbortController();
      geocodeAbortRef.current = controller;
      const { lng, lat } = event.lngLat;
      void (async () => {
        try {
          const geo = await reverseGeocodeCountryName(lng, lat, token, controller.signal);
          if (controller.signal.aborted) return;
          if (!geo) {
            onCountryResolvedRef.current(null);
            return;
          }
          const normalizedCountry = normalizeCountryCandidate(geo.displayLabel);
          if (!normalizedCountry) {
            onCountryResolvedRef.current(null);
            return;
          }
          onCountryResolvedRef.current({
            displayLabel: formatCountryDisplayLabel(normalizedCountry),
            normalizedCountry
          });
        } catch (error) {
          if ((error as Error).name === "AbortError") return;
          onCountryResolvedRef.current(null);
        }
      })();
    };
    map.on("click", handleMapClick);
    map.on("move", projectAll);
    map.on("zoom", projectAll);
    map.on("zoom", syncControlState);
    map.on("moveend", syncControlState);
    map.on("resize", projectAll);
    map.on("mousedown", setGrabbingCursor);
    map.on("mouseup", setGrabCursor);
    map.on("dragend", setGrabCursor);
    map.on("mouseout", setGrabCursor);

    return () => {
      geocodeAbortRef.current?.abort();
      geocodeAbortRef.current = null;
      map.off("click", handleMapClick);
      map.off("move", projectAll);
      map.off("zoom", projectAll);
      map.off("zoom", syncControlState);
      map.off("moveend", syncControlState);
      map.off("resize", projectAll);
      map.off("mousedown", setGrabbingCursor);
      map.off("mouseup", setGrabCursor);
      map.off("dragend", setGrabCursor);
      map.off("mouseout", setGrabCursor);
      map.remove();
      mapRef.current = null;
    };
  }, [
    duplicateCoordinateCountByKey,
    geoByObjectId,
    isTokenMissing,
    onProjectionChange,
    stableCountryNames,
    stableObjectIds
  ]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const nextProjectionByObjectId = new globalThis.Map<string, ProjectedPoint>();
    const imageScale = imageScaleForZoom(map.getZoom());
    for (const objectId of stableObjectIds) {
      const geo = geoByObjectId.get(objectId);
      if (!geo) {
        nextProjectionByObjectId.set(objectId, { x: 0, y: 0, visible: false, scale: imageScale });
        continue;
      }
      const jitteredGeo = jitterGeoForDuplicateCoordinate(
        objectId,
        geo,
        duplicateCoordinateCountByKey.get(coordinateKey(geo)) ?? 1
      );
      const projected = map.project([jitteredGeo.lon, jitteredGeo.lat]);
      const visible =
        Number.isFinite(projected.x) &&
        Number.isFinite(projected.y) &&
        projected.x >= -64 &&
        projected.y >= -64 &&
        projected.x <= map.getContainer().clientWidth + 64 &&
        projected.y <= map.getContainer().clientHeight + 64;
      nextProjectionByObjectId.set(objectId, {
        x: projected.x,
        y: projected.y,
        visible,
        scale: imageScale
      });
    }
    onProjectionChange(nextProjectionByObjectId);
  }, [duplicateCoordinateCountByKey, geoByObjectId, onProjectionChange, stableObjectIds]);

  return (
    <Box sx={{ position: "absolute", inset: 0, background: "#000" }}>
      <Box ref={mapContainerRef} sx={{ position: "absolute", inset: 0 }} />
      {isTokenMissing ? (
        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", p: 2 }}>
          <Typography sx={{ color: "#888", fontSize: "0.82rem", textAlign: "center" }}>
            Missing VITE_MAPBOX_TOKEN in root .env
          </Typography>
        </Box>
      ) : null}
      <Box sx={{ position: "absolute", top: 10, right: 10, display: "grid", gap: 0.5, zIndex: 2 }}>
        <Button
          type="button"
          size="small"
          variant="outlined"
          disabled={isAtDefaultView}
          onClick={() =>
            mapRef.current?.easeTo({
              center: DEFAULT_MAP_CENTER,
              zoom: DEFAULT_MAP_ZOOM,
              duration: 450
            })
          }
          sx={{
            minWidth: 0,
            width: 30,
            height: 30,
            borderColor: "#666",
            color: "#ddd",
            p: 0,
            background: "rgba(0,0,0,0.65)",
            fontSize: "0.6rem",
            lineHeight: 1,
            "&.Mui-disabled": {
              color: "#666",
              borderColor: "#444"
            }
          }}
          title="Reset map view"
        >
          R
        </Button>
        <Button
          type="button"
          size="small"
          variant="outlined"
          disabled={zoomLevel >= MAX_MAP_ZOOM - 0.0001}
          onClick={() => mapRef.current?.zoomIn({ duration: 350 })}
          sx={{
            minWidth: 0,
            width: 30,
            height: 30,
            borderColor: "#666",
            color: "#ddd",
            p: 0,
            background: "rgba(0,0,0,0.65)",
            "&.Mui-disabled": {
              color: "#666",
              borderColor: "#444"
            }
          }}
        >
          +
        </Button>
        <Button
          type="button"
          size="small"
          variant="outlined"
          disabled={zoomLevel <= DEFAULT_MAP_ZOOM + 0.0001}
          onClick={() => mapRef.current?.zoomOut({ duration: 350 })}
          sx={{
            minWidth: 0,
            width: 30,
            height: 30,
            borderColor: "#666",
            color: "#ddd",
            p: 0,
            background: "rgba(0,0,0,0.65)",
            "&.Mui-disabled": {
              color: "#666",
              borderColor: "#444"
            }
          }}
        >
          -
        </Button>
      </Box>
    </Box>
  );
}

export default Map;
