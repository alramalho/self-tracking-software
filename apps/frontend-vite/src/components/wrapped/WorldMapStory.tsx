import { useTheme } from "@/contexts/theme/useTheme";
import { timezoneToCountryCode, getCountryName } from "@/lib/timezoneToCountry";
import { type ActivityEntry } from "@tsw/prisma";
import { motion } from "framer-motion";
import React, { useMemo, useState, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO numeric to alpha-2 mapping for the countries we support
const ISO_NUMERIC_TO_ALPHA2: Record<string, string> = {
  "004": "AF", "784": "AE", "032": "AR", "016": "AS", "040": "AT",
  "036": "AU", "031": "AZ", "050": "BD", "056": "BE", "100": "BG",
  "048": "BH", "076": "BR", "112": "BY", "124": "CA", "756": "CH",
  "384": "CI", "152": "CL", "156": "CN", "170": "CO", "192": "CU",
  "196": "CY", "203": "CZ", "276": "DE", "208": "DK", "012": "DZ",
  "233": "EE", "818": "EG", "724": "ES", "231": "ET", "246": "FI",
  "242": "FJ", "250": "FR", "826": "GB", "288": "GH", "300": "GR",
  "316": "GU", "344": "HK", "191": "HR", "348": "HU", "360": "ID",
  "372": "IE", "376": "IL", "356": "IN", "368": "IQ", "364": "IR",
  "352": "IS", "380": "IT", "400": "JO", "392": "JP", "404": "KE",
  "410": "KR", "414": "KW", "398": "KZ", "422": "LB", "144": "LK",
  "440": "LT", "442": "LU", "428": "LV", "504": "MA", "492": "MC",
  "104": "MM", "470": "MT", "462": "MV", "480": "MU", "484": "MX",
  "458": "MY", "540": "NC", "566": "NG", "528": "NL", "578": "NO",
  "524": "NP", "554": "NZ", "512": "OM", "591": "PA", "604": "PE",
  "258": "PF", "598": "PG", "608": "PH", "586": "PK", "616": "PL",
  "620": "PT", "634": "QA", "642": "RO", "688": "RS", "643": "RU",
  "682": "SA", "752": "SE", "702": "SG", "705": "SI", "703": "SK",
  "760": "SY", "764": "TH", "788": "TN", "792": "TR", "158": "TW",
  "804": "UA", "840": "US", "862": "VE", "704": "VN", "710": "ZA",
};

interface WorldMapStoryProps {
  year: number;
  activityEntries: ActivityEntry[];
}

interface CountryData {
  countryCode: string;
  countryName: string;
  count: number;
}

// Convert ISO country code to flag emoji
const countryCodeToFlag = (code: string): string => {
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const WorldMapStoryComponent: React.FC<WorldMapStoryProps> = ({
  year,
  activityEntries,
}) => {
  const { isLightMode } = useTheme();
  const [tooltipContent, setTooltipContent] = useState<CountryData | null>(null);
  const [position, setPosition] = useState({ coordinates: [0, 20] as [number, number], zoom: 1 });

  const countryData = useMemo(() => {
    const yearEntries = activityEntries.filter(
      (e) => new Date(e.datetime).getFullYear() === year
    );

    const countryCounts = new Map<string, number>();

    yearEntries.forEach((entry) => {
      const countryCode = timezoneToCountryCode(entry.timezone);
      if (countryCode) {
        countryCounts.set(countryCode, (countryCounts.get(countryCode) || 0) + 1);
      }
    });

    const data: CountryData[] = Array.from(countryCounts.entries())
      .map(([countryCode, count]) => ({
        countryCode,
        countryName: getCountryName(countryCode),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const maxCount = Math.max(...data.map((d) => d.count), 1);

    return { data, maxCount, countryCounts };
  }, [activityEntries, year]);

  const getCountryColor = (countryCode: string): string => {
    const count = countryData.countryCounts.get(countryCode);
    if (!count) {
      return isLightMode ? "#e5e7eb" : "#374151";
    }

    const intensity = Math.min(count / countryData.maxCount, 1);

    if (isLightMode) {
      // Light mode: violet scale
      const lightness = 90 - intensity * 50;
      return `hsl(270, 70%, ${lightness}%)`;
    } else {
      // Dark mode: violet scale
      const lightness = 20 + intensity * 40;
      return `hsl(270, 70%, ${lightness}%)`;
    }
  };

  const handleMoveEnd = (position: { coordinates: [number, number]; zoom: number }) => {
    setPosition(position);
  };

  const totalCountries = countryData.data.length;
  const totalEntriesWithLocation = countryData.data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div
      className={`h-full flex flex-col ${
        isLightMode
          ? "bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500"
          : "bg-gradient-to-br from-violet-900 via-purple-900 to-fuchsia-950"
      }`}
    >
      {/* Header */}
      <div className="p-6 pt-12 shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🌍</span>
            <h2 className="text-3xl font-bold text-white">Your World</h2>
          </div>
          <p className="text-white/70 text-sm">
            Where you tracked activities in {year}
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex gap-4 mt-4"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white">
            <span className="text-2xl font-bold">{totalCountries}</span>
            <span className="text-sm opacity-80">
              {totalCountries === 1 ? "country" : "countries"}
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/70">
            <span className="font-semibold">{totalEntriesWithLocation}</span>
            <span className="text-sm">entries</span>
          </div>
        </motion.div>

        {/* Country flags */}
        {countryData.data.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-wrap gap-2 mt-3"
          >
            {countryData.data.map((item) => (
              <span key={item.countryCode} className="text-2xl" title={item.countryName}>
                {countryCodeToFlag(item.countryCode)}
              </span>
            ))}
          </motion.div>
        )}
      </div>

      {/* Map */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex-1 min-h-0 relative mx-4 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-sm"
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 140,
            center: [0, 20],
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup
            zoom={position.zoom}
            center={position.coordinates}
            onMoveEnd={handleMoveEnd}
            minZoom={1}
            maxZoom={8}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const isoNumeric = geo.id;
                  const alpha2 = ISO_NUMERIC_TO_ALPHA2[isoNumeric];
                  const data = alpha2
                    ? countryData.data.find((d) => d.countryCode === alpha2)
                    : null;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={alpha2 ? getCountryColor(alpha2) : (isLightMode ? "#e5e7eb" : "#374151")}
                      stroke={isLightMode ? "#fff" : "#1f2937"}
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: {
                          fill: data ? (isLightMode ? "#8b5cf6" : "#a78bfa") : (isLightMode ? "#d1d5db" : "#4b5563"),
                          outline: "none",
                          cursor: data ? "pointer" : "default",
                        },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={() => {
                        if (data) {
                          setTooltipContent(data);
                        }
                      }}
                      onMouseLeave={() => {
                        setTooltipContent(null);
                      }}
                      onClick={() => {
                        if (data) {
                          setTooltipContent(data);
                        }
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {tooltipContent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 backdrop-blur-sm rounded-xl text-white text-center"
          >
            <div className="font-semibold">{tooltipContent.countryName}</div>
            <div className="text-sm text-white/70">
              {tooltipContent.count} {tooltipContent.count === 1 ? "activity" : "activities"}
            </div>
          </motion.div>
        )}

        {/* Zoom hint */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/40 backdrop-blur-sm rounded-lg text-white/60 text-xs">
          Pinch to zoom
        </div>
      </motion.div>

      {/* Top countries list */}
      {countryData.data.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="shrink-0 px-4 py-4"
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <h3 className="text-white/80 text-sm font-medium mb-3">Top locations</h3>
            <div className="space-y-2">
              {countryData.data.slice(0, 5).map((item, idx) => (
                <div
                  key={item.countryCode}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-sm w-4">{idx + 1}.</span>
                    <span className="text-white">{item.countryName}</span>
                  </div>
                  <span className="text-white/70 text-sm">
                    {item.count} {item.count === 1 ? "entry" : "entries"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export const WorldMapStory = memo(WorldMapStoryComponent);
export default WorldMapStory;
