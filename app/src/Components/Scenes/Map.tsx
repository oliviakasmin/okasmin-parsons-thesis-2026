import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import mapboxgl from "mapbox-gl";
import type { ObjectGeo } from "../../hooks/useObjectGeo";
import "mapbox-gl/dist/mapbox-gl.css";

type ProjectedPoint = {
  x: number;
  y: number;
  visible: boolean;
};

type MapProps = {
  objectIds: string[];
  geoByObjectId: Map<string, ObjectGeo>;
  countryNames: string[];
  onProjectionChange: (projectionByObjectId: Map<string, ProjectedPoint>) => void;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
const DEFAULT_MAP_ZOOM = 1.25;
const DEFAULT_MAP_CENTER: [number, number] = [0, 18];
const MAX_MAP_ZOOM = DEFAULT_MAP_ZOOM + 2;

function Map({ objectIds, geoByObjectId, countryNames, onProjectionChange }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_MAP_ZOOM);
  const [isAtDefaultView, setIsAtDefaultView] = useState(true);

  const isTokenMissing = !MAPBOX_TOKEN?.trim();

  const stableObjectIds = useMemo(() => [...objectIds], [objectIds]);
  const stableCountryNames = useMemo(() => [...countryNames], [countryNames]);

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
              "line-color": "#6d6d6d",
              "line-width": 0.7,
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
              "text-size": 11,
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
      for (const objectId of stableObjectIds) {
        const geo = geoByObjectId.get(objectId);
        if (!geo) {
          nextProjectionByObjectId.set(objectId, { x: 0, y: 0, visible: false });
          continue;
        }
        const projected = map.project([geo.lon, geo.lat]);
        const visible =
          Number.isFinite(projected.x) &&
          Number.isFinite(projected.y) &&
          projected.x >= -64 &&
          projected.y >= -64 &&
          projected.x <= map.getContainer().clientWidth + 64 &&
          projected.y <= map.getContainer().clientHeight + 64;
        nextProjectionByObjectId.set(objectId, { x: projected.x, y: projected.y, visible });
      }
      onProjectionChange(nextProjectionByObjectId);
    };
    const setGrabCursor = () => {
      map.getCanvas().style.cursor = "grab";
    };
    const setGrabbingCursor = () => {
      map.getCanvas().style.cursor = "grabbing";
    };
    const syncPanAvailability = () => {
      const canPan = map.getZoom() > DEFAULT_MAP_ZOOM + 0.0001;
      if (canPan) {
        map.dragPan.enable();
        setGrabCursor();
        return;
      }
      map.dragPan.disable();
      map.getCanvas().style.cursor = "default";
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
      syncPanAvailability();
      syncControlState();
      projectAll();
    });
    map.on("move", projectAll);
    map.on("zoom", projectAll);
    map.on("zoom", syncPanAvailability);
    map.on("zoom", syncControlState);
    map.on("moveend", syncControlState);
    map.on("resize", projectAll);
    map.on("mousedown", setGrabbingCursor);
    map.on("mouseup", setGrabCursor);
    map.on("dragend", setGrabCursor);
    map.on("mouseout", setGrabCursor);

    return () => {
      map.off("move", projectAll);
      map.off("zoom", projectAll);
      map.off("zoom", syncPanAvailability);
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
  }, [geoByObjectId, isTokenMissing, onProjectionChange, stableCountryNames, stableObjectIds]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const nextProjectionByObjectId = new globalThis.Map<string, ProjectedPoint>();
    for (const objectId of stableObjectIds) {
      const geo = geoByObjectId.get(objectId);
      if (!geo) {
        nextProjectionByObjectId.set(objectId, { x: 0, y: 0, visible: false });
        continue;
      }
      const projected = map.project([geo.lon, geo.lat]);
      const visible =
        Number.isFinite(projected.x) &&
        Number.isFinite(projected.y) &&
        projected.x >= -64 &&
        projected.y >= -64 &&
        projected.x <= map.getContainer().clientWidth + 64 &&
        projected.y <= map.getContainer().clientHeight + 64;
      nextProjectionByObjectId.set(objectId, { x: projected.x, y: projected.y, visible });
    }
    onProjectionChange(nextProjectionByObjectId);
  }, [geoByObjectId, onProjectionChange, stableObjectIds]);

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
