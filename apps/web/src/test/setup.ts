import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// Mock ligero de Leaflet para entorno jsdom en pruebas unitarias
vi.mock('leaflet', () => {
  const createMockLayer = () => ({
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
    removeLayer: vi.fn(),
  });

  const createMockMarker = () => ({
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    setLatLng: vi.fn().mockReturnThis(),
    setIcon: vi.fn().mockReturnThis(),
    getLatLng: vi.fn(() => ({ lat: 17.0609, lng: -96.7255 })),
  });

  const createMockMap = () => ({
    remove: vi.fn(),
    invalidateSize: vi.fn(),
    flyTo: vi.fn(),
    on: vi.fn().mockReturnThis(),
    removeLayer: vi.fn(),
  });

  const leafletMock = {
    map: vi.fn(() => createMockMap()),
    tileLayer: vi.fn(() => createMockLayer()),
    layerGroup: vi.fn(() => createMockLayer()),
    marker: vi.fn(() => createMockMarker()),
    polyline: vi.fn(() => createMockLayer()),
    divIcon: vi.fn((options: unknown) => options),
    control: {
      zoom: vi.fn(() => ({ addTo: vi.fn() })),
    },
  };

  return {
    default: leafletMock,
    ...leafletMock,
  };
});
