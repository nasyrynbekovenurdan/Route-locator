import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons in React
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Location {
  lat: number;
  lng: number;
  displayName: string;
}

interface RouteInfo {
  distance: number;
  duration: number;
  coordinates: [number, number][];
}

// Custom hook to handle map view changes
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  if (center) {
    map.setView(center, zoom);
  }
  return null;
}

// Geocode address using Nominatim API
async function geocodeAddress(address: string): Promise<Location | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=us&limit=1`
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Get route using OSRM API
async function getRoute(start: Location, end: Location): Promise<RouteInfo | null> {
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
    );
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distance: route.distance, // meters
        duration: route.duration, // seconds
        coordinates: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]),
      };
    }
    return null;
  } catch (error) {
    console.error('Routing error:', error);
    return null;
  }
}

// Format distance for display
function formatDistance(meters: number): string {
  if (meters >= 1609.34) {
    return `${(meters / 1609.34).toFixed(1)} miles`;
  }
  return `${(meters / 0.3048).toFixed(0)} feet`;
}

// Format duration for display
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Custom marker icons
const startIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const endIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function App() {
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [startLocation, setStartLocation] = useState<Location | null>(null);
  const [endLocation, setEndLocation] = useState<Location | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795]); // Center of USA
  const [mapZoom, setMapZoom] = useState(4);

  const handleFindRoute = useCallback(async () => {
    if (!startAddress.trim() || !endAddress.trim()) {
      setError('Please enter both starting point and destination');
      return;
    }

    setLoading(true);
    setError('');
    setRoute(null);

    try {
      // Geocode both addresses
      const [start, end] = await Promise.all([
        geocodeAddress(startAddress),
        geocodeAddress(endAddress),
      ]);

      if (!start) {
        setError(`Could not find starting location: "${startAddress}"`);
        setLoading(false);
        return;
      }

      if (!end) {
        setError(`Could not find destination: "${endAddress}"`);
        setLoading(false);
        return;
      }

      setStartLocation(start);
      setEndLocation(end);

      // Get route
      const routeData = await getRoute(start, end);
      if (!routeData) {
        setError('Could not calculate route. Please try different locations.');
        setLoading(false);
        return;
      }

      setRoute(routeData);

      // Center map on route
      const midLat = (start.lat + end.lat) / 2;
      const midLng = (start.lng + end.lng) / 2;
      setMapCenter([midLat, midLng]);
      setMapZoom(6);
    } catch (err) {
      setError('An error occurred while finding the route. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [startAddress, endAddress]);

  const handleClear = () => {
    setStartAddress('');
    setEndAddress('');
    setStartLocation(null);
    setEndLocation(null);
    setRoute(null);
    setError('');
    setMapCenter([39.8283, -98.5795]);
    setMapZoom(4);
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setStartAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        },
        () => {
          setError('Could not access your location. Please enter address manually.');
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  };

  // Popular USA destinations for quick selection
  const popularDestinations = [
    { name: 'New York, NY', address: 'New York, NY' },
    { name: 'Los Angeles, CA', address: 'Los Angeles, CA' },
    { name: 'Chicago, IL', address: 'Chicago, IL' },
    { name: 'Houston, TX', address: 'Houston, TX' },
    { name: 'Miami, FL', address: 'Miami, FL' },
    { name: 'San Francisco, CA', address: 'San Francisco, CA' },
    { name: 'Seattle, WA', address: 'Seattle, WA' },
    { name: 'Boston, MA', address: 'Boston, MA' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-indigo-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <div>
              <h1 className="text-2xl font-bold">USA Route Locator</h1>
              <p className="text-indigo-200 text-sm">Find the best way from Point A to Point B</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Search Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Enter Locations
              </h2>

              {/* Start Location */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">A</span>
                    Starting Point
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={startAddress}
                    onChange={(e) => setStartAddress(e.target.value)}
                    placeholder="Enter address or city"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  />
                  <button
                    onClick={handleUseMyLocation}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                    title="Use my current location"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* End Location */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold">B</span>
                    Destination
                  </span>
                </label>
                <input
                  type="text"
                  value={endAddress}
                  onChange={(e) => setEndAddress(e.target.value)}
                  placeholder="Enter address or city"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={handleFindRoute}
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Finding Route...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Find Route
                    </>
                  )}
                </button>
                <button
                  onClick={handleClear}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition"
                >
                  Clear
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                </div>
              )}

              {/* Route Info */}
              {route && startLocation && endLocation && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-indigo-900 mb-3">Route Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-600">{formatDistance(route.distance)}</div>
                      <div className="text-sm text-gray-600">Distance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-600">{formatDuration(route.duration)}</div>
                      <div className="text-sm text-gray-600">Est. Time</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Popular Destinations */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Select Destination</h3>
                <div className="flex flex-wrap gap-2">
                  {popularDestinations.map((dest) => (
                    <button
                      key={dest.name}
                      onClick={() => setEndAddress(dest.address)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-indigo-100 text-gray-700 hover:text-indigo-700 text-sm rounded-full transition"
                    >
                      {dest.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">How to Use</h2>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  Enter your starting location in field A
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  Enter your destination in field B
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  Click "Find Route" to see the best path
                </li>
              </ol>
            </div>
          </div>

          {/* Map Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden h-full min-h-[500px]">
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                className="map-container"
                scrollWheelZoom={true}
              >
                <MapController center={mapCenter} zoom={mapZoom} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Start Marker */}
                {startLocation && (
                  <Marker position={[startLocation.lat, startLocation.lng]} icon={startIcon}>
                    <Popup>
                      <div className="font-semibold text-green-700">Starting Point (A)</div>
                      <div className="text-sm">{startLocation.displayName}</div>
                    </Popup>
                  </Marker>
                )}

                {/* End Marker */}
                {endLocation && (
                  <Marker position={[endLocation.lat, endLocation.lng]} icon={endIcon}>
                    <Popup>
                      <div className="font-semibold text-red-700">Destination (B)</div>
                      <div className="text-sm">{endLocation.displayName}</div>
                    </Popup>
                  </Marker>
                )}

                {/* Route Line */}
                {route && route.coordinates.length > 0 && (
                  <Polyline
                    positions={route.coordinates}
                    pathOptions={{
                      color: '#4F46E5',
                      weight: 5,
                      opacity: 0.8,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                )}
              </MapContainer>
            </div>

            {/* Location Details */}
            {(startLocation || endLocation) && (
              <div className="bg-white rounded-xl shadow-lg p-6 mt-4">
                <h3 className="font-semibold text-gray-800 mb-4">Location Details</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {startLocation && (
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <span className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">A</span>
                      <div>
                        <div className="font-medium text-green-800">Starting Point</div>
                        <div className="text-sm text-gray-600">{startLocation.displayName}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {startLocation.lat.toFixed(4)}, {startLocation.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  )}
                  {endLocation && (
                    <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                      <span className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">B</span>
                      <div>
                        <div className="font-medium text-red-800">Destination</div>
                        <div className="text-sm text-gray-600">{endLocation.displayName}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {endLocation.lat.toFixed(4)}, {endLocation.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm">
            <p>Powered by OpenStreetMap & OSRM Routing</p>
            <p className="mt-1 text-gray-500">Data © OpenStreetMap contributors</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
