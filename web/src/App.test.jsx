import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import App from './App.jsx';

describe('App', () => {
  test('muestra el título', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'EnvíoTrack' })).toBeInTheDocument();
  });
});
